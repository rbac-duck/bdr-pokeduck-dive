/**
 * Simplified @motherduck/react-sql-query shim for local Vite preview.
 * Same API as the production dive runtime — useSQLQuery, useConnection,
 * useConnectionStatus, and MotherDuckSDKProvider.
 */
import { MDConnection } from "@motherduck/wasm-client";
import type { DuckDBRow } from "@motherduck/wasm-client";
import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  useCallback, useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────

type QueryStatus = "idle" | "loading" | "success" | "error";

type ConnectionState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; connection: MDConnection }
  | { status: "mock" }
  | { status: "error"; error: Error };

export type UseSQLQueryResult<TData = readonly DuckDBRow[]> = {
  data: TData | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isPlaceholderData: boolean;
  error: Error | null;
  refetch: () => void;
  status: QueryStatus;
};

type UseSQLQueryOptions<TData = readonly DuckDBRow[]> = {
  enabled?: boolean;
  select?: (data: readonly DuckDBRow[]) => TData;
  initialData?: TData;
  placeholderData?: TData | ((prev: TData | undefined) => TData | undefined);
};

// ── QueryObserver (external store for useSyncExternalStore) ────────

interface QueryObserverState {
  status: QueryStatus;
  data: readonly DuckDBRow[] | undefined;
  error: Error | undefined;
  hasHadData: boolean;
  lastData: readonly DuckDBRow[] | undefined;
}

class QueryObserver {
  private state: QueryObserverState = {
    status: "idle", data: undefined, error: undefined,
    hasHadData: false, lastData: undefined,
  };
  private listeners = new Set<() => void>();
  private abortController: AbortController | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.state;
  getStatus() { return this.state.status; }

  setState(updates: Partial<QueryObserverState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((l) => l());
  }

  async execute(connection: MDConnection, sql: string) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.setState({ status: "loading", data: undefined, error: undefined });
    try {
      const result = await connection.safeEvaluateQuery(sql);
      if (signal.aborted) return;
      if (result.status === "error") {
        this.setState({ status: "error", error: result.err, data: undefined });
        return;
      }
      const data = result.result.data.toRows();
      this.setState({
        status: "success", data, error: undefined,
        hasHadData: true, lastData: data,
      });
    } catch (err) {
      if (signal.aborted) return;
      this.setState({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
        data: undefined,
      });
    }
  }

  reset() {
    this.abortController?.abort();
    this.abortController = null;
    this.setState({ status: "idle", data: undefined, error: undefined });
  }
  cancel() {
    this.abortController?.abort();
    this.abortController = null;
  }
}

// ── Provider ───────────────────────────────────────────────────────

type ContextValue = { state: ConnectionState };
const SDKContext = createContext<ContextValue | null>(null);

function useSDKContext() {
  const ctx = useContext(SDKContext);
  if (!ctx) throw new Error("Must be used within MotherDuckSDKProvider");
  return ctx;
}

export function MotherDuckSDKProvider(
  { token, mock, children }: { token: string; mock?: boolean; children: ReactNode },
) {
  const [state, setState] = useState<ConnectionState>(mock ? { status: "mock" } : { status: "idle" });

  useEffect(() => {
    if (mock) { setState({ status: "mock" }); return; }
    if (!token) { setState({ status: "idle" }); return; }
    let cancelled = false;
    let conn: MDConnection | null = null;
    (async () => {
      setState({ status: "connecting" });
      try {
        conn = MDConnection.create({ mdToken: token, useDuckDBWasmCOI: false });
        await conn.isInitialized();
        if (!cancelled) setState({ status: "connected", connection: conn });
      } catch (err) {
        if (!cancelled) setState({
          status: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    })();
    return () => { cancelled = true; conn?.close(); };
  }, [token, mock]);

  const value = useMemo(() => ({ state }), [state]);
  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}

// ── useSQLQuery ────────────────────────────────────────────────────

export function useSQLQuery<TData = readonly DuckDBRow[]>(
  sql: string,
  options?: UseSQLQueryOptions<TData>,
): UseSQLQueryResult<TData> {
  const { state: connState } = useSDKContext();
  const observerRef = useRef<QueryObserver | null>(null);
  if (!observerRef.current) observerRef.current = new QueryObserver();
  const observer = observerRef.current;

  const snap = useSyncExternalStore(
    observer.subscribe, observer.getSnapshot, observer.getSnapshot,
  );
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (connState.status === "mock") {
      // Mock mode: every query succeeds with zero rows (or a fixture from window.__MOCK_ROWS__).
      // ?mockDelay=<ms> in the preview URL keeps queries loading that long (to check loading states)
      const fx = (globalThis as any).__MOCK_ROWS__?.(sql) ?? [];
      if (!enabled) return;
      const delay = Number(new URLSearchParams(location.search).get("mockDelay") || 0);
      const done = () => (observer as any).setState({ status: "success", data: fx, error: undefined, hasHadData: true, lastData: fx });
      if (!delay) { done(); return; }
      (observer as any).setState({ status: "loading" });
      const t = setTimeout(done, delay);
      return () => clearTimeout(t);
    }
    if (!enabled || connState.status !== "connected") {
      if (observer.getStatus() !== "idle") observer.reset();
      return;
    }
    observer.execute(connState.connection, sql);
    return () => observer.cancel();
  }, [sql, enabled, connState, observer]);

  const refetch = useCallback(() => {
    if (connState.status === "connected" && enabled) {
      observer.execute(connState.connection, sql);
    }
  }, [observer, connState, enabled, sql]);

  const isLoading = snap.status === "loading" || connState.status === "connecting";
  const rawData = snap.data ?? snap.lastData;

  const transformed = useMemo(() => {
    if (rawData === undefined) return undefined;
    return options?.select
      ? options.select(rawData)
      : (rawData as unknown as TData);
  }, [rawData, options?.select]);

  const { data, isPlaceholderData } = useMemo(() => {
    if (transformed !== undefined)
      return { data: transformed, isPlaceholderData: false };
    if (!snap.hasHadData && options?.initialData !== undefined)
      return { data: options.initialData, isPlaceholderData: false };
    if (isLoading && options?.placeholderData !== undefined) {
      const ph = typeof options.placeholderData === "function"
        ? (options.placeholderData as (p: TData | undefined) => TData | undefined)(transformed)
        : options.placeholderData;
      if (ph !== undefined) return { data: ph, isPlaceholderData: true };
    }
    return { data: undefined, isPlaceholderData: false };
  }, [transformed, snap.hasHadData, options?.initialData, options?.placeholderData, isLoading]);

  return {
    data, isLoading,
    isSuccess: snap.status === "success",
    isError: snap.status === "error",
    isPlaceholderData,
    error: snap.error ?? null,
    refetch, status: snap.status,
  };
}

// ── useConnection / useConnectionStatus ────────────────────────────

export function useConnection(): MDConnection | null {
  const { state } = useSDKContext();
  return state.status === "connected" ? state.connection : null;
}

export function useConnectionStatus() {
  const { state } = useSDKContext();
  return {
    isConnected: state.status === "connected" || state.status === "mock",
    isConnecting: state.status === "connecting",
    error: state.status === "error" ? state.error : null,
  };
}

// ── useDiveState ───────────────────────────────────────────────────
// Local preview: persisted per key in sessionStorage (production syncs it with the Dive).

export function useDiveState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const sk = `dive-state:${key}`;
  const [v, setV] = useState<T>(() => {
    try {
      // ?ds.<key>=<json> in the preview URL overrides state (handy for screenshots / deep links)
      const q = new URLSearchParams(location.search).get(`ds.${key}`);
      if (q != null) { try { return JSON.parse(q); } catch { return q as unknown as T; } }
      const raw = sessionStorage.getItem(sk); return raw != null ? JSON.parse(raw) : initial;
    }
    catch { return initial; }
  });
  const set = useCallback((nv: T | ((p: T) => T)) => {
    setV((prev) => {
      const next = typeof nv === "function" ? (nv as (p: T) => T)(prev) : nv;
      try { sessionStorage.setItem(sk, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [sk]);
  return [v, set];
}

// ── Flights (local stubs) ──────────────────────────────────────────
// Runs are not executed locally; each run "succeeds" after a short delay and logs its config.

const fakeRuns = new Map<string, { status: string }>();
let fakeRunCounter = 0;

export function useRunFlight(flightId: string) {
  const [data, setData] = useState<{ runNumber: number } | undefined>();
  const [isPending, setPending] = useState(false);
  const run = useCallback((config?: Record<string, string>) => {
    const runNumber = ++fakeRunCounter;
    console.info(`[preview] flight ${flightId} run #${runNumber} (not executed)`, config);
    fakeRuns.set(`${flightId}:${runNumber}`, { status: "SUCCEEDED" });
    setPending(true);
    setTimeout(() => { setData({ runNumber }); setPending(false); }, 300);
  }, [flightId]);
  return { run, data, isPending, error: null as Error | null };
}

export function useFlightRun(
  flightId: string,
  runNumber: number | undefined,
  opts?: { onFinished?: (r: { status: string; runNumber: number }) => void },
) {
  const [isChecking, setChecking] = useState(false);
  const cb = useRef(opts?.onFinished);
  cb.current = opts?.onFinished;
  useEffect(() => {
    if (runNumber == null) return;
    setChecking(true);
    const t = setTimeout(() => {
      const r = fakeRuns.get(`${flightId}:${runNumber}`) ?? { status: "SUCCEEDED" };
      setChecking(false);
      cb.current?.({ status: r.status, runNumber });
    }, 400);
    return () => clearTimeout(t);
  }, [flightId, runNumber]);
  return { isChecking, data: runNumber == null ? undefined : { status: "SUCCEEDED", runNumber } };
}
