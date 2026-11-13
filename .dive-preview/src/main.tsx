import { createRoot } from "react-dom/client";
import { MotherDuckSDKProvider, useConnectionStatus } from "./md-sdk";
import { Loader2, AlertCircle } from "lucide-react";
import "./mock-fixtures";
import Dive from "./dive";

function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { isConnected, isConnecting, error } = useConnectionStatus();
  if (isConnecting) return (
    <div className="flex items-center justify-center h-screen gap-2 text-[#6a6a6a]">
      <Loader2 className="animate-spin" size={20} />
      Connecting to MotherDuck…
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-screen gap-2 text-red-600">
      <AlertCircle size={20} />
      Connection failed: {error.message}
    </div>
  );
  if (!isConnected) return null;
  return <>{children}</>;
}

const token = import.meta.env.VITE_MOTHERDUCK_TOKEN;
// Mock mode (no token, or VITE_MOCK=1): renders the UI with empty query results for visual work.
const mock = import.meta.env.VITE_MOCK === "1" || !token || token === "your_token_here";
if (mock) console.info("[preview] mock mode: queries return no rows, flights are not executed");

createRoot(document.getElementById("root")!).render(
  <MotherDuckSDKProvider token={token ?? ""} mock={mock}>
    <ConnectionGate>
      <Dive />
    </ConnectionGate>
  </MotherDuckSDKProvider>
);
