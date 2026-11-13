import { useEffect, useMemo, useRef, useState } from "react";
import { useSQLQuery, useDiveState, useRunFlight, useFlightRun } from "@motherduck/react-sql-query";
import {
  ExternalLink, Linkedin, Search, AlertTriangle, Mail, TrendingUp, CalendarPlus, Coins, Rocket, Clock,
  Sparkles, Check, RotateCcw, ChevronDown, StickyNote, ArrowUpDown, X, Lock, Hand, Ticket, RefreshCw, BookOpen,
} from "lucide-react";

export const REQUIRED_DATABASES = [{ type: 'share', path: 'md:_share/mdw/8cdbf94d-7075-45a4-bf57-4fd19470e532', alias: 'mdw' }, { type: 'share', path: 'md:_share/bdr_terminal_gamified/51f8608a-6641-4fde-8847-b2c6bde9f34e', alias: 'bdr_terminal_gamified' }];



const FLIGHT_ID = "c258178b-dd1b-4cd6-a589-2e8944793085"; // bdr_terminal_log_action

// ---- Roster (mirrors the endorsed BDR Terminal's active BDRs) ----
const BDRS: { id: string; name: string; email: string }[] = [
  { id: "89400804", name: "Rebecca Polak", email: "rebecca@motherduck.com" },
  { id: "89400805", name: "Andrew Otterman", email: "andrewotterman@motherduck.com" },
  { id: "88175764", name: "Nick Mancini", email: "nickmancini@motherduck.com" },
  { id: "95288851", name: "Priscilla Lancaster", email: "priscilla@motherduck.com" },
  { id: "95672339", name: "Lauren Tiemann", email: "lauren@motherduck.com" },
  { id: "96069408", name: "Isabel Tilles", email: "isabel@motherduck.com" },
  { id: "83119213", name: "Ashley Conway", email: "ashley@motherduck.com" },
  { id: "102299028", name: "Divya Jain", email: "divya@motherduck.com" },
];
const ROSTER = new Set(BDRS.map((b) => b.id));
const bdrName = (id: string) => BDRS.find((b) => b.id === id)?.name ?? (id ? `Owner ${id}` : "—");
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// ---- Themes (Settings ⚙): "unova" = default, B&W-style game UI; "terminal" = original green CRT ----
const THEME_TERMINAL = {
  page: "#101512", surface: "#171f1a", surfaceAlt: "#1d2721", border: "#2a372f",
  text: "#e4ede6", muted: "#93a89a", faint: "#66786c", accent: "#9bbc0f", accentDim: "#306230",
  danger: "#ff6b5b", warn: "#ffd43b", ok: "#69db7c",
};
const THEME_UNOVA = {
  page: "#f0f0f0", surface: "#ffffff", surfaceAlt: "#f2f2f2", border: "#c8c8c8",
  text: "#303030", muted: "#585858", faint: "#888888", accent: "#3878c8", accentDim: "#dce8f8",
  danger: "#d84040", warn: "#c87810", ok: "#3a9a4a",
};
const C: any = { ...THEME_UNOVA };
// typography / shape tokens; mutated by applyTheme() at the top of every render
// Dives load no external fonts (only sans / serif / mono), so the game theme uses the mono stack
const FONT_GAME = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const UI: any = {
  game: true, solid: true, scale: 1.15, radius: 14, radius2: 8,
  body: FONT_GAME,
  pixel: FONT_GAME,
  bg: "linear-gradient(180deg, #fafafa 0%, #ececec 100%)",
};
const fs = (n: number) => Math.round(n * UI.scale * 2) / 2;
const FONT_CSS = `.bdr-root button:active { transform: translateY(1px); }
.bdr-root select, .bdr-root input, .bdr-root textarea { outline-color: #3878c8; }
.bdr-root ::selection { background: #3878c8; color: #fff; }
@keyframes bdrBlink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
@keyframes bdrFloat { 0% { opacity: 0; transform: translate(-50%, 6px) } 15% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -34px) } }
@keyframes bdrStripe { from { background-position: 0 0 } to { background-position: 24px 0 } }
@keyframes bdrPop { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`;
// readable ink on a coloured badge
const inkOn = (hex: string) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#15304a" : "#ffffff";
};
const SIG: Record<string, { color: string; Icon: any }> = {
  "New lead": { color: "#f783ac", Icon: Sparkles },
  "No-show": { color: "#ff6b5b", Icon: AlertTriangle },
  "Outcome unresolved": { color: "#ff8f6b", Icon: AlertTriangle },
  "Email reply": { color: "#5fb3ff", Icon: Mail },
  "Trial spike": { color: "#ffa94d", Icon: TrendingUp },
  "Trial extension": { color: "#ffd43b", Icon: Clock },
  "Converted to Lite": { color: "#69db7c", Icon: Rocket },
  "Converted to Business": { color: "#69db7c", Icon: Rocket },
  "Converted to Capacity": { color: "#69db7c", Icon: Rocket },
  "Onboarding booked": { color: "#b197fc", Icon: CalendarPlus },
  "High AWR": { color: "#38d9a9", Icon: Coins },
  "Hand-raiser": { color: "#ff4d94", Icon: Hand },
  "Event attended": { color: "#4dabf7", Icon: Ticket },
  "Event no-show": { color: "#74c0fc", Icon: Ticket },
  "Event registered": { color: "#a5d8ff", Icon: Ticket },
  "Event upcoming": { color: "#99e9f2", Icon: Ticket },
  "Reactivation engaged": { color: "#e599f7", Icon: RefreshCw },
  "Usage reactivated": { color: "#da77f2", Icon: RefreshCw },
  "Re-signup": { color: "#cc5de8", Icon: RefreshCw },
  "Content download": { color: "#c0eb75", Icon: BookOpen },
};
const sigMeta = (s: string) => SIG[s] ?? { color: C.muted, Icon: AlertTriangle };
const chipKey = (s: string) => (s.startsWith("Converted") ? "Converted" : s === "No-show" ? "Outcome unresolved"
  : s.startsWith("Event") ? "Event" : ["Reactivation engaged", "Usage reactivated", "Re-signup"].includes(s) ? "Reactivation" : s);
const CHIPS: [string, string][] = [
  ["New lead", "#f783ac"], ["Outcome unresolved", "#ff8f6b"], ["Email reply", "#5fb3ff"], ["Trial spike", "#ffa94d"],
  ["Trial extension", "#ffd43b"], ["Converted", "#69db7c"], ["Onboarding booked", "#b197fc"], ["High AWR", "#38d9a9"],
  ["Hand-raiser", "#ff4d94"], ["Event", "#4dabf7"], ["Reactivation", "#e599f7"], ["Content download", "#c0eb75"],
];

const BUCKETS: { id: string; label: string; hint: string }[] = [
  { id: "active", label: "Active", hint: "Live signal not yet answered by any touch" },
  { id: "retouch_due", label: "Retouch due", hint: "Retouch date reached with no touch since you set it" },
  { id: "cold", label: "Cold", hint: "Signal older than 14 days, never answered" },
  { id: "scheduled", label: "Scheduled", hint: "Retouch date in the future" },
  { id: "reviewed", label: "Reviewed", hint: "Marked reviewed (resurfaces on a newer signal or after 7 days)" },
  { id: "handled", label: "Handled", hint: "Someone touched them after every signal" },
  { id: "all", label: "All", hint: "Everything in scope" },
];

// ---- helpers ----
const N = (v: unknown): number => (v == null ? 0 : Number(v));
const S = (v: unknown): string => (v == null ? "" : String(v));
const B = (v: unknown): boolean => v === true || v === "true";
const T = (s: string | null | undefined): number | null => (s ? Date.parse(s.length <= 10 ? s + "T00:00:00Z" : s + "Z") : null);
const daysSince = (t: number | null) => (t == null ? null : Math.floor((Date.now() - t) / 864e5));
const fmtDate = (t: number | null) => (t == null ? "—" : new Date(t).toISOString().slice(0, 10));
const fmtAgo = (t: number | null) => {
  if (t == null) return "never";
  const h = (Date.now() - t) / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
const fmtUsd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`);
const HS_CONTACT = (id: string) => `https://app.hubspot.com/contacts/22616816/record/0-1/${id}`;
const HS_INDEX = "https://app.hubspot.com/contacts/22616816/objects/0-1/views/all/list";
// HubSpot sometimes stores LinkedIn URLs without a scheme; without one the browser treats them as a page inside the dive
const normUrl = (u: string) => { const s = (u || "").trim(); if (!s) return ""; return /^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, ""); };
// HubSpot can't take filters in a link, so the terminal spells out the equivalent HubSpot filters for the current view
const HS_RECIPE: Record<string, string> = {
  "New lead": "Create date is less than 3 days ago",
  "Outcome unresolved": "(deal filter) Associated deal: Intro meeting start time in the last 30 days AND Intro meeting status is No Show, or Deal stage is Pre-Qualification / Rescheduling with no qualified date",
  "Email reply": "Recent sales email replied date is less than 30 days ago",
  "Trial spike": "NOT IN HUBSPOT: product usage (CPU-hours up 3x week over week)",
  "Trial extension": "Trial end date is after today (HubSpot can't compare it to Initial trial end date)",
  "Converted": "NOT IN HUBSPOT: product plan change to Lite/Business/Capacity in the last 30 days",
  "Onboarding booked": "Product onboarding call booked date is less than 30 days ago",
  "High AWR": "NOT IN HUBSPOT: product AWR of $6K or more",
  "Hand-raiser": "Recent conversion date is less than 30 days ago AND Recent conversion contains any of: Contact Sales, Contact an Expert, Pricing, Demo, Offer request, Waitlist",
  "Event": "Marketing event participation (Attended / Registered / No-show) for an event in the last 21 days or next 14 days",
  "Reactivation": "Reactivation campaign status is known AND Recent sales email replied date / Time last seen / Recent conversion date is after Reactivation sequence enrolled date",
  "Content download": "Recent conversion date is less than 14 days ago AND Recent conversion contains any of: Book, Guide, Cheatsheet, Gated video, Lead Generation",
};
const HS_PAGES: Record<string, string> = {
  Pricing: "Pricing page visit count is greater than 0 (or First/Last page seen contains /pricing)",
  Docs: "/docs", Blog: "/blog", Product: "/product, /ducklake, /dives, /flights, /vs/, /ecosystem", "Trial / ad landing": "/lp/, trial, /get-started, /ad/",
  "Books / courses": "book, cheatsheet, course, /learn, glossary, video", Events: "/events, webinar, meetup", "Contact / customers": "contact-us, case-studies, customers",
  Homepage: "the homepage", Careers: "/careers",
};
function hubspotRecipe(o: { owners: string[]; bucket: string; sigs: string[]; opened: string; pages: string[]; hasLi: boolean; createdWin: string }): string[] {
  const out = [`Contact owner is any of: ${o.owners.map((id) => bdrName(id)).join(", ")}`];
  if (o.sigs.length) out.push(o.sigs.length === 1 ? HS_RECIPE[o.sigs[0]] ?? o.sigs[0] : `ANY OF: ${o.sigs.map((s) => `[${HS_RECIPE[s] ?? s}]`).join(" OR ")}`);
  else out.push(`ANY signal (add one filter group per signal): ${Object.keys(HS_RECIPE).filter((k) => !HS_RECIPE[k].startsWith("NOT IN")).join(", ")}`);
  if (o.createdWin !== "any") out.push(`Create date is less than ${o.createdWin} days ago`);
  if (o.hasLi) out.push("LinkedIn URL is known");
  const op: Record<string, string> = { since_touch: "Recent sales email opened date is after Last contacted", le1: "Recent sales email opened date is less than 1 day ago",
    le3: "Recent sales email opened date is less than 3 days ago", le7: "Recent sales email opened date is less than 7 days ago",
    clicked: "Recent sales email clicked date is after Last contacted", never: "Recent sales email opened date is unknown" };
  if (op[o.opened]) out.push(op[o.opened]);
  if (o.pages.length) out.push(`Pages viewed, any of: ${o.pages.map((p) => (p === "Pricing" ? HS_PAGES.Pricing : `First or Last page seen contains ${HS_PAGES[p] ?? p}`)).join(" OR ")}`);
  const bk: Record<string, string> = {
    active: "Last contacted is before the signal date (unanswered) and the signal is from the last 14 days",
    cold: "Last contacted is before the signal date and the signal is older than 14 days",
    handled: "Last contacted is after the signal date",
    reviewed: "TERMINAL-ONLY: Reviewed status lives in MotherDuck, not HubSpot (use Copy emails)",
    retouch_due: "TERMINAL-ONLY: retouch dates live in MotherDuck, not HubSpot (use Copy emails)",
    scheduled: "TERMINAL-ONLY: retouch dates live in MotherDuck, not HubSpot (use Copy emails)",
  };
  if (bk[o.bucket]) out.push(bk[o.bucket]);
  out.push("Exclude: contacts at companies with an open/won SQA deal (post-SQA)");
  return out;
}
const C360 = (orgId: string) =>
  `https://app.motherduck.com/dives/customer-360-f1d01051-2847-41d2-94f3-3c66d228c78c#state=${btoa(JSON.stringify({ orgId }))}`;
const newEventId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const CADENCE_TARGET_14D = 6; // warm/signal-triggered inbound: ~5-7 touches over 10-14 days

function queueSql(ownersSql: string, extraSql: string) {
  return `WITH params AS (SELECT 30 AS win),
owners_sel AS (SELECT unnest([${ownersSql}]) AS owner_id),
noshow_deals AS (
  SELECT d.hs_object_id::VARCHAR AS deal_id, d.dealname, d.bdr_owner,
         TRY_CAST(d.intro_meeting_start_time AS TIMESTAMP) AS mtg_ts,
         lower(COALESCE(d.intro_meeting_status,'')) = 'no show' AS explicit_ns
  FROM "mdw"."hubspot"."deals" d, params p
  WHERE d.bdr_owner IN (SELECT owner_id FROM owners_sel)
    AND TRY_CAST(d.intro_meeting_start_time AS TIMESTAMP) BETWEEN now()::TIMESTAMP - (p.win * INTERVAL 1 DAY) AND now()::TIMESTAMP - INTERVAL 2 HOUR
    AND (lower(COALESCE(d.intro_meeting_status,'')) = 'no show'
      OR (COALESCE(d.intro_meeting_status,'') IN ('','Booked','Rebooked')
          AND d.dealstage IN ('210487120','1417185394') AND d.first_date_qualified IS NULL))
),
noshow AS (
  SELECT DISTINCT dca.contact_id::VARCHAR AS contact_id, n.mtg_ts, n.explicit_ns, n.dealname, n.bdr_owner
  FROM noshow_deals n JOIN "mdw"."hubspot"."deal_to_contact_associations" dca ON dca.deal_id::VARCHAR = n.deal_id
),
c AS (
  SELECT ct.* FROM "mdw"."hubspot"."contacts" ct
  WHERE ct.hubspot_owner_id IN (SELECT owner_id FROM owners_sel)
     OR ct.hs_object_id IN (SELECT contact_id FROM noshow)
     OR ct.hs_object_id IN (${extraSql})
),
my_orgs AS (
  SELECT DISTINCT c.hs_object_id AS contact_id, TRY_CAST(ho.mdw_organization_id AS UUID) AS org_id,
    ho.completed_add_data, ho.completed_connect_tools, ho.completed_share_data, ho.org_name
  FROM c
  JOIN "mdw"."hubspot"."contact_to_org_associations" coa ON coa.contact_id::VARCHAR = c.hs_object_id
  JOIN "mdw"."hubspot"."organizations" ho ON ho.hubspot_organization_id = CAST(coa.organization_id AS VARCHAR)
),
usage AS (
  SELECT id AS org_id,
    COALESCE(SUM(cpu_h) FILTER (WHERE dt > current_date - 8), 0) AS cpu_7d,
    COALESCE(SUM(cpu_h) FILTER (WHERE dt <= current_date - 8 AND dt > current_date - 15), 0) AS cpu_prev7d,
    COALESCE(SUM(cpu_h) FILTER (WHERE dt <= current_date - 8 AND dt > current_date - 45), 0) AS cpu_dormant
  FROM "mdw"."computed"."daily_organization_stats"
  WHERE dt > current_date - 45 AND id IN (SELECT org_id FROM my_orgs) GROUP BY 1
),
awr AS (
  SELECT organization_id AS org_id, arg_max(awr, dt) AS awr, arg_max(plan, dt) AS plan
  FROM "mdw"."computed"."daily_organization_awr"
  WHERE is_full_day AND dt > current_date - 10 AND organization_id IN (SELECT org_id FROM my_orgs) GROUP BY 1
),
org_plan AS (SELECT id AS org_id, plan FROM "mdw"."main"."organizations" WHERE id IN (SELECT org_id FROM my_orgs)),
conv AS (
  SELECT organization_id AS org_id, plan, dt FROM "mdw"."main"."organization_plan_change_events", params p
  WHERE dt >= current_date - p.win AND plan IN ('lite','business','capacity')
    AND COALESCE(prev_plan,'') NOT IN ('lite','business','capacity')
    AND organization_id IN (SELECT org_id FROM my_orgs)
),
org_rollup AS (
  SELECT mo.contact_id,
    arg_max(mo.org_id, COALESCE(u.cpu_7d,0) + COALESCE(a.awr,0)) AS primary_org_id,
    arg_max(COALESCE(op.plan, a.plan), COALESCE(u.cpu_7d,0) + COALESCE(a.awr,0)) AS plan,
    arg_max(mo.org_name, COALESCE(u.cpu_7d,0) + COALESCE(a.awr,0)) AS org_name,
    bool_or(mo.completed_add_data::VARCHAR IN ('true','True')) AS m_add_data,
    bool_or(mo.completed_connect_tools::VARCHAR IN ('true','True')) AS m_connect_tools,
    bool_or(mo.completed_share_data::VARCHAR IN ('true','True')) AS m_share_data,
    SUM(COALESCE(u.cpu_7d,0)) AS cpu_7d, SUM(COALESCE(u.cpu_prev7d,0)) AS cpu_prev7d, SUM(COALESCE(u.cpu_dormant,0)) AS cpu_dormant,
    MAX(COALESCE(a.awr,0)) AS awr, COUNT(*) AS org_count
  FROM my_orgs mo
  LEFT JOIN usage u ON u.org_id = mo.org_id
  LEFT JOIN awr a ON a.org_id = mo.org_id
  LEFT JOIN org_plan op ON op.org_id = mo.org_id
  GROUP BY 1
),
-- ---------- every human touch on these contacts, by anyone (BDR, AE, CE) ----------
c_emails AS (SELECT hs_object_id AS contact_id, lower(trim(email)) AS addr FROM c WHERE email IS NOT NULL AND email <> ''),
email_touch AS (
  SELECT ce.contact_id, TRY_CAST(e.hs_timestamp AS TIMESTAMP) AS ts, e.hubspot_owner_id AS actor_id, 'Email' AS channel
  FROM (
    SELECT hs_timestamp, hubspot_owner_id,
      unnest(regexp_extract_all(lower(hs_email_to_email), '[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}')) AS addr
    FROM "mdw"."hubspot"."emails"
    WHERE hs_email_direction = 'EMAIL'
      AND TRY_CAST(hs_timestamp AS TIMESTAMP) > now()::TIMESTAMP - INTERVAL 180 DAY
  ) e JOIN c_emails ce ON ce.addr = e.addr
),
call_touch AS (
  SELECT cca.contact_id::VARCHAR AS contact_id, TRY_CAST(cl.hs_timestamp AS TIMESTAMP) AS ts, cl.hubspot_owner_id AS actor_id,
    CASE WHEN cl.call_disposition_label IN ('Connected', 'Interested: follow up', 'Not interested', 'Booked AE meeting', 'Bad fit', 'Intro not made') THEN 'Call (connected)' ELSE 'Call' END AS channel
  FROM "mdw"."hubspot"."call_to_contact_associations" cca
  JOIN "mdw"."hubspot"."calls" cl ON cl.call_id = cca.call_id
  WHERE cca.contact_id::VARCHAR IN (SELECT hs_object_id FROM c)
),
meeting_touch AS (
  SELECT mca.contact_id::VARCHAR AS contact_id, m.start_time AS ts, m.hubspot_owner_id AS actor_id, 'Meeting' AS channel
  FROM "mdw"."hubspot"."meeting_to_contact_associations" mca
  JOIN "mdw"."hubspot"."meetings" m ON m.meeting_id = mca.meeting_id
  WHERE mca.contact_id::VARCHAR IN (SELECT hs_object_id FROM c) AND m.start_time <= now()::TIMESTAMP
),
touches AS (
  SELECT * FROM email_touch UNION ALL SELECT * FROM call_touch UNION ALL SELECT * FROM meeting_touch
),
touch_agg AS (
  SELECT contact_id,
    MIN(ts) AS first_touch_ts,
    MAX(ts) AS last_touch_ts,
    arg_max(actor_id, ts) AS last_touch_actor_id,
    arg_max(channel, ts) AS last_touch_channel,
    COUNT(*) FILTER (WHERE ts > now()::TIMESTAMP - INTERVAL 14 DAY) AS touches_14d,
    COUNT(*) AS touches_180d,
    COUNT(*) FILTER (WHERE channel LIKE 'Call%') AS calls_total,
    COUNT(*) FILTER (WHERE channel = 'Call (connected)') AS calls_connected
  FROM touches WHERE ts IS NOT NULL GROUP BY 1
),
-- ---------- marketing events (webinars, conferences, meetups) ----------
ev AS (
  SELECT p.contact_id::VARCHAR AS contact_id, p.attendance_state, p.occurred_ts, p.created_ts,
    e.marketing_event_name, e.marketing_event_type, e.start_ts
  FROM "mdw"."hubspot"."marketing_event_participations" p
  JOIN "mdw"."hubspot"."marketing_events" e ON e.marketing_event_id = p.marketing_event_id
  WHERE p.contact_id::VARCHAR IN (SELECT hs_object_id FROM c)
    AND COALESCE(e.start_ts, p.occurred_ts) >= now()::TIMESTAMP - INTERVAL 21 DAY
  QUALIFY row_number() OVER (PARTITION BY p.contact_id, p.marketing_event_id
    ORDER BY CASE p.attendance_state WHEN 'ATTENDED' THEN 1 WHEN 'NO_SHOW' THEN 2 WHEN 'REGISTERED' THEN 3 ELSE 4 END) = 1
),
-- ---------- signals ----------
signals AS (
  SELECT contact_id, 1 AS rnk, CASE WHEN explicit_ns THEN 'No-show' ELSE 'Outcome unresolved' END AS sig, mtg_ts AS sig_ts, dealname AS detail FROM noshow
  UNION ALL
  SELECT c.hs_object_id, 0, 'New lead', c.created_at, NULL
  FROM c LEFT JOIN touch_agg t ON t.contact_id = c.hs_object_id
  WHERE c.created_at >= now()::TIMESTAMP - INTERVAL 3 DAY AND c.hubspot_owner_id IN (SELECT owner_id FROM owners_sel)
    AND (t.first_touch_ts IS NULL OR t.first_touch_ts < c.created_at)
  UNION ALL
  SELECT c.hs_object_id, 2, 'Email reply', c.hs_sales_email_last_replied, NULL
  FROM c, params p WHERE c.hs_sales_email_last_replied >= now()::TIMESTAMP - (p.win * INTERVAL 1 DAY)
  UNION ALL
  SELECT contact_id, 3, 'Trial spike', NULL::TIMESTAMP, printf('%.1f CPU-h last 7d vs %.1f prior', cpu_7d, cpu_prev7d)
  FROM org_rollup WHERE cpu_7d >= 1.5 AND (cpu_prev7d = 0 OR cpu_7d / cpu_prev7d >= 3)
  UNION ALL
  SELECT hs_object_id, 4, 'Trial extension', NULL::TIMESTAMP, 'Trial now ends ' || strftime(trial_end_date, '%b %-d')
  FROM c WHERE trial_end_date > initial_trial_end_date AND trial_end_date >= current_date
  UNION ALL
  SELECT mo.contact_id, 5, 'Converted to ' || upper(conv.plan[1]) || conv.plan[2:], conv.dt::TIMESTAMP, NULL
  FROM my_orgs mo JOIN conv ON conv.org_id = mo.org_id
  UNION ALL
  SELECT c.hs_object_id, 6, 'Onboarding booked', c.product_onboarding_call_booked_date, NULL
  FROM c, params p WHERE c.product_onboarding_call_booked_date >= now()::TIMESTAMP - (p.win * INTERVAL 1 DAY)
  UNION ALL
  SELECT contact_id, 7, 'High AWR', NULL::TIMESTAMP, '$' || CAST(round(awr / 1000, 1) AS VARCHAR) || 'K AWR'
  FROM org_rollup WHERE awr >= 6000
  UNION ALL
  -- hand-raisers: high-intent forms (contact sales / expert / pricing / offer / waitlist / trial-extension request)
  SELECT hs_object_id, 0, 'Hand-raiser', recent_conversion_date, split_part(recent_conversion_event_name, ' | ', 1)
  FROM c WHERE recent_conversion_date >= now()::TIMESTAMP - INTERVAL 30 DAY
    AND regexp_matches(lower(recent_conversion_event_name), 'contact|expert|sales|pricing|demo|offer request|waitlist|trial extension request')
    AND NOT regexp_matches(lower(recent_conversion_event_name), 'silent-form')
  UNION ALL
  -- events in the last 21 days (one row per contact + event, best attendance state wins)
  SELECT contact_id,
    CASE attendance_state WHEN 'ATTENDED' THEN 2 WHEN 'NO_SHOW' THEN 5 ELSE 7 END,
    CASE attendance_state WHEN 'ATTENDED' THEN 'Event attended' WHEN 'NO_SHOW' THEN 'Event no-show' ELSE 'Event registered' END,
    COALESCE(start_ts, occurred_ts), marketing_event_name || ' · ' || strftime(COALESCE(start_ts, occurred_ts), '%b %-d')
  FROM ev WHERE attendance_state IN ('ATTENDED', 'NO_SHOW', 'REGISTERED') AND COALESCE(start_ts, occurred_ts) <= now()::TIMESTAMP
  UNION ALL
  SELECT contact_id, 6, 'Event upcoming', NULL::TIMESTAMP, marketing_event_name || ' · ' || strftime(start_ts, '%b %-d')
  FROM ev WHERE attendance_state = 'REGISTERED' AND start_ts > now()::TIMESTAMP AND start_ts <= now()::TIMESTAMP + INTERVAL 14 DAY
  UNION ALL
  -- reactivation: engaged with a reactivation campaign after being enrolled
  SELECT hs_object_id, 2, 'Reactivation engaged',
    GREATEST(
      CASE WHEN hs_sales_email_last_replied::DATE >= reactivation_sequence_enrolled_date THEN hs_sales_email_last_replied END,
      CASE WHEN TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP)::DATE >= reactivation_sequence_enrolled_date THEN TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP) END,
      CASE WHEN recent_conversion_date::DATE >= reactivation_sequence_enrolled_date THEN recent_conversion_date END),
    COALESCE(reactivation_campaign_name, 'reactivation campaign')
  FROM c WHERE reactivation_sequence_enrolled_date IS NOT NULL AND (
       (hs_sales_email_last_replied::DATE >= reactivation_sequence_enrolled_date AND hs_sales_email_last_replied >= now()::TIMESTAMP - INTERVAL 30 DAY)
    OR (TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP)::DATE >= reactivation_sequence_enrolled_date AND TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP) >= now()::TIMESTAMP - INTERVAL 14 DAY)
    OR (recent_conversion_date::DATE >= reactivation_sequence_enrolled_date AND recent_conversion_date >= now()::TIMESTAMP - INTERVAL 30 DAY))
  UNION ALL
  -- reactivation: returning signup (existing contact signed up again)
  SELECT hs_object_id, 3, 'Re-signup', recent_conversion_date, 'signed up again after ' || CAST(date_diff('day', created_at, recent_conversion_date) AS VARCHAR) || ' days'
  FROM c WHERE recent_conversion_event_name = 'product-signup-silent-form' AND recent_conversion_date >= now()::TIMESTAMP - INTERVAL 30 DAY
    AND created_at < recent_conversion_date - INTERVAL 30 DAY
  UNION ALL
  -- reactivation: usage came back after 30+ quiet days (not a brand-new account)
  SELECT o.contact_id, 3, 'Usage reactivated', NULL::TIMESTAMP, printf('%.1f CPU-h this week after 30+ quiet days', o.cpu_7d)
  FROM org_rollup o JOIN c ON c.hs_object_id = o.contact_id
  WHERE o.cpu_7d >= 0.5 AND o.cpu_dormant = 0 AND c.created_at < now()::TIMESTAMP - INTERVAL 45 DAY
  UNION ALL
  -- content downloads (books, guides, cheatsheets, gated videos, LinkedIn lead-gen)
  SELECT hs_object_id, 6, 'Content download', recent_conversion_date, split_part(split_part(recent_conversion_event_name, ' | ', 1), ': ', 1)
  FROM c WHERE recent_conversion_date >= now()::TIMESTAMP - INTERVAL 14 DAY
    AND regexp_matches(lower(recent_conversion_event_name), 'book|guide|cheatsheet|gated video|lead generation|index|podcast|tutorial')
    AND NOT regexp_matches(lower(recent_conversion_event_name), 'contact|expert|sales|pricing|demo|offer request|waitlist')
),
sqa_deals AS (
  SELECT d.hs_object_id::VARCHAR AS deal_id, d.dealname, TRY_CAST(d.first_date_qualified AS DATE) AS qd,
    CASE WHEN NOT COALESCE(d.hs_is_closed, false) THEN 'open'
         WHEN d.date_entered_closed_won_motherduck_sales IS NOT NULL OR d.date_entered_closed_won_customer_pipeline_sales IS NOT NULL THEN 'won'
         ELSE 'lost' END AS st,
    d.closedate, d.hubspot_owner_id AS deal_owner
  FROM "mdw"."hubspot"."deals" d
  WHERE d.first_date_qualified IS NOT NULL
    AND (
      (TRY_CAST(d.first_date_qualified AS DATE) < DATE '2026-08-01' AND COALESCE(d.tags_stamped_at_deal_qualification,'') <> 'Growth Account')
      OR (TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01' AND (
            COALESCE(d.segment_stamped_at_deal_qualification,'') IN ('SMB','MM','ENT')
            OR (COALESCE(d.segment_stamped_at_deal_qualification,'') = 'Micro'
                AND lower(COALESCE(TRY_CAST(d.is_focused_stamped_at_deal_qualification AS VARCHAR),'')) = 'true'))))
    AND (d.pipeline = 'default' OR COALESCE(d.needs_intro_meeting,'') = 'Yes')
    AND COALESCE(d.dealtype,'') <> 'existingbusiness'
),
sqa_live AS (SELECT * FROM sqa_deals WHERE st IN ('open','won') OR (st = 'lost' AND closedate >= now()::TIMESTAMP - INTERVAL 180 DAY)),
sqa_hit AS (
  SELECT x.k, arg_max(s.dealname || ' · qualified ' || strftime(s.qd, '%Y-%m-%d') || ' · ' || s.st || COALESCE(' · ' || NULLIF(TRIM(COALESCE(o.firstName,'') || ' ' || COALESCE(o.lastName,'')), ''), ''), s.qd) AS info
  FROM (
    SELECT 'co:' || CAST(company_id AS VARCHAR) AS k, CAST(deal_id AS VARCHAR) AS deal_id FROM "mdw"."hubspot"."deal_to_company_associations"
    UNION ALL
    SELECT 'ct:' || CAST(contact_id AS VARCHAR), CAST(deal_id AS VARCHAR) FROM "mdw"."hubspot"."deal_to_contact_associations"
  ) x JOIN sqa_live s ON s.deal_id = x.deal_id
  LEFT JOIN "mdw"."hubspot"."owners" o ON o.id = s.deal_owner
  GROUP BY 1
),
sig_agg AS (
  SELECT contact_id, MIN(rnk) AS top_rank, arg_min(sig, rnk) AS top_signal,
    to_json(list({'sig': sig, 'rnk': rnk, 'ts': strftime(sig_ts, '%Y-%m-%dT%H:%M:%S'), 'detail': detail} ORDER BY rnk))::VARCHAR AS signals_json,
    MAX(sig_ts) AS latest_sig_ts
  FROM signals GROUP BY 1
),
noshow_owner AS (SELECT contact_id, arg_max(bdr_owner, mtg_ts) AS bdr_owner FROM noshow GROUP BY 1),
base AS (
  SELECT contact_id FROM sig_agg
  UNION SELECT hs_object_id FROM c WHERE hs_object_id IN (${extraSql})
)
SELECT
  c.hs_object_id AS contact_id,
  c.hubspot_owner_id AS owner_id,
  COALESCE(CASE WHEN c.hubspot_owner_id IN (SELECT owner_id FROM owners_sel) THEN c.hubspot_owner_id END, nso.bdr_owner, c.hubspot_owner_id) AS queue_owner_id,
  NULLIF(TRIM(COALESCE(c.firstname,'') || ' ' || COALESCE(c.lastname,'')), '') AS contact_name,
  c.email, c.jobtitle,
  COALESCE(co.name, c.company, c.associated_company_domain_name) AS company,
  COALESCE(NULLIF(c.linkedin_url,''), NULLIF(c.ap_linkedin_url,''),
    CASE WHEN NULLIF(c.cr_linkedin_username,'') IS NOT NULL THEN 'https://www.linkedin.com/in/' || c.cr_linkedin_username END) AS linkedin_url,
  TRIM(ae.firstName || ' ' || ae.lastName) AS ae_name,
  COALESCE(s.top_rank, 99) AS top_rank, s.top_signal, COALESCE(s.signals_json, '[]') AS signals_json,
  strftime(s.latest_sig_ts, '%Y-%m-%dT%H:%M:%S') AS latest_sig_ts,
  o.plan, o.org_name, o.org_count, o.primary_org_id::VARCHAR AS primary_org_id,
  o.m_add_data, o.m_connect_tools, o.m_share_data,
  round(o.cpu_7d, 2) AS cpu_7d, round(o.cpu_prev7d, 2) AS cpu_prev7d, round(o.awr, 0) AS awr,
  strftime(c.trial_end_date, '%Y-%m-%d') AS trial_end_date,
  c.product_lifecycle_stage_label AS lifecycle,
  c.hs_lead_status_label AS lead_status,
  strftime(c.created_at, '%Y-%m-%dT%H:%M:%S') AS created_ts,
  strftime(t.first_touch_ts, '%Y-%m-%dT%H:%M:%S') AS first_touch_ts,
  CASE WHEN t.first_touch_ts >= c.created_at THEN round(date_diff('minute', c.created_at, t.first_touch_ts) / 60.0, 1) END AS speed_to_lead_hrs,
  strftime(GREATEST(t.last_touch_ts, c.notes_last_contacted, c.hs_last_sales_activity_timestamp), '%Y-%m-%dT%H:%M:%S') AS last_touch_ts,
  t.last_touch_actor_id,
  TRIM(lt.firstName || ' ' || lt.lastName) AS last_touch_by,
  t.last_touch_channel,
  COALESCE(t.touches_14d, 0) AS touches_14d,
  COALESCE(t.touches_180d, 0) AS touches_180d,
  COALESCE(t.calls_total, 0) AS calls_total,
  COALESCE(t.calls_connected, 0) AS calls_connected,
  strftime(c.hs_sales_email_last_replied, '%Y-%m-%dT%H:%M:%S') AS last_reply_ts,
  strftime(c.hs_sales_email_last_opened, '%Y-%m-%dT%H:%M:%S') AS last_opened_ts,
  strftime(c.hs_sales_email_last_clicked, '%Y-%m-%dT%H:%M:%S') AS last_clicked_ts,
  COALESCE(c.hs_analytics_num_page_views, 0) AS page_views,
  COALESCE(c.pricing_page_visit_count, 0) AS pricing_visits,
  regexp_extract(c.hs_analytics_last_url, '^https?://[^/]+(/[^?#]*)?', 1) AS last_page,
  array_to_string(list_filter([
    CASE WHEN COALESCE(c.pricing_page_visit_count, 0) > 0 OR regexp_matches(lower(pg.u), '/pricing') THEN 'Pricing' END,
    CASE WHEN regexp_matches(lower(pg.u), '/docs') THEN 'Docs' END,
    CASE WHEN regexp_matches(lower(pg.u), '/blog') THEN 'Blog' END,
    CASE WHEN regexp_matches(lower(pg.u), '/product|/quack-query-dives|/vs/|/ecosystem|/ducklake|/dives|/flights') THEN 'Product' END,
    CASE WHEN regexp_matches(lower(pg.u), '/lp/|trial|/get-started|/ad/|/ad( |$)') THEN 'Trial / ad landing' END,
    CASE WHEN regexp_matches(lower(pg.u), 'book|cheatsheet|course|/learn|glossary|video') THEN 'Books / courses' END,
    CASE WHEN regexp_matches(lower(pg.u), '/events|ducktober|divemaxxing|webinar|meetup') THEN 'Events' END,
    CASE WHEN regexp_matches(lower(pg.u), 'contact-us|case-studies|customers') THEN 'Contact / customers' END,
    CASE WHEN regexp_matches(lower(pg.u), '/careers') THEN 'Careers' END,
    CASE WHEN regexp_matches(lower(c.hs_analytics_last_url), '^https?://[^/]+/?([?#]|$)') THEN 'Homepage' END
  ], x -> x IS NOT NULL), '|') AS page_cats,
  COALESCE(hc.info, hco.info) AS sqa_info,
  (hc.info IS NOT NULL OR hco.info IS NOT NULL) AS post_sqa
FROM base b
JOIN c ON c.hs_object_id = b.contact_id
LEFT JOIN sig_agg s ON s.contact_id = c.hs_object_id
LEFT JOIN noshow_owner nso ON nso.contact_id = c.hs_object_id
LEFT JOIN "mdw"."hubspot"."companies" co ON co.hs_object_id = c.associatedcompanyid
LEFT JOIN "mdw"."hubspot"."owners" ae ON ae.id = co.assigned_sales_owner_id
LEFT JOIN org_rollup o ON o.contact_id = c.hs_object_id
LEFT JOIN touch_agg t ON t.contact_id = c.hs_object_id
LEFT JOIN "mdw"."hubspot"."owners" lt ON lt.id = t.last_touch_actor_id
LEFT JOIN sqa_hit hco ON hco.k = 'co:' || c.associatedcompanyid
LEFT JOIN sqa_hit hc ON hc.k = 'ct:' || c.hs_object_id
CROSS JOIN LATERAL (SELECT COALESCE(c.hs_analytics_last_url, '') || ' ' || COALESCE(c.hs_analytics_first_url, '') AS u) pg
`;
}

const overlaySql = `
SELECT contact_id::VARCHAR AS contact_id, last_actor_bdr_id,
  strftime(reviewed_ts, '%Y-%m-%dT%H:%M:%S') AS reviewed_ts,
  strftime(retouch_event_ts, '%Y-%m-%dT%H:%M:%S') AS retouch_event_ts,
  strftime(retouch_on, '%Y-%m-%d') AS retouch_on,
  linkedin_status,
  strftime(last_linkedin_ts, '%Y-%m-%dT%H:%M:%S') AS last_linkedin_ts,
  last_linkedin_actor, linkedin_14d, last_note,
  strftime(last_note_ts, '%Y-%m-%dT%H:%M:%S') AS last_note_ts
FROM "bdr_terminal_gamified"."main"."contact_queue_state"`;

type Sig = { sig: string; rnk: number; ts: number | null; detail: string; handled?: boolean };
type Ov = {
  reviewed_ts: number | null; retouch_event_ts: number | null; retouch_on: string | null;
  linkedin_status: string; last_linkedin_ts: number | null; last_linkedin_actor: string; linkedin_14d: number;
  last_note: string; last_note_ts: number | null;
};
type Row = {
  contact_id: string; owner_id: string; queue_owner_id: string; contact_name: string; email: string; jobtitle: string;
  company: string; linkedin_url: string; ae_name: string; signals: Sig[]; plan: string; org_name: string; org_count: number;
  primary_org_id: string; m_add_data: boolean; m_connect_tools: boolean; m_share_data: boolean; cpu_7d: number;
  cpu_prev7d: number; awr: number; trial_end_date: string; lifecycle: string; lead_status: string;
  created: number | null; first_touch: number | null; speed_to_lead_hrs: number | null;
  hs_last_touch: number | null; last_touch_actor_id: string; last_touch_by: string; last_touch_channel: string;
  touches_14d: number; touches_180d: number; calls_total: number; calls_connected: number; last_reply: number | null;
  last_opened: number | null; last_clicked: number | null; page_views: number; pricing_visits: number; last_page: string; page_cats: string[];
  post_sqa: boolean; sqa_info: string;
  ov?: Ov; last_touch: number | null; last_by: string; last_by_id: string; last_channel: string;
  bucket: string; prio: number; unhandled: Sig[];
};

function toRow(r: any): Row {
  let sigs: Sig[] = [];
  try {
    sigs = (JSON.parse(S(r.signals_json) || "[]") as any[]).map((s) => ({
      sig: S(s.sig), rnk: N(s.rnk), ts: T(s.ts), detail: S(s.detail),
    }));
  } catch { sigs = []; }
  return {
    contact_id: S(r.contact_id), owner_id: S(r.owner_id), queue_owner_id: S(r.queue_owner_id),
    contact_name: S(r.contact_name), email: S(r.email), jobtitle: S(r.jobtitle), company: S(r.company),
    linkedin_url: normUrl(S(r.linkedin_url)), ae_name: S(r.ae_name), signals: sigs, plan: S(r.plan), org_name: S(r.org_name),
    org_count: N(r.org_count), primary_org_id: S(r.primary_org_id), m_add_data: B(r.m_add_data),
    m_connect_tools: B(r.m_connect_tools), m_share_data: B(r.m_share_data), cpu_7d: N(r.cpu_7d), cpu_prev7d: N(r.cpu_prev7d),
    awr: N(r.awr), trial_end_date: S(r.trial_end_date), lifecycle: S(r.lifecycle), lead_status: S(r.lead_status),
    created: T(S(r.created_ts)), first_touch: T(S(r.first_touch_ts)),
    speed_to_lead_hrs: r.speed_to_lead_hrs == null ? null : N(r.speed_to_lead_hrs),
    hs_last_touch: T(S(r.last_touch_ts)), last_touch_actor_id: S(r.last_touch_actor_id), last_touch_by: S(r.last_touch_by),
    last_touch_channel: S(r.last_touch_channel), touches_14d: N(r.touches_14d), touches_180d: N(r.touches_180d),
    calls_total: N(r.calls_total), calls_connected: N(r.calls_connected), last_reply: T(S(r.last_reply_ts)),
    last_opened: T(S(r.last_opened_ts)), last_clicked: T(S(r.last_clicked_ts)), page_views: N(r.page_views), pricing_visits: N(r.pricing_visits),
    last_page: S(r.last_page), page_cats: S(r.page_cats) ? S(r.page_cats).split("|") : [],
    post_sqa: B(r.post_sqa), sqa_info: S(r.sqa_info), last_touch: null, last_by: "", last_by_id: "", last_channel: "", bucket: "other", prio: 0, unhandled: [],
  };
}

function toOv(r: any): Ov {
  return {
    reviewed_ts: T(S(r.reviewed_ts)), retouch_event_ts: T(S(r.retouch_event_ts)), retouch_on: r.retouch_on ? S(r.retouch_on) : null,
    linkedin_status: S(r.linkedin_status), last_linkedin_ts: T(S(r.last_linkedin_ts)), last_linkedin_actor: S(r.last_linkedin_actor),
    linkedin_14d: N(r.linkedin_14d), last_note: S(r.last_note), last_note_ts: T(S(r.last_note_ts)),
  };
}

// Core workflow logic: merge overlay, decide bucket + priority.
function derive(r: Row, ov: Ov | undefined): Row {
  const li = ov?.last_linkedin_ts ?? null;
  const hs = r.hs_last_touch;
  const liNewer = li != null && (hs == null || li > hs);
  const last_touch = liNewer ? li : hs;
  const last_by_id = liNewer ? ov!.last_linkedin_actor : r.last_touch_actor_id;
  const last_by = liNewer ? bdrName(ov!.last_linkedin_actor) : r.last_touch_by;
  const last_channel = liNewer ? "LinkedIn" : r.last_touch_channel;
  const lt = last_touch ?? -Infinity;
  const signals = r.signals.map((s) => ({
    ...s,
    handled: s.ts != null ? lt > s.ts : (daysSince(last_touch) ?? 999) <= 7,
  }));
  const unhandled = signals.filter((s) => !s.handled);

  let bucket = "other";
  const nowMs = Date.now();
  const rv = ov?.reviewed_ts ?? null;
  // a review counts until a NEW signal (not a future-dated one, e.g. an onboarding call next week) arrives, for 7 days
  const reviewedLive = rv != null && !signals.some((s) => s.ts != null && s.ts > rv && s.ts <= nowMs) && (daysSince(rv) ?? 0) < 7;
  // a retouch only wins if it was set after the latest review
  const retouchLive = ov?.retouch_on && ov.retouch_event_ts != null && !(lt > ov.retouch_event_ts) && !(rv != null && rv > (ov.retouch_event_ts as number));
  if (retouchLive) bucket = (ov!.retouch_on as string) <= todayStr() ? "retouch_due" : "scheduled";
  else if (reviewedLive) bucket = "reviewed";
  else if (signals.length && unhandled.length === 0) bucket = "handled";
  else if (unhandled.length) {
    const fresh = unhandled.some((s) => s.ts == null || (daysSince(s.ts) ?? 0) <= 14);
    bucket = fresh ? "active" : "cold";
  }

  const top = unhandled.length ? Math.min(...unhandled.map((s) => s.rnk)) : signals.length ? Math.min(...signals.map((s) => s.rnk)) + 10 : 50;
  const newest = Math.max(...unhandled.map((s) => s.ts ?? 0), 0);
  const ageH = newest ? (Date.now() - newest) / 36e5 : 999;
  const prio = top * 1000 + Math.min(ageH, 999) - unhandled.length * 5;

  return { ...r, ov, signals, unhandled, last_touch, last_by, last_by_id, last_channel, bucket, prio };
}

// ---- small UI pieces ----
const makeCtl = (): any => ({
  background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}`, borderRadius: UI.radius2,
  padding: UI.game ? "6px 10px" : "5px 8px", fontSize: fs(11.5), fontFamily: "inherit",
});
const ctl: any = makeCtl();
const PANEL = (): any => (UI.game
  ? { background: "#ffffff", border: "3px solid #484848", borderRadius: 8, boxShadow: "inset 0 0 0 2px #e2e2e2" }
  : { ...PANEL() });
const DIALOG = (): any => ({ background: "#ffffff", border: "3px solid #484848", boxShadow: "inset 0 0 0 2px #cfcfcf", borderRadius: 8,
  padding: "12px 16px", fontFamily: UI.body, fontSize: fs(14), lineHeight: 1.6, color: "#303030", position: "relative" });
function applyTheme(theme: string, size: string) {
  const unova = theme !== "terminal";
  Object.assign(C, unova ? THEME_UNOVA : THEME_TERMINAL);
  Object.assign(GB, unova ? GB_UNOVA : GB_CLASSIC);
  UI.game = unova; UI.solid = false;
  UI.radius = unova ? 8 : 6; UI.radius2 = unova ? 6 : 4;
  UI.scale = (unova ? 1.2 : 1) * (size === "s" ? 0.92 : size === "l" ? 1.14 : 1);
  UI.body = unova ? FONT_GAME : "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  UI.pixel = UI.body;
  UI.bg = unova ? "linear-gradient(180deg, #fafafa 0%, #ececec 100%)" : C.page;
  Object.assign(ctl, makeCtl());
}
const btn = (color: string, disabled = false): any => (UI.game ? {
  ...ctl, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? C.faint : C.text, border: "2px solid #686868",
  background: disabled ? "#f2f2f2" : "#ffffff", boxShadow: disabled ? "none" : `inset 0 -3px 0 ${color}`,
  display: "inline-flex", alignItems: "center", gap: 5, opacity: disabled ? 0.6 : 1, fontWeight: 600,
} : {
  ...ctl, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? C.faint : color,
  borderColor: disabled ? C.border : `${color}66`, background: disabled ? C.surfaceAlt : `${color}12`,
  display: "inline-flex", alignItems: "center", gap: 5, opacity: disabled ? 0.6 : 1,
});

const miniLink = (c: string): any => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 18, padding: "0 4px",
  fontSize: fs(9), fontWeight: 700, borderRadius: 3, textDecoration: "none", cursor: "pointer",
  border: UI.game ? "1px solid #888888" : `1px solid ${c}66`, color: UI.game ? "#484848" : c, background: UI.game ? "#ffffff" : `${c}14`,
});

function DialogBox({ children }: any) {
  if (!UI.game) return null;
  return (
    <div style={{ ...DIALOG(), margin: "4px 0 14px", paddingRight: 36 }}>
      {children}
      <span style={{ position: "absolute", right: 14, bottom: 10, animation: "bdrBlink 1s steps(1) infinite", color: "#d84040" }}>▼</span>
    </div>
  );
}

function CommandMenu({ prompt, items }: { prompt: any; items: { label: string; c1: string; c2: string; onClick?: () => void; href?: string; disabled?: boolean; title?: string }[] }) {
  if (!UI.game) return null;
  const cmd = (it: any): any => ({
    fontFamily: UI.body, fontSize: fs(14), fontWeight: 700, letterSpacing: 1, color: "#ffffff", textShadow: "1px 1px 0 rgba(0,0,0,.35)",
    background: it.disabled ? "linear-gradient(180deg, #c8c8c8 0%, #a8a8a8 100%)" : `linear-gradient(180deg, ${it.c1} 0%, ${it.c2} 100%)`,
    border: "3px solid #383838", borderRadius: 999, padding: "8px 10px", cursor: it.disabled ? "not-allowed" : "pointer",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,.45)", textAlign: "center", textDecoration: "none", display: "block",
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 10, margin: "14px 0 4px" }}>
      <div style={{ ...DIALOG(), display: "flex", alignItems: "center" }}>{prompt}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {items.map((it) => it.href
          ? <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer" title={it.title} style={cmd(it)}>{it.label}</a>
          : <button key={it.label} disabled={it.disabled} title={it.title} onClick={it.onClick} style={cmd(it)}>{it.label}</button>)}
      </div>
    </div>
  );
}

function Chip({ label, color, count, active, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, fontSize: fs(11),
      fontFamily: "inherit", cursor: "pointer", border: UI.game ? `2px solid ${active ? "#3878c8" : "#b8b8b8"}` : `1px solid ${active ? color : C.border}`,
      background: UI.game ? (active ? "#dce8f8" : "#ffffff") : active ? `${color}22` : C.surface, color: UI.game ? C.text : active ? color : C.muted,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      {label} <b style={{ color: C.text }}>{count}</b>
    </button>
  );
}

function SignalTag({ s, dim }: { s: Sig | string; dim?: boolean }) {
  const name = typeof s === "string" ? s : s.sig;
  const handled = typeof s !== "string" && s.handled;
  const m = sigMeta(name);
  const I = m.Icon;
  return (
    <span title={handled ? "Touched since this signal" : "Unanswered"} style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: fs(10.5), padding: UI.solid ? "2px 9px" : "1px 7px", borderRadius: UI.solid ? 999 : 3,
      border: `1px solid ${UI.game ? "#9a9a9a" : m.color + "55"}`, color: UI.game ? C.text : m.color, background: UI.game ? "#ffffff" : `${m.color}14`,
      fontWeight: UI.solid ? 700 : 400, whiteSpace: "nowrap",
      opacity: handled || dim ? 0.45 : 1, textDecoration: handled ? "line-through" : "none",
    }}>
      <I size={11} color={m.color} /> {name}
    </span>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: fs(9.5), letterSpacing: 0.8, textTransform: "uppercase", color: C.faint }}>{label}</div>
      <div style={{ fontSize: fs(13.5), fontWeight: 700, color: tone ?? C.text, fontVariantNumeric: "tabular-nums" }}>{value || "—"}</div>
      {sub && <div style={{ fontSize: fs(10), color: C.faint }}>{sub}</div>}
    </div>
  );
}

function Milestone({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(11.5), color: done ? C.text : C.faint }}>
      <span style={{ width: 12, height: 12, border: `1px solid ${done ? C.accent : C.border}`, background: done ? C.accent : "transparent",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: fs(9), color: C.page, fontWeight: 800 }}>
        {done ? "✓" : ""}
      </span>
      {label}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10 }}>
      <div style={UI.game ? { fontSize: fs(11), letterSpacing: 1, color: C.muted, marginBottom: 10, fontWeight: 700, textTransform: "uppercase" } : { fontSize: fs(10), letterSpacing: 1, color: C.accent, marginBottom: 8 }}>{UI.game ? "" : "// "}{title}</div>
      {children}
    </div>
  );
}

function BdrMultiSelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const all = selected.length === BDRS.length;
  const label = all ? "All BDRs" : selected.length === 1 ? bdrName(selected[0]) : `${selected.length} BDRs`;
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next.length ? next : [id]);
  };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ ...ctl, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
        Queues: <b>{label}</b> <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 20, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: UI.radius, padding: 8, minWidth: 210, boxShadow: "0 6px 20px rgba(0,0,0,.5)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={{ ...ctl, cursor: "pointer", flex: 1 }} onClick={() => onChange(BDRS.map((b) => b.id))}>All BDRs</button>
            <button style={{ ...ctl, cursor: "pointer" }} onClick={() => setOpen(false)}><X size={12} /></button>
          </div>
          {BDRS.map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: fs(12), padding: "4px 2px", cursor: "pointer", color: C.text }}>
              <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
              {b.name}
              <span onClick={(e) => { e.preventDefault(); onChange([b.id]); }} style={{ marginLeft: "auto", fontSize: fs(10), color: C.accent, cursor: "pointer" }}>only</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiPick({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ ...ctl, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: selected.length ? C.accent : C.text }}>
        {label}: <b>{selected.length ? selected.join(", ") : "any"}</b> <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, ...PANEL(), padding: 8, minWidth: 200, boxShadow: "0 6px 20px rgba(0,0,0,.5)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={{ ...ctl, cursor: "pointer", flex: 1 }} onClick={() => onChange([])}>any</button>
            <button style={{ ...ctl, cursor: "pointer" }} onClick={() => setOpen(false)}><X size={12} /></button>
          </div>
          {options.map((o) => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: fs(12), padding: "3px 2px", cursor: "pointer", color: C.text }}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])} /> {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: fs(10.5), color: C.faint }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...ctl, cursor: "pointer", padding: "4px 6px" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

// ---- Contact card with actions ----
function Card({ r, acting, busy, onAct, runMsg }: { r: Row; acting: string; busy: boolean; onAct: (t: string, extra?: any) => void; runMsg: string }) {
  const [note, setNote] = useState("");
  const [days, setDays] = useState("5");
  const canEdit = r.queue_owner_id === acting;
  const ratio = r.cpu_prev7d > 0 ? r.cpu_7d / r.cpu_prev7d : null;
  const stl = r.speed_to_lead_hrs;
  const stlTone = stl == null ? C.faint : stl <= 1 ? C.ok : stl <= 24 ? C.warn : C.danger;
  const dsl = daysSince(r.last_touch);
  const touches = r.touches_14d + (r.ov?.linkedin_14d ?? 0);
  const cadPct = Math.min(100, Math.round((touches / CADENCE_TARGET_14D) * 100));
  const overTop = r.last_by_id && r.last_by_id !== r.queue_owner_id;
  const dis = !canEdit || busy;

  return (
    <div style={{ ...PANEL(), padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fs(16.5), fontWeight: 700 }}>{r.contact_name || r.email || "Unknown contact"}</div>
          <div style={{ fontSize: fs(12), color: C.muted, marginTop: 2 }}>{[r.jobtitle, r.company].filter(Boolean).join(" @ ") || "—"}</div>
          <div style={{ fontSize: fs(11), color: C.faint, marginTop: 2 }}>
            {r.email} · queue: <b style={{ color: C.text }}>{bdrName(r.queue_owner_id)}</b>
            {r.owner_id !== r.queue_owner_id ? ` · HS owner ${bdrName(r.owner_id)}` : ""}
            {r.ae_name ? ` · AE ${r.ae_name}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
          <a href={HS_CONTACT(r.contact_id)} target="_blank" rel="noopener noreferrer" style={{ ...btn("#ff7a59"), textDecoration: "none" }}>HubSpot <ExternalLink size={11} /></a>
          {r.linkedin_url
            ? <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ ...btn("#5fb3ff"), textDecoration: "none" }}><Linkedin size={11} /> LinkedIn</a>
            : <span style={{ fontSize: fs(10.5), color: C.faint }}>No LinkedIn on file</span>}
          {r.primary_org_id && <a href={C360(r.primary_org_id)} target="_blank" rel="noopener noreferrer" style={{ ...btn(C.accent), textDecoration: "none" }}>Customer 360 <ExternalLink size={11} /></a>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {r.signals.map((s) => <SignalTag key={s.sig} s={s} />)}
        {r.post_sqa && <span style={{ fontSize: fs(10.5), color: C.faint, border: `1px dashed ${C.border}`, padding: "1px 7px", borderRadius: 3 }}>Post-SQA: {r.sqa_info || "qualified deal"}</span>}
      </div>
      <div style={{ fontSize: fs(11), color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
        {r.signals.map((s) => (
          <div key={s.sig}>
            <span style={{ color: sigMeta(s.sig).color }}>{s.sig}</span>
            {s.ts ? ` · ${fmtAgo(s.ts)}` : ""}{s.detail ? ` · ${s.detail}` : ""}{s.handled ? " · ✓ touched since" : ""}
          </div>
        ))}
      </div>

      <CommandMenu prompt={<span>What will you do with <b>{(r.contact_name || r.email || "this lead").split(" ")[0]}</b>?</span>} items={[
        { label: "DRAFT", c1: "#f08080", c2: "#d04848", title: "Write the next email", onClick: () => document.getElementById(`draft-${r.contact_id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        { label: "RETOUCH", c1: "#f0b050", c2: "#d08820", disabled: dis, title: "Retouch in 3 days", onClick: () => onAct("retouch_set", { days: 3 }) },
        { label: "REVIEWED", c1: "#70c878", c2: "#3e9a4a", disabled: dis, title: "Mark reviewed (r)", onClick: () => onAct("reviewed") },
        { label: "HUBSPOT", c1: "#6aa4f0", c2: "#3a74c8", href: HS_CONTACT(r.contact_id), title: "Open in HubSpot (h)" },
      ]} />
      <Section title="TOUCH TIMELINE">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat label="Created" value={fmtDate(r.created)} sub={fmtAgo(r.created)} />
          <Stat label="Speed to lead" value={stl == null ? (r.first_touch ? "pre-existing" : "not yet") : `${stl}h`} tone={stlTone}
            sub={r.first_touch ? `first touch ${fmtDate(r.first_touch)}` : "no touch logged"} />
          <Stat label="Last touch" value={fmtAgo(r.last_touch)} tone={dsl == null || dsl > 7 ? C.danger : undefined}
            sub={r.last_by ? `${r.last_by} · ${r.last_channel}` : undefined} />
          <Stat label="Last reply" value={fmtAgo(r.last_reply)} tone={r.last_reply && (!r.last_touch || r.last_reply > r.last_touch) ? "#5fb3ff" : undefined}
            sub={r.last_reply && (!r.last_touch || r.last_reply > r.last_touch) ? "awaiting our response" : undefined} />
        </div>
        <div style={{ fontSize: fs(10.5), color: C.muted, marginTop: 6 }}>
          Email last opened <b style={{ color: r.last_opened && (!r.last_touch || r.last_opened > r.last_touch) ? C.accent : C.text }}>{fmtAgo(r.last_opened)}</b>
          {r.last_clicked ? ` · last clicked ${fmtAgo(r.last_clicked)}` : ""}
          {" · "}web: {r.page_views} page views{r.pricing_visits ? ` · ${r.pricing_visits} pricing visits` : ""}{r.last_page ? ` · last page ${r.last_page}` : ""}
          {r.page_cats.length ? ` · ${r.page_cats.join(", ")}` : ""}
        </div>
        {overTop && (
          <div style={{ fontSize: fs(10.5), color: C.warn, marginTop: 6 }}>
            Last touch came from {r.last_by || "someone else"} (not the queue owner) — check before reaching out.
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(10.5), color: C.faint }}>
            <span>Cadence (14d): {r.touches_14d} HubSpot + {r.ov?.linkedin_14d ?? 0} LinkedIn · {r.calls_total} calls ({r.calls_connected} connected) all-time</span>
            <span>target ~{CADENCE_TARGET_14D}</span>
          </div>
          {UI.game ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ background: "#e8b830", color: "#303030", fontSize: fs(10), fontWeight: 700, padding: "0 5px", borderRadius: 3, border: "1px solid #484848" }}>HP</span>
              <div style={{ flex: 1, height: 8, background: "#f2f2f2", border: "2px solid #484848", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${cadPct}%`, height: "100%", background: cadPct >= 100 ? "#48c050" : cadPct >= 50 ? "#f0c030" : "#f05030" }} />
              </div>
            </div>
          ) : (
          <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 3, marginTop: 4 }}>
            <div style={{ width: `${cadPct}%`, height: "100%", borderRadius: 3, background: cadPct >= 100 ? C.ok : cadPct >= 50 ? C.warn : C.danger }} />
          </div>)}
        </div>
      </Section>

      <Section title="TRIAL & USAGE">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat label="Plan" value={r.plan ? r.plan.replace("_", " ") : ""} sub={r.lifecycle || undefined} />
          <Stat label="Trial ends" value={r.trial_end_date} />
          <Stat label="CPU-h 7d" value={r.org_name ? r.cpu_7d.toFixed(1) : ""} tone={ratio != null && ratio >= 3 ? "#ffa94d" : undefined}
            sub={ratio != null ? `${ratio.toFixed(1)}x vs prior wk` : r.cpu_7d > 0 ? "new this week" : undefined} />
          <Stat label="AWR" value={r.awr > 0 ? fmtUsd(r.awr) : ""} tone={r.awr >= 6000 ? "#38d9a9" : undefined} />
        </div>
        <div style={{ fontSize: fs(10.5), color: C.faint, marginTop: 4 }}>
          {r.org_name ? `Org: ${r.org_name}${r.org_count > 1 ? ` (+${r.org_count - 1} more)` : ""}` : "No MotherDuck org linked"} · lead status: {r.lead_status || "—"}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <Milestone done={r.m_add_data} label="Added data" />
          <Milestone done={r.m_connect_tools} label="Connected tools" />
          <Milestone done={r.m_share_data} label="Shared data" />
        </div>
      </Section>

      <Section title="ACTIONS">
        {!canEdit && (
          <div style={{ fontSize: fs(11), color: C.faint, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={12} /> Read-only: only {bdrName(r.queue_owner_id)} can change this contact. Switch "Acting as" if that's you.
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button disabled={dis} style={btn(C.ok, dis)} onClick={() => onAct("reviewed")}><Check size={12} /> Reviewed</button>
          {[3, 7, 14].map((d) => (
            <button key={d} disabled={dis} style={btn(C.warn, dis)} onClick={() => onAct("retouch_set", { days: d })}><RotateCcw size={12} /> Retouch {d}d</button>
          ))}
          <span style={{ display: "inline-flex", gap: 4 }}>
            <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} style={{ ...ctl, width: 42 }} disabled={dis} />
            <button disabled={dis || !days} style={btn(C.warn, dis || !days)} onClick={() => onAct("retouch_set", { days: Number(days) })}>days</button>
          </span>
          {r.ov?.retouch_on && <button disabled={dis} style={btn(C.muted, dis)} onClick={() => onAct("retouch_clear")}>Clear retouch ({r.ov.retouch_on})</button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {[["linkedin_request_sent", "Request sent"], ["linkedin_accepted", "Accepted"], ["linkedin_message", "Messaged"], ["linkedin_reply", "They replied"]].map(([t, l]) => (
            <button key={t} disabled={dis} style={btn("#5fb3ff", dis)} onClick={() => onAct(t)}><Linkedin size={12} /> {l}</button>
          ))}
          {r.ov?.linkedin_status && <span style={{ fontSize: fs(10.5), color: C.faint, alignSelf: "center" }}>
            LinkedIn: {r.ov.linkedin_status.replace("linkedin_", "").replace("_", " ")} · {fmtAgo(r.ov.last_linkedin_ts)}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quick note (stays in the terminal)" disabled={dis}
            style={{ ...ctl, flex: 1 }} />
          <button disabled={dis || !note.trim()} style={btn(C.accent, dis || !note.trim())} onClick={() => { onAct("note", { note }); setNote(""); }}>
            <StickyNote size={12} /> Save
          </button>
        </div>
        {r.ov?.last_note && <div style={{ fontSize: fs(10.5), color: C.muted, marginTop: 6 }}>Last note ({fmtAgo(r.ov.last_note_ts)}): {r.ov.last_note}</div>}
        {runMsg && <div style={{ fontSize: fs(10.5), color: runMsg.startsWith("✗") ? C.danger : C.accent, marginTop: 6 }}>{runMsg}</div>}
      </Section>

      <div id={`draft-${r.contact_id}`}>
        <Section title="DRAFT NEXT TOUCH">
          <DraftBox r={r} acting={acting} />
        </Section>
      </div>
    </div>
  );
}

// =====================================================================
// ==========================  TRAINER (GAME)  ==========================
// =====================================================================
// Original creatures in a Gen 1 style. XP/stats are COMPUTED from HubSpot +
// the touch_events ledger every load, never stored, so rules can change and
// past quarters can be replayed.
const GB_CLASSIC = { d0: "#0f380f", d1: "#306230", d2: "#8bac0f", d3: "#9bbc0f" };
const GB_UNOVA = { d0: "#383838", d1: "#48b858", d2: "#dcdcdc", d3: "#ffffff" };
const GB: any = { ...GB_UNOVA };
const CREATURE_PALS = {
  in: { d0: "#2b2d42", d1: "#f08c00", d2: "#5fa8e8", d3: "#ffe066" },   // duck line: yellow body, blue wing
  out: { d0: "#343a40", d1: "#fd7e14", d2: "#b8c4ce", d3: "#ffffff" },  // goose line: white body, grey wing
};
const palFor = (ob: boolean, shiny: boolean) => (shiny ? SHINY : UI.game ? (ob ? CREATURE_PALS.out : CREATURE_PALS.in) : GB);
// grass pad under the creature, like a DS battle platform
const STAGE = (shiny: boolean): any => ({
  background: `radial-gradient(ellipse 48% 15% at 50% 86%, ${shiny ? "#f0d070" : "#9ad8a8"} 0 66%, ${shiny ? "#c8a030" : "#5aa870"} 67% 80%, rgba(0,0,0,0) 82%)`,
  padding: "6px 18px 24px",
});
const BATTLE_BG: any = { background: "linear-gradient(180deg, #ffffff 0%, #f0f0f0 50%, #dedede 100%)", borderRadius: 6, padding: 12, border: "2px solid #c8c8c8" };
const NAMEPLATE: any = { background: "linear-gradient(180deg, #ffffff 0%, #e6e6e6 100%)", border: "2px solid #484848", borderRadius: "4px 4px 22px 4px", padding: "8px 14px", boxShadow: "3px 3px 0 #b0b0b0", alignSelf: "flex-start" };
const SHINY = { d0: "#3b2500", d1: "#8a5a00", d2: "#e0b030", d3: "#ffe9a8" };
const SPRITE_PEEP = [
  "................",
  "......0000......",
  ".....033330.....",
  "....03333330....",
  "....03303330....",
  "....033333300...",
  "....0333333110..",
  ".....03333000...",
  "....0333333330..",
  "...033223333330.",
  "...032222333330.",
  "...033223333330.",
  "....0333333330..",
  ".....00000000...",
  "......1..1......",
  ".....11..11.....",
];
const SPRITE_QUACK = [
  "................",
  ".....00000......",
  "....0333330.....",
  "...033033330....",
  "...033333330000.",
  "...03333330111.0",
  "....0333330000..",
  ".....033330.....",
  "..000333333000..",
  ".03333333333330.",
  "0333222222333330",
  "0332222222233330",
  ".03322222223330.",
  "..003333333300..",
  "....00000000....",
  ".....11...11....",
];
const SPRITE_MALLA = [
  ".....0.00.0.....",
  "....01011010....",
  "....00333300....",
  "...0330333330...",
  "...033333333000.",
  "...0333333301110",
  "....03333330000.",
  "0....0333330...0",
  "00..033333330.00",
  "0200333333333020",
  "0222332222333220",
  ".02232222223220.",
  "..0332222223300.",
  "...0033333300...",
  "....00000000....",
  "....11....11....",
];

const QUARTERS = [
  { id: "FQ4-2026", label: "Q4 FY27", start: "2026-11-01", end: "2027-01-31" },
  { id: "FQ3-2026", label: "Q3 FY27", start: "2026-08-01", end: "2026-10-31" },
  { id: "FQ2-2026", label: "Q2 FY27", start: "2026-05-01", end: "2026-07-31" },
  { id: "FQ1-2026", label: "Q1 FY27", start: "2026-02-01", end: "2026-04-30" },
];
const DEFAULT_QUOTA = 60;

// XP table (tuned so a quota-pace quarter lands ~Lv 50; Gen 1 "Medium Fast": XP = L^3)
const XP = { sqa: 1000, meeting: 300, connect: 100, call: 2, email: 1, linkedin: 15, hygiene: 5, acctOpen: 20, acctMulti: 75 };
const CAPS = "calls 60/day · emails 60/day · LinkedIn 30/day · queue hygiene 40/day. Calls include Orum dials; connects = Connected, Interested, Not interested, Booked AE meeting, Bad fit, Intro not made";

// ---- XP math shared by the header showcase, Trainer and League, so they can never disagree ----
// Today's XP is split by kind so bars can show where it came from.
const XP_KINDS = [
  // same buckets as the creature stats (HP meetings, ATK calls, SPC emails, SPD LinkedIn, DEF reviews)
  { k: "sqa", label: "SQAs", color: "#e8b830" },
  { k: "meeting", label: "Meetings", color: "#48c050" },
  { k: "calls", label: "Calls", color: "#e04848" },
  { k: "emails", label: "Emails", color: "#ff8c3a" },
  { k: "linkedin", label: "LinkedIn", color: "#0a66c2" },
  { k: "queue", label: "Reviews", color: "#9a6ad6" },
  { k: "accounts", label: "Accounts", color: "#1aa39a" },
] as const;
type XpKind = (typeof XP_KINDS)[number]["k"];
const XP_BASE_COLOR = "#8fa3b8"; // EXP earned before today
const levelOf = (xp: number) => Math.max(1, Math.min(100, Math.floor(Math.cbrt(Math.max(0, xp) + 1e-9))));
const emptyToday = (): Record<XpKind, number> => ({ sqa: 0, meeting: 0, calls: 0, emails: 0, linkedin: 0, queue: 0, accounts: 0 });
function finishXp(xp: number, today: Record<XpKind, number>, counts: any) {
  const todayXp = Object.values(today).reduce((a, b) => a + b, 0);
  const lv = levelOf(xp);
  return { xp, lv, lvFloor: lv ** 3, lvNext: (lv + 1) ** 3, today, todayXp, todayCounts: counts, lvStart: levelOf(xp - todayXp) };
}
function xpOf(r: any, ob: boolean) {
  const xp = N(r.sqas) * XP.sqa + N(r.meetings) * XP.meeting + N(r.connects) * XP.connect + N(r.calls_capped) * XP.call +
    N(r.emails_capped) * XP.email + N(r.linkedin_capped) * XP.linkedin + N(r.hygiene_capped) * XP.hygiene +
    (ob ? N(r.accts_opened) * XP.acctOpen + N(r.accts_multi) * XP.acctMulti : 0);
  const c = {
    sqas: N(r.sqas_today), meetings: N(r.meetings_today), emails: Math.min(N(r.emails_today), 60), calls: Math.min(N(r.calls_today), 60),
    connects: N(r.connects_today), linkedin: Math.min(N(r.linkedin_today), 30), queue: Math.min(N(r.hygiene_today), 40),
    opened: ob ? N(r.accts_opened_today) : 0, multi: ob ? N(r.accts_multi_today) : 0,
  };
  const today: Record<XpKind, number> = {
    sqa: c.sqas * XP.sqa, meeting: c.meetings * XP.meeting,
    calls: c.calls * XP.call + c.connects * XP.connect, emails: c.emails * XP.email,
    linkedin: c.linkedin * XP.linkedin, queue: c.queue * XP.hygiene, accounts: c.opened * XP.acctOpen + c.multi * XP.acctMulti,
  };
  return finishXp(xp, today, c);
}
type XpInfo = ReturnType<typeof xpOf>;
// Terminal clicks that earn XP (credited optimistically until the ledger catches up)
const xpForEvent = (t: string, ob: boolean): [XpKind, number] | null =>
  t.startsWith("linkedin_") ? ["linkedin", XP.linkedin]
    : ["reviewed", "retouch_set", "retouch_clear", "note"].includes(t) || (ob && t === "ae_assign") ? ["queue", XP.hygiene] : null;
const currentQuarter = () => {
  const d = todayStr();
  return QUARTERS.find((q) => q.start <= d && d <= q.end) ?? QUARTERS[0];
};

const SPECIES = [
  { name: "PEEPBIT", map: SPRITE_PEEP, base: { hp: 45, atk: 49, def: 49, spd: 45, spc: 65 }, flavor: "Hatches every quarter. Chirps at anything that signs up." },
  { name: "QUACKRAFT", map: SPRITE_QUACK, base: { hp: 60, atk: 62, def: 63, spd: 60, spc: 80 }, flavor: "Has learned that a follow-up is worth ten first touches." },
  { name: "MALLAGON", map: SPRITE_MALLA, base: { hp: 80, atk: 82, def: 83, spd: 80, spc: 100 }, flavor: "Its call can be heard three Slack channels away." },
];

const MOVES = [
  { lv: 1, name: "COLD OPEN", type: "NORMAL" },
  { lv: 5, name: "FOLLOW-UP", type: "NORMAL" },
  { lv: 10, name: "QUICK REPLY", type: "ELECTRIC" },
  { lv: 16, name: "DISCOVERY CALL", type: "PSYCHIC" },
  { lv: 22, name: "MULTI-THREAD", type: "BUG" },
  { lv: 30, name: "OBJECTION PARRY", type: "FIGHTING" },
  { lv: 38, name: "CHAMPION BOND", type: "FAIRY" },
  { lv: 46, name: "PIPELINE SURGE", type: "WATER" },
  { lv: 55, name: "EXEC SPONSOR", type: "DRAGON" },
  { lv: 65, name: "CLOSE PLAN", type: "DRAGON" },
];

function gameSql(bdr: string, qs: string, qe: string) {
  return `WITH params AS (SELECT '${bdr}' AS bdr, DATE '${qs}' AS qs, DATE '${qe}' AS qe),
roster AS (SELECT unnest(['80047418','83119213','87409788','88175764','80568243','89400805','89400804','94189105','95288851','95672339','96069408','102299028']) AS id),
sqa_base AS (
  SELECT d.hs_object_id::VARCHAR AS deal_id,
    TRY_CAST(d.first_date_qualified AS DATE) AS qd, COALESCE(d.deal_source_type,'') AS src,
    CASE
      WHEN d.bdr_owner IN (SELECT id FROM roster) THEN d.bdr_owner
      WHEN COALESCE(d.deal_source_type,'') = 'Outbound' AND TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01'
        AND CAST(d.hs_created_by_user_id AS VARCHAR) IN (SELECT id FROM roster) THEN CAST(d.hs_created_by_user_id AS VARCHAR)
    END AS credited,
    (SELECT MIN(CAST(dca.company_id AS VARCHAR)) FROM "mdw"."hubspot"."deal_to_company_associations" dca
      WHERE CAST(dca.deal_id AS VARCHAR) = d.hs_object_id::VARCHAR) AS company_id
  FROM "mdw"."hubspot"."deals" d, params p
  WHERE d.first_date_qualified IS NOT NULL
    AND TRY_CAST(d.first_date_qualified AS DATE) BETWEEN p.qs AND p.qe
    AND (
      (TRY_CAST(d.first_date_qualified AS DATE) < DATE '2026-08-01' AND COALESCE(d.tags_stamped_at_deal_qualification,'') <> 'Growth Account')
      OR (TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01' AND (
            COALESCE(d.segment_stamped_at_deal_qualification,'') IN ('SMB','MM','ENT')
            OR (COALESCE(d.segment_stamped_at_deal_qualification,'') = 'Micro'
                AND lower(COALESCE(TRY_CAST(d.is_focused_stamped_at_deal_qualification AS VARCHAR),'')) = 'true')))
    )
    AND (COALESCE(d.deal_source_type,'') <> 'Outbound' OR (
          TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01'
          AND (d.bdr_owner IN (SELECT id FROM roster) OR CAST(d.hs_created_by_user_id AS VARCHAR) IN (SELECT id FROM roster))))
    AND (d.pipeline = 'default' OR COALESCE(d.needs_intro_meeting,'') = 'Yes')
    AND COALESCE(d.dealtype,'') <> 'existingbusiness'
),
sqa AS (
  SELECT deal_id, qd FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY COALESCE(company_id, 'deal:' || deal_id) ORDER BY qd, deal_id) AS rn
    FROM sqa_base, params p WHERE credited = p.bdr
  ) WHERE rn = 1 AND src <> 'Outbound'
),
mtg AS (
  SELECT TRY_CAST(d.createdate AS DATE) AS dd FROM "mdw"."hubspot"."deals" d, params p
  WHERE d.bdr_owner = p.bdr AND TRY_CAST(d.createdate AS DATE) BETWEEN p.qs AND p.qe
    AND (d.pipeline = 'default' OR (d.pipeline = '690099850' AND d.needs_intro_meeting = 'Yes'))
    AND COALESCE(d.deal_source_type,'') <> 'Outbound'
),
apollo AS (
  SELECT ct.hs_object_id AS contact_id, lower(trim(ct.email)) AS addr FROM "mdw"."hubspot"."contacts" ct, params p
  WHERE ct.hubspot_owner_id = p.bdr AND (ct.contact_source_label = 'Apollo' OR ct.hs_object_source_detail_1 = 'Apollo Integration')
),
em AS (
  SELECT TRY_CAST(e.hs_timestamp AS DATE) AS dd, COUNT(*) AS n FROM "mdw"."hubspot"."emails" e, params p
  WHERE e.hubspot_owner_id = p.bdr AND e.hs_email_direction = 'EMAIL'
    AND TRY_CAST(e.hs_timestamp AS DATE) BETWEEN p.qs AND p.qe
    AND NOT EXISTS (SELECT 1 FROM apollo a WHERE COALESCE(a.addr,'') <> '' AND contains(lower(e.hs_email_to_email), a.addr))
  GROUP BY 1
),
cl AS (
  SELECT TRY_CAST(c.hs_timestamp AS DATE) AS dd, COUNT(*) AS n,
    COUNT(*) FILTER (WHERE c.call_disposition_label IN ('Connected', 'Interested: follow up', 'Not interested', 'Booked AE meeting', 'Bad fit', 'Intro not made')) AS conn
  FROM "mdw"."hubspot"."calls" c, params p
  WHERE c.hubspot_owner_id = p.bdr AND TRY_CAST(c.hs_timestamp AS DATE) BETWEEN p.qs AND p.qe
    AND c.call_id NOT IN (SELECT cca.call_id FROM "mdw"."hubspot"."call_to_contact_associations" cca WHERE cca.contact_id::VARCHAR IN (SELECT contact_id FROM apollo))
  GROUP BY 1
),
ov AS (
  SELECT CAST(t.event_ts AS DATE) AS dd,
    COUNT(*) FILTER (WHERE t.event_type LIKE 'linkedin_%') AS li,
    COUNT(*) FILTER (WHERE t.event_type IN ('reviewed','retouch_set','retouch_clear','note')) AS hyg
  FROM "bdr_terminal_gamified"."main"."touch_events" t, params p
  WHERE t.actor_bdr_id = p.bdr AND CAST(t.event_ts AS DATE) BETWEEN p.qs AND p.qe
    AND COALESCE(t.contact_id::VARCHAR, '') NOT IN (SELECT contact_id FROM apollo)
  GROUP BY 1
)
SELECT
  (SELECT COUNT(*) FROM sqa) AS sqas,
  (SELECT COUNT(*) FROM sqa WHERE qd = current_date) AS sqas_today,
  (SELECT COUNT(*) FROM mtg) AS meetings,
  (SELECT COUNT(*) FROM mtg WHERE dd = current_date) AS meetings_today,
  (SELECT COALESCE(SUM(n),0) FROM em) AS emails,
  (SELECT COALESCE(SUM(LEAST(n, 60)),0) FROM em) AS emails_capped,
  (SELECT COALESCE(SUM(n),0) FROM em WHERE dd = current_date) AS emails_today,
  (SELECT COALESCE(SUM(n),0) FROM cl) AS calls,
  (SELECT COALESCE(SUM(LEAST(n, 60)),0) FROM cl) AS calls_capped,
  (SELECT COALESCE(SUM(conn),0) FROM cl) AS connects,
  (SELECT COALESCE(SUM(n),0) FROM cl WHERE dd = current_date) AS calls_today,
  (SELECT COALESCE(SUM(conn),0) FROM cl WHERE dd = current_date) AS connects_today,
  (SELECT COALESCE(SUM(li),0) FROM ov) AS linkedin,
  (SELECT COALESCE(SUM(LEAST(li, 30)),0) FROM ov) AS linkedin_capped,
  (SELECT COALESCE(SUM(li),0) FROM ov WHERE dd = current_date) AS linkedin_today,
  (SELECT COALESCE(SUM(hyg),0) FROM ov) AS hygiene,
  (SELECT COALESCE(SUM(LEAST(hyg, 40)),0) FROM ov) AS hygiene_capped,
  (SELECT COALESCE(SUM(hyg),0) FROM ov WHERE dd = current_date) AS hygiene_today,
  (SELECT COUNT(DISTINCT dd) FROM (SELECT dd FROM em UNION SELECT dd FROM cl UNION SELECT dd FROM ov)) AS active_days
`;
}

const quotaSql = `SELECT quarter_id, bdr_id, sqa_quota, ob_sqa_target FROM "bdr_terminal_gamified"."main"."bdr_quotas"`;

// ---- Team creature art (from the team's sprite sheets; transparent, palette + run-length encoded) ----
// 2x-detail versions of the team art
const PIXEL_ART_HD_A: Record<string, { w: number; h: number; p: string; r: string }> = {
  Default_in_1: { w: 38, h: 51, p: "fedd71,feda69,fed967,f2b853,e5953f,f38431,c27c39,9f5d34,8b5a38,6e412c,401621,160425,110323,0f0222,0d011f", r: "10.2o2n2o2n2m18.|8.2ml6j2ijl2m15.|7.3m2j7ijk2mn14.|6.2nj2i2e9ij2o13.|5.onji3e12ilm12.|4.noj3ig14iln11.|4.m12ig4c4in11.|3.mg2b8i7cbe2iko10.|3.n2cbe6icb8c2ijo10.|2.ol2cbe6i2cbc4b2cdij2l9.|.2oe3cb5i4c4b5cjklm8.|.2leoldc4ib3cen2led3cbejmn8.|.3laoec4i3bcoak2ok2c2bej2m8.|.2lmaolc4i4bnalo2m4bejlm8.|.n4mlc4i4b6m4cdjlm8.|.omj3lh4j2c2blmlj2l4cdj2m8.|omfe3lg4f4ce3lj3f2cdj2m8.|nlfejkifd3fh4c3d4f2cdk2m8.|2lfe2j2e5fk2c4b4f2cek2m8.|2lekf2d7fk5c4b2eg2m9.|mnhkj7fjkg7cbc2eho10.|.mle9ke3b6c3eko10.|2.2le6khec5bc4e2kl6.2l3.|4.ol2h14ejlm4l3.3ln2.|4.olkig12e2jkm6lmljklo.|5.3mk3h6eghjklk4j3lm3iko.|4.3lj10ed3ji2h3i2h2jk3ijl|2.moh2jb3c2b5c7hi2kjih6jl|2.lk2ia2b2c7b7hi2k2ji6jl|.2lhk2bcbc8b8h2c2jk6jm|o2hjgb2cec8b2hi6h4cl5jo|n2hka2cg2c8bhiji5hb2c2hk3j2o|l2hlb2cgc9bhi2k5hbc3hl2jg2o|l2hl3cbgabea2b4cg2ki3hgd5i2leo.|l2jm2c2bagd3b5cbhikj3hj4i5l.|nl2me3ba3bcb2c4bah3kji4jki2jl2.|.2mle2a5bcb2c5bdjklk3j2klhikl2.|3.lh2dbcbc7bcbd2eh2k5l2g2l3.|4.mg2ed8b2c13elo4.|4.mlg2edba5b2d12eg2o4.|4.mok4eab4c12eghmo5.|5.omlh18egj2lo6.|7.3ljhg10e2gk4l8.|8.momjh10eg2k3o9.|9.no2m5lm3o2lkjm11.|6.on2li2h2o7.nl2hl11.|5.2ng5hmo6.2oj2hl11.|5.2l2f3hklm4.2lmlh2fo11.|5.mlmn4ol4.mlh5f2o10.|18.2l3f2hf2o10.|19.4m4o11." },
  Default_in_2: { w: 54, h: 70, p: "f2e0b1,d2b290,3ea148,2c9743,b78566,928583,598668,945e3e,775c53,74463d,22534d,2f273a,0c022d,09012a,070125", r: "12.3m2n2mn4o30.|10.on2m8kon2m28.|9.2on2m7dk4m28.|8.3od6c6dk3m26.|7.m2kd8c7d2ko25.|6.omk2d8c7d2kl25.|5.2ok2d8c10dk2m23.|4.2no3d7c11dk2mn22.|4.2mk22dk2o22.|4.2mk22dk2o22.|3.3m23dk2o22.|3.4m11dk3ok6dklmo21.|3.n2mbm10doklnm6d2kln21.|3.3oao10do2a2o6d3km21.|3.4on10d3n2o6d3km21.|3.2o3nl4jl4dm4n6d3km21.|3.nm3o6j4d5m6d3km21.|2.2m2doleba2bej3dk3mk6d3km21.|2.2m3dh3ae2bh13d4km21.|2.2m2kj3ablebej12d3kln21.|2.onk2j2a2bl2be2j10d3kl2o21.|.3o2ha8b2ejk7d4k2o22.|2om11behjlk6d4k2no22.|2m2be6b2eh3l2k5d5k2m23.|2m2bjh5be2h2l4k3d6km24.|.2m3j5e3ml13ko25.|2.3m6o15kmn19.3m4.|8.2on15k2n19.3mo3.|8.2o15kl2nmno2n2mn7.3m.m2io3.|7.n2l7k4d2kf2a2m2i4j2lon2m2.2mil2m2ilm2.|6.2mk2a8dg6a2mj8fimn2on4im3im2.|5.onm3a8d7amlj8f2i2nom4im3im2.|4.3oe15a2f2lj4f5b3fj3mikl4in2.|3.3m2h2b9a2bj4l3f6b8fkl5ilo2.|3.ml16h2j2li2f4b11fai6lm2.|2.2m19hjli2f4b9f2jai6l2m.|.onj2hj16hjl3fb12f2jalk2i4l2m|m2nh2j16hlji15f3jl4i2lbamn|2m2h2j16hlji14fi3jl3ik2l2a2o|ml2h3j8h2j5hlji14f2j2al3i3l2an.|ml2h4j3hj2hj7hl3i14fa2lk6la2m.|nlj2h3j2h4j8h3l2i8f5ia3l3il2f3m.|nlj3h8j7hj3l3i6f5iba3l2i2lik2m2.|ml2j4h3j10hjf2l14i2a2l2i3lklno2.|3mj15h3jb2flkj11ial3i3lfmno3.|.2m3j12h4j3bf3l7if2a2l2i3lfi2m4.|.2m3j12h4j3bf3l7ifag2l2k2l2fi2m4.|.nol7j3h7j5b2f4l2k3ak6l3fnm5.|2.2o15j8b3fik7l2k5f2o6.|3.on13jf10b2f2i3k5i4flmo6.|3.n2mi11j11b15f2lm7.|4.3mf2i7j11b13f2i3o8.|5.2mnig9f6b15fimno10.|6.n2og10f4b15fgi2mo10.|7.3ok26f2il3m11.|9.o2m2li19f2imn3o13.|12.mn2o2ki9fifik2on2mno15.|13.4ok2i7f2igkl4o18.|15.2o2n3mn4on3mlh2o19.|16.ol2j2m7.ml2h2n19.|11.3o2mnjhjon7.n3h2m19.|11.2no3m3h2o7.n3hno19.|7.3n2o2h4e2hjo6.2o3e2o19.|7.nj6eh2e2h2o4.2mj5e2m18.|7.o2l2h2eh3ehlo4.nmjh6emo17.|8.2on2mje2h3m4.on3bh2eh3e2o16.|12.5o6.2oeb3e2b2e2bmo16.|23.n4omb2em3o2n16.|24.n3onhel6o16.|28.o2no22." },
  Default_in_3: { w: 79, h: 86, p: "e9c88f,bd8f69,1ca767,188a5e,a0694c,895c42,685844,724133,5b3631,4b2d2e,321724,0c2338,0b022c,090128,080026", r: "28.nmn48.|28.3m19.3m26.|27.2mfmo18.2mgm25.|27.2mfgm17.on2gm25.|27.2ofgm3.2om11.2obgo25.|27.oefgm.2m2co10.mn2bgo25.|26.mejijn2m2cdm.3o6.mf2bgo25.|25.2mel2monl2cdm.3o5.2mfbegn25.|23.3mbm2dmn2c3d2m2do.2onmgfb2egm25.|22.2maegn2cm2c2d2lmd2lmn2o4b2ef2m25.|21.ongbfjd2clc3d5l2mg5be2gim26.|21.2obekm3c5d4l3mb2a2b2e2ijo26.|21.o2e2lmc3d8l2mf4b3gi2o27.|20.2mg3lmc2d3l5dl3dl2b3gj2o3m25.|20.2mgl2dmcd3l6dl3dlde2gij2n3m25.|20.3mdcdmd3l12d2lgi2g3bfn25.|20.ml2d2cdl3d3c11dl3e2gio26.|19.ol2d4cd6c10d2l2i4m27.|18.2o3d4cd6c9d3li2o3m27.|17.2nl3d9c11d3ln2o30.|17.2mdc3d6c4d3c8d2lmo30.|17.2mldc3d4c4dc2d6l4d3l4on25.|17.3m2dc9d2cdo3mnol4d3l4om25.|17.onaml9dc2dn3ob2m5d3ldc2dm25.|13.3m.2o2adl10dlma2oa2m5d2l4dm3.2mno19.|12.2o2m.nm2a2l9d2lmgmoa2m10d2m3.2mkmo18.|12.2obo.ona3m8dlm2on2maml8dl3m3.o3bo18.|10.mnobio.2oahjm3h3ijdl2mi2kha2l6d2l2omn4.o3b4mn13.|9.3mefk3o2dnkjb3abefdl2m3hal4c8dmn4.mgfbeimn2o12.|9.2mhe2h3o2dnkjb3ab2e2dlm2heal4c3dl4dlo4.mgf3e2fjkon10.|8.m3f4h2ol2dgh3a4bj7d4c4d4l2m4.nmgf4h4f2m9.|6.2o2fh3k2hmnolifbabei3be3j11d3l2n6.ogfh5ki2hf2m8.|6.o3hji2jih2mnfe3a7behil9d4lmo6.o2f3k2jg3jhf2mo6.|5.oi2hkgf2ikh3me3a9bfhl8d2l2d2lo5.mn2f2k3if3kh2fno6.|4.no2hk4fik2mh4a8bfh2jl4d6l3mn6.mk2fkf2kg3efk2hf2o5.|4.m2fk5f2kne2b2k6be3hm12ln9.nmfijkbfike3bejkifnm4.|3.2mhkg2fbei2k2oeh2je4bef2jim11l2o8.2omfijgbefk2e3bfij2h2m3.|3.mhik2f2b2ik2fo2n2e2j3hio3n12lno8.2ofh2k3efkhf3b2ekhf2m3.|2.2ohk2f3b2ik2fkn9mn14lo9.2o2f3ke3bekf5bek2f2n2.|.2oikie4b2ikfbf2k2jkm2a3m6l5d3l2o6.2mk2h2kgf5bkh6bfkhkm2.|.2oikf5b2ifebefk3jm2a3m6l6d2l2n5.2mkj2h2k2f5bih6bfgjhmn.|.2nik5bhijf3befk3j4m12d3am3.2onm2ih3k2fe5beh7bek2fn.|mihkf2onmj2hj6bfnk2jmba7dc6ai3mn2kj3i2kgfe8bi3b2onm2bjhon|m2jkm3o2m2hj6bfg2kmjb13ab2ij3mk3j3kgf2e2bi2j3bj2bmnon3m2jnm|mkjkm4.mk2ib3mfbfgjmog13abh3ik2mij5kg2e2bf3oi2bjg2m4.mn2jim|m2km6.o2j6mb2kojifb7ab6fi3kj3mnmkf3e3m3aj2oi2m7.njim|2mo7.o3n3.5mj16fh2i5f2hjnonek2m7aonm9.m2n|2m8.n2o5.4mi16f2ih6fh2jnkf3m6ae2on9.n2o|17.2mhmkh16f2i10fhj3m6agn2o13.|16.onhmjh2b14fih14f3m4am2kh2o12.|15.onkhm2hbh2fb3feh6fi13fh2fi3m2okjhjn2o11.|15.okihm2hbhf2b3fehb5fi13fh2fi3mnokihjmno11.|14.2nfhko2fif4b3f2b5fmg13fj2kionmihijm2jo11.|14.mk2foh4fifbhfe2b6fmg16f2kmn4k2hin11.|14.mk2fohi4f2h4fb5finjh9fhih3fki2km3i2hjm11.|14.mk2iohji4fi4fb5finji9fh2i2fikhikn5i2m11.|14.2m2iohjifi4fh8fimkji9fhj4k3hko4km12.|14.nm2iohfh2j4fjh6f2ifmn2i3f2ij5i2ki4knkhiom12.|14.on2jni2h2fi2fjh5f4ib2jk7ik4i2k3h2jmjhj2o12.|14.onkjmi2h2fjhfj6f4i2bim7ik4i2k4hjm2hko13.|15.n2km4i2fij2fhif5i4bimj6i10kmghgmo13.|16.2mkm4i3f9i5bejknj4ij2kj2hijkm2gh2m14.|17.mkoj3i3f8if5behj2kj3ij2kj3ij2khgk2m14.|18.2of13ih8bef2om4k4j2oj2h2km15.|19.onke9ihe9be2fgij2m3n2m4hk2o16.|20.2mi2e6ig11b8e2fji2ghgjno17.|20.2mk2ef5if10b11ei3hg2jm18.|21.3o3e2ihe8b14ei3hk2m19.|23.2of6ef18ef4im2n20.|24.nm2j13ei8efij2n3m21.|25.2mjef11ei8e2ij3o23.|27.2omki10eif5ei3m26.|29.o2m3k2j2h2i2hijh3ko2n27.|30.mokhk3mnon4moi2h2o28.|31.o2himn4o3n2o3h2o28.|28.n3o2ehmn8.nh2emn28.|27.2m3o2efkm8.oj2e2m28.|23.3onme3b3ef2m7.ojeb2m28.|21.noiefe3b2fb3e2o5.onm3beko27.|21.2o3ebeh4bejo6.ojh5bfko26.|22.2njhehf2behko6.ojhe4b2efm26.|23.2o2no2bf3mn6.o3bfe2bf2bmn25.|27.4on8.m2b2fe2bf3ebo25.|40.3mn2o2bonm2no25.|40.o4nmbk5on25.|45.mn2o30." },
  Default_out_1: { w: 40, h: 54, p: "f1f6f8,eef4f7,edf3f6,edf2f5,e5eaef,c6c5d0,bebeca,bcbbc8,b3a19e,8c7c87,6a4047,150c35,09032e,07012a,070029", r: "11.2m2o.o2m21.|10.mkd3of3m20.|9.nmfbdondi2m20.|8.2o2m2abh2af2m3on15.|7.omlhdhf5acgi2n2m14.|6.m2i4dc3b2c4dei2m13.|5.mjh16dgjm13.|4.2mhabc4dc8db2f2m12.|3.nmja2bcd2cd2cdc4dc2agj2m11.|3.ond7cdc7dcba2gmo11.|2.nkj2d8c5d2c4bgjko10.|2.mjhfd8cdc2dc4b2c2hjo10.|2.m2fh4d3cd2c4d2b4dg2hn10.|2.mkf2m5dc2dbh4mh3dc3g2m9.|2.n2mam8dcmaf2moe2db3gjm9.|2.2no2mac4d2cb5mn2dca2fgim9.|.mk2n2m2f3kf2ba4mkmc2b2afgino8.|2mij3m2j3kif2b2mnmkl2b3cg2h2n8.|ojc2fmok4iki2dhm2lohdb2cd2hinm8.|oj2abdk4iki2kdb2a4dc3bghjom8.|mjabdk8i2k2abc4dcb2fgkn9.|mlhdek7i3k2b4c3de2gjkm9.|mlhfe10kfa4cbc2d2h2jm10.|.2o2faf6kjg2acdcb2ac2hjno11.|2.3mhg4h2gf2d3cdh3gfjmn2o10.|3.3mj2h6g3h4ghj2k2j2km4.2mn2.|4.mnlkj3i8g2i8jk2mon2kl2.|4.3n3k2j7gh3jihi5j2mnohijm.|3.n2mjg4h8g5h2gi4j2ki3hm.|3.2mj2abdf2h2g5ad3hg3abg2ji2h3gjm|2.m2j3ab4d8bd2h2a2b2dh3k2g2hjo|.mlj2fb2c2dc9bd2ga2b2cbeh3j2h2jn|.mk2fg2dfhd6b3ca3g2bc3ba3hkh3jm|.mh2fhdifc4a4bcba3h2c3b3afhk4jm|.nhjk2difbi3a3bc3bejkdb4ahjhgfk3jm|.oi2kdcafij2abidbc2bcd2kf3abc2dikiki2jo|.oj2kb3aijfdfed2c4bijf2abc3dikjk2ikn|.oj2k5afjifd2c4bagik2fecbh2jhk3jn.|.m3kh3abc2d3c6bghikig4fj2kijko.|2.m2khfa2b5c6bc2fhj8kji2n2.|2.2mkjh2fed2c2ba3b2c2f2ghg6j2ij2m2.|3.2mk2hgf2e4abcd2ef5gh7jlm3.|4.no4h2fe2facd2fh4g5h3i2jm4.|5.on3h6g5h4g4h5in5.|6.nkj5g8h4ghi4jkm6.|7.m2lji11h3g2i2jlno7.|8.lm2l2j4h3g3hjl2k3mo8.|9.mnol2j2h4g2h2j2k4m9.|11.2olk4mn5o2km12.|9.3o4km5.2om2kn12.|8.2oj4k2m4.n2o3ko12.|8.nm3k2lom3.ml5ko12.|8.5m2o5.m2j2i2ko12.|20.3m2n2o13." },
  Default_out_2: { w: 88, h: 77, p: "f9ffff,f6ffff,f4ffff,ecf1f6,d4d1de,cdc6d5,c9c5d7,ccbfc9,b9b5ca,cc8a65,7e7995,834648,130834,09022d,080028", r: "32.4n6o46.|30.nmida5cgkmn44.|30.mki2ab2cb2afmno43.|28.2o2d4a2b4acn2o42.|28.oedcb7ab2cfmnm41.|27.mg4c2b3a3e3cefn41.|27.mej3l2cbag2nkgc2aelm40.|26.nmej3lj3ci2nog4alo40.|25.2nm5jl3coc2nf3abgo40.|25.2ol5jl2ac3onga2bcgo40.|25.2ol6jlja3no4cbfn36.o3n|4n21.2o7j2la3db4cbfn35.o2i2n|2nmn2o19.nm7j2l5ab4cgn34.nli2co|niei2om17.3m3jlm2j2l2cb4a2bcgo32.onkeacio|oi2cdkmn15.2ml10jl3cb3ae2go28.n3ofc3ailn|o2kc2a2k2o12.2o13jl3cb2aefgn26.2n2me5ce2n.|.nkge2acd2o2n9.o9j5li4cg3fkm22.n3okc4abcfgo2n.|2.n2gd3c4n9.n9j5lid2cd4gkm21.3nolic4abfgk2o2.|3.o4gcb2ek2n2m5.n6j6lk10gn13.lm.2n4oneab5cb2eik2n3.|3.2o4g5ak4o4.4n3o3nmf9giko11.2o3nmkab3cb4ac4gkmnm2n2o|.2nm2n2g3fcb3ceio3n.4n3o2n3m3ki5g2ko10.3oic5a2b2c2g3f2gk2mki2admn|.nm2gkl2kf2gikd3cbekmn9.2mnmk7gkmo9.nli4c5a3k4g3kf4c2aimn|.ongfiklk2g2ikedc2a2ekn11.2ok7gln10.miab6cai3ki3g2k2eab3ca2n.|.2nfe2fgi2ki2g2kie2a2cmn10.nk8gln9.nk3abcei3k2d2akig2cb4adei2on.|3.n2f7gkg2fkg2c2an9.o2i3g3cafln9.o5a3ke2c3aekgd4cademn2o3.|4.2n7gk3fgke3ak2n7.o2gf2a4ckmn7.2ok2c2akige5c2ke2d2eghk4n5.|4.3o2k3gfi2k2fgiebcd2o6.okgdc2ab3ckmo7.2nd3ckg2f2e2i2k2igfek2m6nm4.|5.o2nk4gf2ki2fkie2cmo6.ok3cb4ac2o7.2mka2chk2g3fi3ki3gfkm2n2o2nmn4.|4.o3nmkl2kg3fkfi2k2ekmo5.od4cb3af2n7.ni2aceik2gc4acdkg2c4ab3cdln4.|4.ogf8g2k2gi2k3el2n2.2nka2b4cbafmn6.oke3a2k3gcb3a2ek4cb4ace3o4.|4.nm9g2ki2e2ik3ei2m3n2a4b4cg2n5.2odb2aki3ge2gi4k3d4cbagmn2o5.|4.n2m2i7gk4i2k2e2dkm2ni7b3cg2n4.noi2cbdkf2ged2e2i2kf3e6k2mn7.|5.n2om7gi6kge2delnkgc2bc5bcgno3.2mn3cdekfgfd5ck4f2m2n3o2n8.|8.3nm2n3kgk3gikf3elke3c8bgkm3n2iabc2ek4gef4ck4a3ck3n10.|10.3n5gk2g2f2k2i2k2a11baglnkec3ae2k4g2ai4ke5a3cd2no9.|9.2n8g2ki2f3kld3a10bce2k3cbaeki5gi2c2k4ge4d2e2g2o9.|9.no8gi2k2f3kl2c12bcekda3cdek2f3g2i2d2k4gie5i2kn10.|9.2o7gkfikgf3k2c14bkcb2acdgk2g2fb2c4kg3cdek3nm3no10.|11.3o2n2mf3g2kl2i2c17b2a2ek4giea2ci2gf4c2amnm15.|15.nmf2g2kgilgc19baf2k3ge2d4kid2ekg2c3amn15.|14.nm3g2kig2kecg2a16baf2k2gk2edkigf3deg5o3n15.|14.ni3gki2g2k2cgd2a15ba7g2ek2fg4dgmn4on16.|14.3n3o3gn3cei4a13bc6g3kg2eki4din21.|16.4o3gm2a2bdieafg2c3bc6bc6g2k5e2k3den21.|19.2nmkm5aeik5c9b2c2gkg2fgk4ef6n21.|21.m2n6a2e2c2bc10b2cegkf2gil4e2n25.|21.3nd3a2bcd2c10b4cbaekig2ilk3eno25.|23.nebab6c8bc6b2ae5k3nm2n2o23.|23.oid8c16bae5g4k2dgn23.|23.okig5c12bc6bad7gcd2kn23.|24.mi2g2c22bce7gkikn23.|24.nk2g2c8bc11b4c3f4g2kmn23.|24.nlk5g2b2abc4g2a7b3cb3f2gkg2o24.|25.2o5g3f5g3f2a3b5ceg3f3gk2o24.|25.2ok3g4f2g5f4g3b3c5g3fi2n25.|26.omkg4f5gf5gf6e7gfkn26.|27.okg4f5gf2gfg6f10gln26.|28.n2kf10g2fg7f6gkln27.|29.nmk5g8f2g5fg2k2glmo28.|29.n2mlk2g6fk6g4f3k2mo29.|29.2nml2kg4f2gki7g2f3kmo30.|30.2ok3lk6glk3f4gkm3n31.|30.onk3g3l4kl2k3f2gko2n33.|32.nl3il4o4nkgfgk3o34.|32.no3l3n5.mno3lno35.|33.o3l2n7.2o3ln36.|33.o3lo9.o3ln36.|33.n2jlo9.n3lo36.|28.5nl3jo9.n3jo36.|24.2o2nm2l6jn8.ol3jln35.|24.5ml6jln7.2ol3jl2o34.|23.o8jl2j2ln6.nol5jm2n33.|23.2nml2j3l2jlmo6.nm2jl2jl3jni32.|25.5o2ljlmn6.o12jo32.|30.mnmnm7.2o3l3j3lm2o32.|31.n2o8.5o3jl5o32.|47.2o2n37." },
  Default_out_3: { w: 105, h: 89, p: "f8ffff,f4ffff,fbfcf0,e0f8fe,cdeffd,cdebf5,b3d7f7,a8beda,b5ab9d,88a7dd,6982c2,605b7d,110835,0a012d,08002b", r: "98.2nmn3.|2.2mn92.o2nf2n2.|.3n2o91.2omd2n2.|.2nbo2n89.2olba2n2.|.2o2b2mn87.2n4b2o2.|.2obabim36.m2n9.o3n34.2mb2a2b2o2.|.2od2abmo35.mf3m7.onh2m32.2mh3abd2o2.|.2ne2abe2o34.oe3m7.onhmn31.onl5ae2o2.|.nmha3be3n32.ogjmn6.3obno7.h22.2o2b5an4.|3.ne4bg2m30.nhegkno5.2na2bno6.e.h20.mn5babgn4.|3.ojeb3ai2n28.n2jejkno4.on3agmn8.2e17.n2m2a5bfjm4.|3.okedb3amno27.nk3jkmn3o3n3ajm2n7.2e17.onf4a2bejkn4.|4.o3d2a2b3o25.mn4k3m3olk3bfj2m2n6.e17.2odb4a2bjlo5.|4.n2ldf4bo2n22.2ong2a3b2aehjgd2b3jge2n5.e15.2noj4ba2cde2o2.o2nm|3onamlhegedbajlm20.n2oci5ab3adf2gj4e2n6.d13.mnmnd3bacd3e2o2.ohdhm|2ol2m2nl2eged2ajlmn17.2ni2cic8a4ig2ejm2o18.m2nlda2bde2f3dmn3ofe2an|nge2m3n2e2ge2adjm2o16.nmfc2i3b5ac4ife2jmno17.2o2nd3abe2g2edk2mnome2bho|nh2ejnonke3gebdeg3o15.odc2i5ba3e2i2cig3kg2m15.n2olfb4ahjg3e2k2med3bhjo|njh4e2nj4g2j3ejkn13.og6a3b6e2igj3emn13.2m2ne5b3j5ek2mg3a3b2o.|3ng4egl2j3gjk3egj3m10.nk3l3abej3nm3i5em2n11.m2nme2a4bkg6ekjge2b4ah2o.|.2o3g3eh3k3ghj3egfjn2o8.m4il2abgmj3l2cfgj2klm10.m2no2f2b3abg3k4ehjged5badjm2.|.2o4g2ehj2k4gj5ehj2o7.mni2cilcabgodj2ibaegj2kln10.m2noe4b2a2g4k2e2jke2a6bem3.|3.n4g2e2g2kgh3kjh5emnm5.mlc4ilbdknkfe2bad2e3m10.2m2a6bg3k2a2kgkjgb5a2bdgo4.|3.2m4ge2geg3kdg3k5ejmo3.onlc4il3b2a5bd2em10.onm4a2bde2kb4a2kjed6b2agjo5.|4.2nh8g2ke4gk5eno3.2o4il2ilf8bd2en9.3ob3ade3ke3b2akjh3ed6bg2mn5.|5.noh8ghkf3gjk4ekno.nm10ic7b3en9.2o3babej2hed3bd2jh5e4be4m6.|4.k2no9gke4gkh3ejko.n2icil5i2lb2a3b4eo9.2o3bcfekgda3b2ekjh6e2bfho2n4m3.|3.4nonj8gk2e3gjk3ef2ol2c6i4l3a2b5eo8.mnm3begkgdb2ad7k3edaejm3o2n2mn3.|3.n3ge2m3k4g4kd2gjk3egoic5i2lmlml10eko8.nda2be2kh4ehk2e3b2k2ehjk2mhgf4bam3.|3.ohg5e2j2k2jke2hk3ghk2efnl4ilm4ol2k2j7eo9.n3abg2kj4ed3a2bk2j2k2he3a6bgn3.|3.olh6ej5k2egjg3hk3em2l2i2ln4o2k3j6ejo9.m4agjhg3e2d3abfk2j2kgeb4a3bdhkn3.|4.o2j4g3e2g2k3egjk2hk4e7n3aok2jh6egjo8.nj4ak2h3ed3badekj2g8b2abe2jo4.|5.2m10ghk2e3g2hkg3en9ao2jg4ea2ejm9.ogb2adk2g2ed3eh3kh4e7b2aeklm5.|6.mnoh8gj2kje2ghgk3eho8ao5gdba2ekm9.o3bagkhg3egh4kh5ea7bk3m6.|7.2onkjh6ghj2k2g2hk3ego7amk3g5begkm8.2o3bdk3h4e3bdjk8ehkm2om9.|8.2olkhg4hgh3kj3hkj2egn7amjgfe5bejln7.n2o3bek2h4e4bd2k7ehjkn3o9.|10.nm3n3kh5k3hj2k2gnm6amh3a5be2ln7.2oe2bdgkj3e6b2k5jkl3m2no11.|8.n3mnk3h2j2k5ehj2k2gjmn3alnj5a3b2e2o8.2n3bdk2j7e2k4j5edfhm2n3o8.|8.nh4gh4g2jk5egk2j2g2m3alod5abab2e2o7.mkg2a2gk5j5k18eo8.|8.ok4g2h4g2h3k4hjk2gj2lahlk4ba2b2a2eno6.mlg2adhjhjh2e2d4bkg14egmo8.|8.n2k3gh4g3h4k3hjk3gj2mnlj8ba2elm6.mh3be4hg2e4babk2g12ehln9.|9.m2nj2h3g5hkj3h2jkj3gk2mh8b2a2eklm2.3og3beg5h2j4bakh3g9egk2m10.|10.2o2n2m3n5kg2e2hj2kj3glgd10b2eghm2n2k3b2ehk2h3e7k4jk4m2nm2n2o12.|14.3no5h5k3h2k2h2k12b3egjma3b3ehk3h5e2k2j7eglm3n16.|14.on2l6h4k3hj4kh2a10b3eg2k2ab3ej2kjhg2h3ejkjg8egk2lm16.|13.2o2j7h3k5h3kl3a11b2egk3ab2e3k2j2e2k4ek2j11ekmno14.|13.o7hg2kjhk4hkh2kj4a10be2gh2a2dgk4j4ej4k2j2khg2j7ehlo14.|14.5n2mnm4h4k2j2k6a9be2ge2a2gkh4jk4ekjg5ek4o8n15.|19.m2n5h4khj2l2bf3afa7b4eafhj2h2j2egj3k2jg6ek2n24.|19.non5hk2jkhjlf2bge2ag3a5b4ebh2k2hj3eg4k2jk6ejkm24.|19.2o5hm4hjm2e2bgfbg4a5b5eh2khe2g3e2kj4ekh7em23.|19.4o2nmn4hjm2e3bfg8a2b5ehj2hkj7k4ej2mkg5eo22.|14.e9.2m4hljmfe3bfga4b2adea5ej5h2j3ej2k4ej6n3o22.|14.2e8.2m3hmljm2ed3b2a4ba2dbd5eg7hk3ej2k4e2m3n4o22.|14.2e9.m2h2nojmf2e4a5bahed7egh2j3hk4el2k3e2m12.2g15.|13.h2g9.3n.2ohmfek3a3b2ebeh11ejk2hgjk3ej2nm3eln12.2h14.|13.hbf2g12.2on2gkga4b2kbj12e2jkh2gl2j2en2.3n2o7.3g.egh14.|14.2h16.n2jgke4bjkj14e2hk2l2m3nm14.2ea3h15.|15.f16.nmjgjhgdbg2j15eg2h2klm2nmn15.eg2j16.|32.3mhgk2jdk18e4hj2lm18.2j17.|33.nm3h3kg3ed15e4h2jlm36.|34.on6h19e7hln3o32.|35.oj10h15eg6hjhm6n2m25.|35.o2j10h14eg6h2jh3m2n2m2n24.|36.n2j10h10eje7hj2kj7e2o24.|36.nm2j12hg7e6hj2kj2gk2j2ge3o24.|37.3mj11hg7e2hk2h7kj2ej2mno25.|38.2mlkj7hkhg7eh2k2j3k3gjk4m28.|38.2nl2k2j5hkhg7eh2l2j3k3g2l2o2n28.|38.2ok3lkj4hkjg6e2jmn3kl2mn3o32.|40.o3k2m3kj2kjh4e2hjn2on2m38.|40.nl3jklm2nonkj6hn2o42.|40.nm5ln3o2nkj4hlno43.|41.2nm2ln2o2.2nmk4hmn44.|42.om2lo7.o4ln45.|42.on2lo2n6.o3lo45.|42.oml2i2lm5.o2lio45.|41.oml3ilmn5.o2limn44.|41.oml3ilmn5.ol2iln44.|41.o5imn5.ol4in44.|40.nl5ino5.o5ilmo42.|40.nil2ilino4.ol6ino42.|40.ni2lilino3.2nl7imo41.|40.o3lilimn3.nmil3il3io41.|40.om2lili2lo.nmi2l4il2in41.|41.2oml2m3n.omi3l3il2in41.|43.2m2n5.3on2lin4o41.|44.2o7.3omli5o41.|56.n2o46." },
  Divya_in_1: { w: 55, h: 53, p: "fee855,fee233,fde038,fee130,fde02f,fcde2d,fac92f,f3b31f,f0a116,e79f15,c37140,411a2b,0b012a,060125,070028", r: "25.2m28.|25.2n28.|23.2mdkn2o2n13.gh8.|23.mlcf2o2no13.2g8.|21.2m4cmge2m11.2ga9.|21.nobdbgmfb2m11.gha9.|21.2n2fjibdb2m9.g4h3g6.|20.m2n2fjf2bc2mn8.a3g3hg6.|4.hg13.3mo2jedb2kmo2n11.gh8.|4.3ga10.n3mkjfed2b2kn3m9.gag8.|6.hg7.4ned2bd7ef2j2m7.ghg9.|6.2g6.ml3k4a2b2d5efg2k2m6.g10.|13.2mcb6a2b3d2e3d3b2m17.|2g10.nlb6a2ce5de2d5bj2n15.|2g9.2nfe6af2e4de3d2b2def2n15.|.a4g4.nlj2fe5cb3e10d2efjk2n13.|2.4h4.nkif3e4db2d2e8d3ef2jno13.|10.okf2e3de3dede8d5e2f2m13.|10.mk2d4ed2e9d8edb2m13.|8.mlcbdhif5e7dhif6ed2bik2m11.|8.2mbdbhi3f2e7defi2f2e4d2bij2m11.|4.hg2.2mb2d2a2nf2e6d2e2a2nfed4bdijon11.|4.hg2.2mdef2a2n2fe4bd2ef2a2o7be2j2n11.|8.2me2fn2omef4kbd3emo2mc5bde2j2n11.|8.nm3ck3m2g4kcf3ego2mg3c3bgij2n11.|8.nm5kcb2k2h4k5e6k2b3ij2n11.|8.nm5kcbg6kg4ed6kbd3ij2m5.on4.|8.om5kc2bc4kf3ed2b6k2f3ij2m.2m4o4.|9.mlk3g4b3gf2e5b2c4g4ilka2ml3g2n4.|10.ok7b5ed8b3ej3i2makm2e2f2n4.|11.2nhi2bdbe13bdji2j2n3mk2cbl2n5.|11.2njibde16b3ij3nomk2cbmo6.|11.3lnjie14b4im2on3jgdhi2m6.|11.2lmn2je11bdbd4i4m3ihf2i2m6.|10.2mokj2fe13befefb4coli2jln6.2g|10.monkjfe21b2col3iln6.2g|10.okjmnf16b2lc5bijol2ij2n2.2g2.|10.okimn2c15b2l2c3ef2i2m2ij2n2.2g2.|10.oki2m2c13b2c2imn3j2ij3m2n8.|10.2mj2mg16bijmn5jk2mo2n8.|6.2g2.2no2m2ied3bc8bej2ijn4o3m11.|4.gaga2g2no2m2jgfe3bc6bef4i5nom4.ag6.|4.hg2a2g3.mo4jeb2c7b9ij2n5.2g6.|4.g3aga4.nlkji11g8ikln4.ag3ag4.|6.2g7.2nj20i2m5.gh2a2g4.|6.ga9.l2ml11ijkl2ml8.gagag4.|17.4m11i2kmo2n9.2h6.|19.5m3n9m19.|19.2m2o4no2mo2no2m19.|17.moki2k2o3.2oki2kom19.|17.mo2i2k2m3.2nki2kno19.|17.o3nom7.4n21.|17.4nom7.mo2n21." },
  Divya_in_2: { w: 74, h: 70, p: "fdec67,fee233,fee131,fee12f,fde02f,f8d52d,eea617,eea214,e9a115,b87727,16092a,0a0229,0a012a,070125,070028", r: "68.2l3nl|68.l4nl|66.lm4a2n|66.2l4a2n|64.lm4abc2n|64.nl4a2bln|27.3m33.nk3a4blm|26.k3m32.2n4a2dcblm|4.3mo17.2ndfm31.2m3ab3dcb2m|4.2m2l16.lniego30.2l4a5db2m|4.on2e2n13.2m2degn12.nl4m11.2m4a3ded2e2l|4.2n2e2km5.3n2.2lj2bdgin3.lml2.lm2n3j3m9.2nj4abc5de2n|4.2n2e2gml3.ol2n2.2l4bgjm2.no2m2.3ml3efln9.2n2a2dcdc5de2n|4.2nec3gjnlmje4n2aed3gj2mnjf4nib2cde2i2n7.lniebe4d2c3dfg2n|4.2mbc3gj3mbcno2n2a2e2hgj3mfe4ne4behi2n7.2mb7dc4b2gln|4.2m2b3hjmja2flm2ab3ehikjecb2k2j2f2e2k2g2jml5.lm3b8df3g2k2m|4.2m2b3hkn2a2glm2adede2ikjdcb2k2j4eol2g2j2m5.nl4bc5degh2g4m|4.2mbc3hjk2aij2a2bcd2e2i2edfkcb2chi4n2g2m5.2n2ecb2gb2de5hkl4.|4.omdehghjk2a2j2ab4de2ided2kbcdbgh4nhi2o5.mn2e2dhg3bdhi3h2n4.|4.2m3hgkjd2ade2d2c7df2igcb2gkm2k2nhi2n5.mo2ehi2h3g2hj3n6.|4.on3hgkjb2a2d2e2dc6dfi2hec2g2m2kln2i2n5.onfe5h4gj3n6.|4.2n3hgji2b3d2e4d3cdcfifd2i2l4kgi2n9.2ni3hg2hg2m9.|4.2n2hgij2c2d2bd5e2d3ceiedgiln4k2gml9.no3g4hi2m9.|4.2m2g2j5d2abd7e6d2kih2k2m2g2mon3o6.2mg4hi2m9.|4.mkgijg2dc2b2a2bcd5e6dikih4k2g2ml2n2m6.lo2i2h2g2k9.|6.ol2e2dc6abd4e3d2e3db2i2n2i3ml3hkn8.2n2h3gjn8.|6.ml2de2db5abc9e2d2cfijnih2nkj3hkn8.2ni2g2hg2k7.|6.2mb2dec2b2a2b2ced7ede4d4h2ni3hgkm10.2m3h2gkm6.|4.oli2gc2dc3bab2c2e2d10edb2hjkji3hgk3mo2n2o2.2lji4hgko6.|4.2ndb2gbc5edc4e3d7ed2c2h2ni4him5o3m2.2mg6hkm6.|2.2o2neckifed4e4d4eab2l2olb3e2hij2k3hg2i2fe2gmonojg5hi2nm6.|2.3mlecmkgf2dcd2ede2de2d2a5m4e2h2g2m3g2hf3e2go2nog4h2gimon6.|2of2e3b3m2g2bc4e3d2g2no2mkb4e2hkm2o3mj3eghkn2a2o3hil2mk9.|2n2e3denomjg2b5e3d2g3n2of2cded2hn2o3mol2edgh2n2a2mi2hi3ml9.|o2ml2bde2najnb4d2cd2e2n2anonf2e2dbd5egimk2hgijl4mo2n2j2m11.|n2ml4b2l2ane2dc2bc3e2n2a3nfe6d4ehimk3h2jk4mo2n2j2o11.|4.2lbdhj3n2edb2ab3e2jmonkg5e2db2g3nlhgb3c5b3on3jk2m9.|4.2ndehi3n2e2b2a3ec2jo2njgfb4edb2gmonkif5bc3e2o2m3jkom9.|2.moeb4g2ed2b2mon3ebc4ef5gcehg4mgh2e3c2b2gl2om4jm3o9.|2.klef4g2e3bk2mn3ec2e3cf5gce2hl3m2ge2ce3c2gk2ln3jk2mon9.|2mbe2h4gbjmedec2k3ec2m3bf5g2e3hg2m2g2bcec2e2d4fn3o13.|on2f2i3g3bmj2ef2kg2efmk4b5gfe3hg2k2g3bc5e4fo3n13.|3no2m2gbc3bl2on2fno2m4bc4bde7hg2m3bce6h4m15.|3n3migfbc2ef3kfef2kfc3b4cbcf2h5jk2m5bcg2hijno2m15.|4.4m2gd7ec3b2e4c3ed4gm5omlb2c4bgh4n17.|7.lk2jihec3ec3b2cded2b5gjkj5ife2c6bf4i2n15.|8.nl2jhec2dc4bcd2edef3h2g2m2g2h2i2ec8bg2hi2n15.|6.2nfgi6h5g11h3g2j2g3e2c6b2gkm2l2n15.|6.olbe3g23h2j2gb2c6bce2hn5m15.|6.5mgbdc2g13hiji3hlm2g4bgf3bc3e2i2m17.|6.5mj3b2g7hg5h2ji3h2oih4b2gbd3cde2h2m17.|9.2ojecb2gbc3dehg2bg2h2jlnihomg3h2gjihfece3hg2m17.|10.nj2eb2g2b3de2hdeghg2jknih2mg4hg2jhf3e2ghgnm17.|10.ojeln2oghed2c2ei3hgkmigm3o2h2jhgmk4ih2g2h2glm15.|10.mkblmon2i2e2b2eig3hkoihk2mnih2jgion2i3h3g2hiom15.|10.mo3mgh2nih2bhiol3hknih3g3hno2mo2njh4g3hi2n15.|10.4no2i2nigbchi2m2ihkoihg5ho2mo3nki3g4hi2n15.|11.2n3ih2jmo4i2onkhkmig6h2o5.l3mg4hi2n15.|11.2oi3h2jmnjihio2nki2mihg2hg2h2n6.2moi4hi2n15.|11.2mi5h2nomgion.4m2ie2ce2hno7.2ni4hgmo15.|11.2mgfg2hi2nom2jn3.2moig4efg2m7.2n2i4g2m15.|11.2oebg2hi2n2o2m5.om5ec2b2m7.2nih2b2g2m15.|10.okfed4h3n10.lnedc3bmo7.no2j2ghino15.|10.nje2d2h2gmo11.2nc5b2o7.lm2jh3i2n15.|10.njef2hgklk12.2o2b2c2bmo9.km4n17.|10.mje3ih2m13.2m2bc3eom9.2mo3n17.|10.3m4n15.lmec2ibe2n32.|10.no2mo2n15.onfe2i2b2n32.|34.6n34.|34.om2o2n34." },
  Divya_in_3: { w: 81, h: 81, p: "f9edb3,fbe966,f3c53d,f6c62d,eec13b,63d0d9,daa34c,c3811c,748e89,268ce9,685347,12092d,09012c,070126,060023", r: "21.2mno11.2b9.n3m30.|21.4m11.2b9.on2m30.|19.on2f2m3.4d2.2d9.2o2f2o30.|19.2o2j2m3.c3da.2d9.no2f2o30.|19.2o2j2n.cdc.4d9.2m2f2j2o9.2d19.|19.2m2j2o.cdb.c3d9.lm2f2j2m9.cd19.|9.3f7.2m2j2o16.on2j2f2j2m3.6d21.|8.4f7.2ljio17.2o2j2fjiml3cb5d21.|8.4f5.2m2f2m3.4o11.2o2f2j2m2.3dcabd23.|6.5f4.2o2k2j2m2.mlk2o2.on5mnolk2fjk2m2.c2d3bd10.2f11.|6.2j2f5.2o2a2j2m2.mkhno2.on6mn2a2j2n2m5.2dc11.jf11.|4.5f5.okj2f2j3mle2hlm2okhom2j3aif5jk2m3.2d2b8.j2f12.|4.2j7.mn6jn2ml2ehl2mn2h2o2j3af7j2m3.2dcb8.2j13.|4.2j2f5.2m4j2k2n2fjg2hc2hlo2j2a7jlm2n7.4b7.3f11.|4.2j2f5.2m4j2hon2fjihec2hmn2jba7jmono7.4b8.2f11.|5.fjf3.2n2m4h2k2f3ji3e2k4e7jlml10.cdb5.2f2j2f11.|6.2j3.2o2m4h2k2f3ji3e2k4e7j2m11.cd6.2f3jf11.|6.2j2.okeno2h2k4f2j3e2h8e3jl2n8.b3db7.2j15.|6.jf.mnhdlo2h2k4fji3egh8e3jl2o8.b3dc7.2j15.|7.f2jmhe2ked2j2f2j15e2j2m3n4m2.2b9.2j17.|8.2jnke2kge2j2f2j15eji2m4n3m2.2b9.fj17.|nmno7.2m2h2j4f5jic8e4k5b2g2m11.2j2a4mn3o2mn6.|4o7.2m2h2j4f5jg9e3kg5b2h2n11.2j2a5ln2on2m6.|2o2h2n2m3.2mec4j4f2j9e2h2e3b2k2h2o9.2m5no2e4chko2l4.2d|mnhk4l3.nm2e2i2j4fig3ec5e2h2e3bhk2h2o9.lmlm3nl4ec2hko2l2.bcdc|2.2n4h2m.2o4e2c2f2j3ecb12ek2glm8.3me3be3g6k2m5.2d2.|2.nmk3h2k3oec2egijfig2ebc5k4c5h2kln4.4o2ki4g7hk2lm4.2c2d2.|4.2m4h2no2b2c4jce2cbio2n2m4c2h2kglo6.on2o3b2h6k4gon5.4d2.|4.2mg4h2ohg2c2j2ghg2blmnoanm5eg2hl2n2m4.2ocg2hk5g4ab2n5.cdb3c2.|4.2n2e3hkm2h2e2j2c2h2b3m2a2o6e2h5m4.2n2c2hk4g6amn5.2d6.|5.onkg2hkm2k4e2cegmkalm2ano5e4cgh2k4m2c2hkh2g7alm7.2bki4.|6.nl2ehlm2k3ecec2e2maim2a2m7e2cgh2k4m2c2h2kgb7a2m7.2bki4.|6.ml2emk9e2c2l3k2fgc4j4e2hkln2a2m2c7k6a2m7.2k2b2i2.|6.mlegnhd2ec7e2l3k2fbc4j4eh2klm2a2o2c7k6a2m7.2k2b2i2.|6.3mk7b6e7ci3j2c2e2kn2m4a2o2h2k5g2h2k2a2m7.2k2b2k2.|6.nm2n7b2c6e5c4j2c2e2konm4a2o2h2k5g3hk2a2m7.2k2b2k2.|6.4nkg3e2k2c7ehk4abced4ehln2a2m2k2h2k2g6ab2knm4.3k4b2k2.|6.3mlk4e2k4c5ehkb3a2b6ehno2a2m2k2h2k2g6ab2kon3.4k4b2k2.|4.5ml8e3c2e3lkb4a2e2h5mno2a2o2e2k2g2k5a3m2no2.2lbaf2b2k4.|4.4mnm2ec8e2g3l6a2e2hl5mn2anohd2k2gkg5a4mno2.2lb3fbi2k3.|10.m2h4e4l2g5a4k6h2m3a2m2e2k2g4akl3m8.2l5fji2k2.|10.mlk4l4k2g2b3k2g8h2m2ak4h2kb5aklonm6.2lj3fj3fg2i2.|11.2mn3o8gk2l2g8h2malm2e4k6ahlo8.2l3fjl2f2bij2.|2.2b11.n4mno2lk5g4h4e3m3h3k2gnon5mo8.2l2fmlk2j2bij2.|2.2b11.5mn2o2l5g4h4e2nm2h4k2go3n5m8.2l2fmlk2j2bki2.|3.adc13.mn7gijg7e3h4klmn3o16.3knkeij2f2k2.|4.2d13.2o7g2jge2c4e3h4k3mn2o17.2koke2k2f2k2.|5.bdc.c3d6.no6gb2j3ec2j3eg3klm6j2o2.3m4.2m2.3ml2helo3f3.|6.2d.b3d6.2m6gb2j4e2j4e3klm6jon.2mn2o3.2m2.3ml2hemo2f4.|7.bdc5.2f4m5af3j2e4j5eij4f2j2ehgml2jfn3o2f5ml3clmki4.|7.adc5.fj4m5af3jge4j5eij4f2jce2hml2jfnono2f5mle2clm2i4.|4.dcjf5.2j2anm7afj2f2j2f2j5ei7j2c4h2lo2nm4nm2jc2eghlm6.|3.acbjf5.fj2a2o7afj2f2j2f2j5ei7jce4h2ln4m2nonji2ce2hlm6.|2.2d2a2j.f3j4a2o7afj4f2j5egjg3e4j4e3hec6j4e2chko8.|2b2d2a2j.4f4ano8aj4f2j6ej3ec3ji4e3hecg5jg4e2hlm8.|4d2c3jf7a2m11a2f2j10ec2j8ekge2c2e4j2e2h2m9.|2c2b2c2f2j3f4a2m10a3f2i10ecgi6e2ihge2c2eg3i2e2h2n9.|2c2.2d2.5j4a2m9a4jc20e2je2h2c6e2h2g2o9.|2b2.2b2.5j2f2amogb7a2jig10eh3eh4eij2fehl6h4g2l5.fj4.|8.jf3.2j2a2o2g7a2j11e2h2e2h4e2j2feln6h2f2g2o5.2j4.|15.fj2oml9akl8echl2h2k4e5jlo2h4g2f2m5.fjf5.|15.2j2n2m9a2l8eckl2h2k3ec5jlo2h4g2f2m5.2j6.|17.nm2hmlgb3abg2l8ej2l2g2k4ecg2jklo4g2o2f7.2j6.|17.2m2h2m2g3a2g2le2c4egj2l2g2k2ec3e2jkln4g2o2f7.2j6.|17.2m2h2o9glmc3e2jflo2n2k2hc3ejihl5m2.3jf3.2jf7.|17.mn2h2n9g2mc3e2jfko2m2k2h3egjihl5m2.3jf3.3j7.|17.mn4kn2olh4g2n4e3jgcl3m9hlm10.3jf9.|17.2m4k3olh4g2o4e3jicl3m10hml9.3jf9.|17.2m2j2h4k2m2n3o5eg3j2m2.2o9hlm21.|17.2nji2h4k2m5o5eg3jmo2.2o9h2n21.|17.2o6h2km4.2o5egjgeno4.4m5h2n21.|17.no6h2km4.2o4egijgemn4.4m5hnm21.|17.2m7hkm4.2m4e2je2hlm6.2m5hlm21.|15.2o2k6hkln4.2m4eigehklm4.nok6hnm21.|15.2o8h2o5.2mc6elo6.no2h3e2h2n21.|14.mkh2k6h2o3.2ohe4b3elo6.no2h2ek2hno21.|13.2m2h2k6hno3.2o2e4b3eln6.2m2h2ek2hno21.|13.3mn3on3ml5.2o2e2h2k2ehlm6.3m2no3ml22.|13.2m5non3m5.on2e2h2k2ehlm6.on4mn2m23.|30.3mnon3mnon39.|30.3mnon4mn40." },
  Divya_out_1: { w: 38, h: 66, p: "fee448,fee034,ffe033,ffe031,fedf30,fcd830,eda316,f5951c,e39c15,d56b34,572926,0e0227,09022a,070125,080024", r: "21.2n2o13.|21.2m2n13.|19.ml2a2m13.|19.noab2m13.|17.2obfon15.|17.2o2f2o15.|15.2n2e2gon15.|15.loedgi2m15.|13.2mbdec5m3n11.|12.olkb2db5klon11.|11.2of3e2db2cb2g2o11.|13.ln4lbc2g2l13.|13.n5mbegi2o13.|15.2mbe2g2l15.|15.2m2egi2o15.|10.n4mig2e4on3m11.|10.o2n2m2gef2o2n4m11.|8.okf3a8ed2bgi2m9.|8.ojf2ab7e3dc2g2m9.|6.mlb4ab6edc4deijo8.|6.mlb4ab4ed4c2d2e2i2o7.|4.nl2b2dcd6e5d5efilm6.|4.2o2e6de3d11eglm6.|4.2o3ed3c2dc2d10edblm6.|3.mok3f2e3dc3de4f4edcbg2l5.|2.2mbe3ig2ed3c2de4i3ed3c2glm4.|2.2m2bahki2e4d3e2aki3e3cd2gln4.|2.2mb3anl4e2d3e2a2o2ed3cd2g2o4.|2.2m2b4ml2onlb3eln2o4c2b3gon4.|2.2m2b4m2nonm2bdbon2ob2c2df3gln4.|2.2m2j2nml5hkl2b3mn3jhef3gon4.|2.2o2j2nol5hlm2b3ml4jef3g2o4.|2.2o3ml9h2o3ba4jef3g2o4.|2.3o2ml9h2oed2b3jhef3glm4.|4.2o9h2jon2edc3bf3gk5m2.|4.2o9h2j2o3edc2bf2giln4m2.|2.3m5n5mno7ec3gjn2o2iba2n|2.l2mo4n5mnlb6ef3gjm2o2icb2m|2m3gi2nml13g2in2mkgec3ebnm|noig2il2ml5i7g3ionmig3bdefon|2oi5g3mno2ki6gi4ke6bgi2o|2oi5g2m3l2ki7g2kjfe2dc3b2i2o|2m5ginl2g3i6gb2cb4ed2e2g2m2.|2.2k3giol11f4b2cd3egi2ln2.|2.2mgiginld2cb2cd3ed6bcde2g2o4.|4.2olk2bd5cd10b2g4on2o2.|4.2onl8bc10bgim3n3m2.|6.on19b3gjkig2m2.|6.on17b2e3g2j2g2o2.|6.one15b2ef7g2o2.|6.2o4be11b2ef7gln2.|6.4no2i11bc7glm4.|6.3m2ojgf6b3e2b7glm4.|4.3ml2jhlo2g2b2d2ei8glo6.|4.2mlk2jhjljgf4ef8gilo6.|4.2o7jlo4i8g3m8.|4.2o7jloj4i2g3igl3m8.|4.ol7jl4n4m3on3m9.|4.nlk6jl7mn3o4km8.|6.2o5jlm8.2o3jkm8.|7.7l7.nl4jhjn8.|8.n4o8.2o4jhjo8.|21.2o5hjo8.|21.no5hjn8.|21.2m6o9.|21.3mn3on9." },
  Divya_out_2: { w: 76, h: 74, p: "fee95c,ffe031,fedf2f,fdcd2e,fadf3a,f8c62f,47b5d4,f5971c,728078,465680,101947,0a022a,080129,060124,070025", r: "32.mn42.|32.lm42.|30.noml42.|30.2nml42.|29.mkclo42.|28.2lieln42.|21.no4.mlbagkn6.2m2o2m30.|21.2m4.olba2g2l4.n3l2ml8.a21.|21.l3m2.mlca3glmo3nbe2g2m7.2d21.|21.2n2kmlk2ca3g3l2kiagjkl6.afef21.|21.2ncbon3ca3g2lb3c2gom7.fd23.|10.ea9.mobemo2c9g2i2k7.af2d2f6.ea13.|10.de9.2l2bmlce11gml7.6d6.2c13.|11.aca7.2o2c2gce2gnm5l2g2jlo2n7.5df17.|11.ece7.omce2gce2g3no2ml4gmo2n7.6d17.|19.2nolbe3gjlk6ce2lg5j2l6.a2da18.|19.3nl2e4g2lb5cb2l6j2l7.2d19.|4.2lmn9.2le2ce2l2g2l4b3c3beom2j2l7.2da12.mo2n4.|4.2l2n9.2l4bom2gol5b3cb2c2n2j2l7.2d13.lmon4.|4.moce2l5.nme3b4c2n3c6b5ce2n7.fda11.m2lfelo4.|4.2ocb2l5.nme2b5colb4c5b5c2n7.fd11.2nmlfelm4.|4.2l3bc2n3.2l2g5c5b3c6g2c2b2h2n15.2o2n2cb2l6.|4.2lb3c2n3.2l2ga3c7b2c6gbc2b2h2o15.lonh3c2l6.|2d4.2n2cbe2l.o3n2g9bagk2on2g4b2h2m11.4l2b3cln8.|eda3.2nc2be2l.4n2g4b4ca2gj3n2g2c2b2h2m11.4l2bebckn8.|2.2d4.2l3bi3n2a2l2b5ce2gl2aon2g3cb2h2m7.4nc4be2abkl6.2d|2.2e4.2lb3c3nia2lh6ce2g2lalm2g4c2h2l7.lo2n3cb4aekl2.a2ea2e|8.2n5clm4l2mnomlbe2g2m3l2g4c2hml5.2l2b6c2abe2l3.4c2.|8.2niea2blmkg2l10ikm2ljgi4c2h2o4.n2i4b2c4aikl4.a2ea2.|10.nl2abln2g2l6h2mcfjkl2ge2c2bc2h2n3.2le7b2a2cno11.|4.4nom2l3a3nmih2f5hioia3ea2c2b4h2n2.li2e5b2a2e2co2lmnm3l4.|4.2nom4lb2amo2n2hfa6hmk2c3b3cb4h2m.2le6be2a2b2cnm2l2m3l4.|6.mle4bem2lia2f9hin2c4b4h2l3.2necbc4a2eb6cbe3l5.|6.2l2b3cioml3af10hnf2c3b4h2n3.2ne3c4a2eb7cblm6.|8.olceaini13hmk9hlm5.lme2b3c6a4c3nl7.|8.2nc2aim14hml9h2l5.nme3b2c6aebcf3n8.|10.lk2cbkmonom2lm3nml9h2n6.njc4b2c2a3be2lmn11.|10.2l3c3on2o2mlmonol9h2n6.mjc6b2a2c2b3lm11.|10.monfc2aeb2c2n13h2c2n4.lke6b4a2cnoml7.ed4.|10.m2lfc2ae3b2n13h2clo4.mk4bebe4a2c4n7.ed4.|8.3ml2b3c2a2bmn11h2c2b2e4lb2c2b4a2e2b6c2n11.|8.2nml2cb2c2ace2l11h5be4l5c4ae2b7c2n11.|10.2momleb2cnm2l2e4h4c7b2eo2noc2ae3c2b2lon4mon11.|10.5lib2c2n2l2e3hd4c8bc3nkceae4cb2lmn3m3n11.|15.n2o3n2c6b2c14bel2m2c4nml19.|4.f2da8.3non2c8bcea2cbfc5b2e3lifln2lm2l18.|4.4d9.2n2oc10b2gac2o7be3b2n2k2j4m17.|4.afea2.da4.nkfol2i5beiab3gi2n10bc2hlk4jon4.de11.|10.2d3.2ncb2l2g4cbegib4gloc9bc2h2l4j2n4.2d11.|8.df5.no2e2l2g4c3gib4g2l2h9b4h2l2jmn5.eda9.|8.2d5.lmeb2l2g3ce3gib4g2l2he8b4h2l2jmo5.fdf9.|6.df7.lm2hmo4gce11g2l2hcb2c7hlm2j2m5.fdf9.|6.2d7.lm2h2n4gba11g2l2h2cbc7hnm2jml5.fdf9.|15.2n2h2n17g2j2n7hk3n2jmn19.|15.2n2h2n17g2j2n7hl3n2j2n19.|17.3nm2j15g4jnmlmono4jmn21.|17.2n2m2j15g4jn4mnm4jmn21.|19.lm4j9g17jkl23.|19.lm4j9g17jkm23.|21.2n26jlm25.|21.2n26jlm25.|23.4n19j3n27.|23.3nl18jk3n27.|27.lmono3mo2no3mo3n30.|27.o3nk3lo3nlmoko2n30.|29.nlhlm6.2n2hol30.|23.5nmolhln6.2n2hml30.|23.5n2mlhln6.2l2hlm30.|21.2l9hlm4.2n6hn29.|21.om9h2l4.2n6h2n28.|21.2no3lo4nl3.2m9hil27.|21.3nol2mo4n3.2l10hl27.|36.lml2mo3no2mo27.|36.2m2om5onom27." },
  Divya_out_3: { w: 81, h: 81, p: "fef7a6,fee134,fee032,fdda31,f1bf2f,7bb9a7,26b2f7,ba8347,206ac4,634f56,111e4f,0b022a,080129,060124,070025", r: "23.2n22.2n32.|22.3n22.2n32.|21.mlhjl19.mo2n32.|21.mlhjl19.2lmn32.|21.nohjm17.2l2h2l32.|21.omhjn17.om2h2l32.|21.mlhjn4.o2ml6.2n.2n2hlm32.|19.m2ljhjn3.n2k2m4.4l3n2h2m32.|19.nl2h2jm2.2n2g2n4.2lhj3n2hnm32.|17.2n2h4jm2l4i4n2m2lhjml2hj2n32.|17.2n2h4j2ml2g2i4n3mlhjl2h2j2n32.|15.lm2h4jo2mk3g2i2n2gikml4h3j2n32.|15.2l2h4j2no4g2i2m3ginl3h4j2n32.|ml2n11.2l2e2jo2nm5g2k4inl4h3j2l26.mo2m4.|mo2n11.2l2e2j2mok5g2k4i2n4h3j2l26.l3m4.|2n2d2l9.nm2h2lgkmja2g4i2g2l3eh3j2l27.mhbon4.|2o2b2l9.2n2h2l2glja2g4i2gml3eh3j2l26.nmhblo4.|2lb2cd2n5.o2n3o4g3a8gno2h3jlnom4lmn19.nodcb2l4.|2lbc2d2n5.lmo3n4g3a8g2n2h3jono2m2l2mn18.2nhdcd2l4.|2.2n2dcdm4.lmondb4g3a8g2co3mo2n6g2m15.4l3cjn6.|2.2nd2cd2l3.o3n2c4g3a8g2c4lmon6g2l15.3ljb2cjn6.|2.no3cagkm2.2n2dcb4gaf7gb6ca5g2i2m13.2nom6bcjn6.|2.2l3bagfml.2nd2cb4ga7gfb5cbf5g2i2n13.klnj2c5bjo6.|4.2l2adfgmn2o4b11gb6cb5g4i2n9.lmon2gdcdc2abd2l7.|4.2labdf2gk3lh2b2f8gf2c5hj5g3ikm3n6.lk2ik2fdc4bhjm8.|4.2o3df3g2m2lb2cb7gb3dnoml2k3g4i4mon5.2l4g4c2a2d2n9.|2lm3ndc2ab2gnofalhdb6gacdjn2fgi2k4g4i2gilm4.nkg2ifa2cba2b2d3nm3l4.|2lm3ndbabc2g2m2a2ndb5gab2c2n2a2glk4g3i4gml4.nkg2i3bc2a4d2nom3l4.|2lb2dhneb3ab2l2g2n2dm4l2bjklo2n2g2l7g2ilm4.nmg2ifb4a2b2enj3d2c2l4.|2lbc2dolb2a2b2l2g2n2dnom2l2b2l2m2o2g2l7g2imn4.nm2gibc4a2b2e2nd4cno4.|2.2n2dc2b2a2blm2amono3elmlm2l4g2i2cdf2gi2k2l4.2l2g2id2a2b2ab2cb4c2dnl5.|2.2n2dc2b2abc2n2al2mo3ej2om2l4g2i2cdag2i2kml4.2l2gijd2abd2a2b6cdkn6.|4.ol2b3abd2nm3l4e2h3e2l11cj5i4l2g2i2babc8a2bcdmo7.|4.2l2b3abd2nom2l4e2h3e2l7c2b2cj5i4l2g2i2babc8a3bh2l7.|6.2ld4a2o2n13eln2d3cb2g5i2n2a2l2g2ib4c4a3dcm3l9.|6.mldb3a2lon13e2n3d2cbg6i2n2aom2g2i2c3b4a4d2nml9.|8.nec2l13e2h2k2n6e5ilo4a2n2g2i3b2ab3c4n13.|7.endc2l13e2h2k2l5ej5ikl4a2n2g2i2c2bab2cbl3na12.|4.ml3dcb2l11e2hl3m6e4i3m6a2n2g2i9c2b2c2d2n7.nm|4.lm3dcbelh4e8hj3l4ehj4i2nm6aligijb2d6b2c3bdj2n7.2n|4.2mnl2c3b2l3mono5n8e4i2n7a2l2g2i2cdb5a6blmon5.lmon|4.3nl3j3bh2fhj3km2nh8e4i2n4a3j4ihb2c2a5b2c4j2lm5.mjh2m|8.3lb3c2a2d4inj9e4iml3a4n2g2ib2cb2a6cdno2m7.2n2b2l|11.2l2n2ac2bh2lnj5edcji2g2i2klmnk5i2b6acdo4ln9.ojd2cml|11.4n2ac3b2lmj5ecb2i2g2i2kl2m6i2c6ad2nomlm9.2ldc2dnm|11.2nedcb2co3l2b6cb4g2i3g2ikmjh2b4c3b2c2d2nl5.mn2.mjb2acd2n|11.2nd4cd2nml2b7c4g2i3g2imn2hcb4cd5cd2n6.lm2.nhb2abd2n|11.nom3l2m2gol4b3c15g2l2b3cdnom3lm2n4.ml2blmnhc2blm2.|11.om5lm2gnl6bc15g2l2b2cbc3m2l2mon4.2n2bl2mh2cb2l2.|15.lm2gml3b2c4b4gml11g3nm2l11.2nd2c4b2abc2l2.|15.lm2gml3b4c2b4g2m11gm2nm2l11.2n4c3b2abcml2.|15.ml2g2ncb2ab4a4gon9g2i2g2n13.mo4anl2a2bc2m2.|15.om2g2n2b2ab4a4gol9g2i2g2n13.2l4a2na4bom2.|15.2n2g2n2ac4abc4g2i2k5g2i4g2b2n5.om2l2.2lbd4nd2con4.|15.2n2g2nabcb3acdf3g2i2k5g2i3gfbdon5.l3m2.2lbelmno2cd2n4.|15.2n2iml2bcbab4cb4g2l2ig2i2g2i2b2h2d2n.2ndc2n4.2l2ioncjo2m4.|15.nm2i2l2bcba4c2b4g2k2ig2i2g2i2b2helnm.2ldc2n3.nk3imlcdnon4.|15.2m2i2lb6c4b4g2inli2g2i2g3cd2n3mk2bc2n2.2n4i2lcb.2n4.|17.kl2m6c5baf3g2ikl4ifad3cdk3mja2blm2n4i2k.3b7.|17.2mond3c6b3c4g2im4ib2dc4b3mja2bl2mn4i2l.3b7.|17.2m3nhc6b4c7gk3m2no4l2nm2gi4a2g2i2hom.3b3.bd2.|17.6n6b5c7gk4no4mo2nm2gi4a2g2i2e2n.3b3.2d2.|20.2nled3b4c2e2i7g10i2g2i3a4i2e2n5.b3db3.|21.ml2e2b4cb2e2i7g10i2g2i3a4i2e2n5.4d4.|22.2lmn8e2l9g2i2l6i2g5i2e2l15.|23.monh7eom9g2imo6i2g5i2e2l15.|23.okilo6e2n2i5g4i2n2e7ih3e2n17.|23.nkikm6enm2i5g4i2n2e7ih3e2n17.|24.nm2i3n2o4ml7ilm11elo2n19.|25.nkil3nm2l3m7ilo11e2lmn19.|26.2n2h2n6.3no2mo2.2n2o4no2m23.|26.2m2h2nl5.2no2l2n2.n2mo5nml23.|24.l3m2hl2mo6.o2hln36.|21.2nml3j3hjon4.olj3hjlm34.|21.2nol7hlm4.ol5hlm34.|17.2nmle5heh4l3.nlh6eln34.|17.2nml2e3h2e3no4.2o7eon34.|18.nm4lo3no5.2lehl2h2ejnhe2n32.|19.4o2m3n6.ol2e2l2heln2e2n32.|34.2n2l.lo3n.2n2m32.|34.2n2o2.m2n2.n3m32." },
  Isabel_in_1: { w: 50, h: 49, p: "f0d2fd,e7bffe,e6bdfe,e6bbfe,e3b9ff,d9a7f9,c093fa,c18df9,b789f8,de68da,9d6ae2,9b23ab,4f137e,18023d,0d012c", r: "11.g38.|10.faf23.i13.|11.f23.iai12.|5.i30.i5.g3i4.|4.f2i34.i2fgi4.|3.2ie2i12.o2n18.keab2i3.|2.2ieagi11.3ono3.2n2o10.2iae2i3.|3.e2gi11.nodbc2o.o3n2o10.4i4.|4.fi9.o4nf2ben2oede2n11.2i5.|15.on2kmk3delkd2b2n5o13.|12.4of2b2khedcef2be2mkfefmno11.|11.n3omlgbc3ed5b2gfedcbeko8.ia.|9.onmg2b2gd2c2dc6b4d3cde2o6.ifib|.i6.oni5b5c6b2c2d2c2dgk3n6.ibib|kak5.omfc5b3c4b2lkec2bc3dcbfkn2o5.ie.|.k6.oni2hd3b4c2bilakidc4dc4bfn2o7.|8.2nmifed3bc4dlj2ale3dc5bcdfmo7.|7.nmkf5d3cd3c2l2jle3d5b2d3eno6.|6.omf2bcd2e3d5bk4l2e2d4bdedgieno6.|5.onec3bcd4e4bcei2m2ecbk4mledehm2n6.|4.2ni3ec3be4mkc3deife2bkm4l2medbgno6.|i3.oniefec2bk7m2ed4cbil2aj2lj2m3bf2o5.|4.2oihf3bkm2j2l2a2lec3b2cmj3aj2ljmk2bclo5.|4.2ong3bem2j2l4alk4bceml3aj2ldjm2b2eno4.|5.nlgb2e2mj2l2j2a2jm2bcd2emljd3jldfmbc2e2n4.|4.2n2gc2emjd2l6jmbcd3eml6j2am4b2n4.|4.2n2gc2emjdl7jmc4dc2l6j2amcbefno4.|4.n3g3emdalja5jm3dc3bl5j2ajledhino4.|3.2nghi2edmb2a7jm3ebd3bljd3ajl3efno5.|3.2n2hifedhl3a5jl2edhmi3bc5ml4ef2o5.|3.2o5iechl5adm3ec8b4hbd2efhi2o4.|4.2onl2if2bhl5m3edc3b2c4dc4bce2hi2o4.|5.2oi2h2g4bc5e2d7c2de2dc3b3gh2o4.|5.2o2h2ge2bc2d3ed10cd4ed2b2g2kmo5.|5.on4gfbcd4edc2b8cd5e2dhgk2no5.|5.ong2k2g6edc3b8c2d3e2i2hgkn7.|6.3nhghi4eh4b9c2b2he4ihmn7.|6.g2n5h4g4b8c3bgce5imo7.|7.2oi5h3g3bc6dc3bg2bh2i3k2o7.|7.2o4ih6gbcd2e2ihg2b5ghim3o8.|7.3oilk8gde5i9gk3o9.|8.4on5gi3gh5ih4gi2gkno11.|9.4on3gkl7h3ik3imln2o12.|13.3nmk2mkih3ghil3nmkm2o13.|14.nol2k3m2l3n4ol3k2o13.|14.2o5k2o4no2.onk2h2o13.|14.2okf2i2o9.2n3o14.|15.6o11.3o15.|16.4o30." },
  Isabel_in_2: { w: 63, h: 68, p: "fedcf4,f9b8fc,f394fa,c48cfe,cd85fd,af83fe,b97efe,c16df7,a065ee,8e49df,833fd6,6026a4,230251,15013c,0f0130", r: "34.n4o24.|32.3nc2bn4.j8.b10.|19.jeb7.i2onh3bin24.|18.i2bj6.2nle5bio7.3i14.|19.2i5.o2ne7bjo6.i3ai13.|25.2oi4b3e2bcno4.i2ah2ai12.|10.n2o11.2oc2b6e3bho4.iaiagai12.|9.nlhno9.2oh6ec3e3b2o3.iag2abi12.|9.mdbh3o6.2ngd4e3c4e2bko4.i2ebi13.|8.nl3bhm2n2o3.nj2d2e2cb2c2e3dbjn5.j2i3.i10.|8.nh6b2j2o.on3de2c3ac2e3dbh2n21.|7.2n2be5bil3on2de2c4a2c5dino21.|7.2nb4e3dgik2njde2c5abc5dj2n3.3n3o6.n5.|7.njb6e3dilnjdec7ac4d2j5o4n6o3n5.|7.nhb7e3dimjecbh2l4ac3dg2j2onjfg2e2cbkjkjibn5.|7.nhcecbc3e3dimje2ckfl3abc4d2jolf2d12bn5.|7.nhcec2b3ce2dimj2ekjfkl2ac4d2jnmg3d4e7bcn5.|7.nhcecb3a2cedim2jkgdfilabc3dijmk3d11e2bln5.|7.ni2d2c3a3lgj3mld3fjkcedg2jlm3d12e2bmn5.|7.nj2d2c2alkjk2mk3fd3fj7km2d2e9c3e2bm6.|7.mk2gec2alkfjki4fd6f3klmkde10c3edbcn6.|8.nk2gcbalk3f2d12fikljdeb7a2c2ed2bko6.|2.c5.oljdecbli2f2dg13f2j5l5a2c2edebhlo6.|2.b6.nj2iel4fdgfjlk11f2j3fl5a2ce2dchino6.|.db2d4.2n3il6fi2cji14fil5a2c3de2jno6.|2.bg6.on2l6fjcacji14f2k3ab2ce2deij2o7.|2.b6.n3oice4fl3cji14flb2abce4d2ij2o7.|7.o2njom3cg3flh2ci15fle3ce2dg4ino8.|6.nokgdmckn2c3fl2hck4fge2ceg5fjl2g3d2i2jk2n4.ji3.|6.nk2g6nc3fl2hl4fe2c4bc4fim8in2o4.i2bj2.|5.njcdim2ni3nc2fi2l4f2c5mb2c3fim5i4no6.3i2.|4.omcb2dlnhm2anc8fgc4m3n3c2fim3n4on13.|3.onib2delncm2anj8fem2n2mel3nmkfimk3iji3o4.2j6.|.onlc2bgeblmcn2anm7fejm2a3mcm2nm2fim4i3gi2n3.gi6.|.ok3bgecblkam3lm7fkm3a3n2c3m2fjm3c3gdbeno3.eg5.|.onk2bdecblkamjlkm7fkm2a3knaclm3fkmcbce4dbh2o5.2i2.|2.dnl2bdeclkbi2hcm7fml5kmachm2fj2kl2a2c2dg2blo5.ci2.|4.nkbcgelmeakhcm7fml3k2cm2akm2f4kn2a2cd2gbcn4.2bij.|5.oic3gnjda2lm7fmk5cm2al2fi4km2ab2cgd2b2n5.2i.|5.2oh2gdmli12fkj3cl2a3f4kln4a2ced3b2n4.e2i|6.onigdfml13f4lda3fi2klnb4a3ce2d2bclm4.2i|jf5.onkhghml4fk2ij12f2jkli2c2b3ceg2de3bin4.gi|ke2.j3.2o3monlj3fkl10fij3kli2hg4e4g3bhlmo2.2chi|4.j6.5o2mk11fj4knm2ih2i3g2d2gcej2mn4.h2ij|3.gjh11.onl9kj3kmn2onih3igdecbck3n6.2ih.|2.ije2j8.5onm7klmn2m2kl2ol6ig3no6.3igd.|gkjcae2j5.4olkol12kml2kl9o2n8.3id2.|2.ijcij5.onlji2km10klkjkml2kl2o14.5i3.|3.ikj5.2oce2fklm2fi6kl2f2jkn3klmo12.4i5.|4.j2.2i.2ojcdgfkmj8fn4f2kon4km5o5.2d9.|4.j5.okigi3koj8fn2fe2gkokm3kl2m2kn2o9.i4.|10.oml4kmnj8fnif2egjoklm2ln3g2ec2n6.2i5.|11.7onj9foiecdjo3knki3gd2ecln12.|5.2k5.ole2dfnk9fnogcdln3kni3kid4el2o10.|5.kgk4.oh3dj2ni9f2nkin4kmi3g3j2e2clm3o7.|5.khj3.olced2jdnj10f3n5kml2g3d2jg5cmo7.|6.k3.2mecdij2g2oi11f6k2ok5dijicecmn8.|9.nmece5gm2oi9fj5k3omkd3e4cemo9.|10.2mi5hm3omkj6f5kln2o2.onie3cilmo10.|11.2o5m2o.2onml9k2mlno3.on4mno12.|22.onkl2m6nm4kno22.|22.on4k3o.n2o5ko22.|23.ol3k2o3.onki3k2o21.|23.2ok2jno4.nk2g2k2o21.|24.2ojmo5.on2g2j2o21.|25.4o6.ongik2o21.|36.on3o22.|37.3o23." },
  Isabel_in_3: { w: 61, h: 74, p: "fce0fe,eaa7fe,da8dfe,c986fd,cc81ff,d776fd,be75fc,bc57f8,a04ce9,9938e7,8634d0,7824c9,440e82,180140,0e012d", r: "28.on31.|14.i12.o3n30.|14.i11.2nbcno29.|14.i10.on2afho10.d18.|13.ibi8.2o3agcno9.d18.|11.2icab2i5.2o3acfifn8.2cd17.|13.ici6.2n4a2fifio7.dbd17.|14.i6.on4ab2f2ihn6.dcab2d15.|14.i5.2o5a3f2ifhn4.2db2ab2d14.|19.2o6a3f3ig2n5.cbcd16.|18.2ob5ab4f3ifno4.bcd17.|8.3o7.2ob4abic3f2ij2ho5.d18.|8.nflno5.2nbf3a3ib2f3i2c2o4.b18.|8.nb2fn2o3.2nb2fag4ibfi2clh2o23.|8.na4f2n2.2nb2fbg2hijh2b3lho11.n2o10.|8.nac3fcno.2ob2fbg2hi2fc4lhn7.2o2ngno10.|8.n2a2fbjho.2ob2fbg2h2fgc3lkmn3.4olb3a2n10.|7.me2afchkj4ob2fb2h2f2gh3li2n2.2ngb3a2bj2n10.|7.nc3a2ijli3ob2cbh2f2gbh3li2o2.nb2a3ba2j2o10.|7.ngaeai2jli3na2cb2f3gbkj2li2n2.mc2a2ba3j2o10.|7.nifhgb2j2lh2nb2ca5gbk2jmo3nok2f3a4j2o5.i4.|7.onf2hb2j2lh2nb2cb4gbk2j2mbajo4f2ai3jf2o5.ig3.|8.om3hb3lhlo2cb5gbkjm3abjoc3fa2i3jf2o4.gdg3.|8.onf2hbk3lkndca5gbkln3aijn4fbf2c2ifno3.igbd2i.|4.4n2ogf2hf2lmlmica4gb2kmbha3jn3fb3libcf2n5.gi3.|4.nbhinonf3h2li2glgb5gl2mbh3bkn2fb6lk2n6.g4.|4.ocaecg2nhijl2g2cgk3gklmjmaec4lhfc2l2j2lmon12.|4.2oac2hjnmklg4ceg3l4gm2cgl2kn2fjl4jk2o13.|4.2oc2fhjlkg5ck9elfc2ljmg2fk2j2ij2o14.|4.onkjlilke5clgk3d6elcjk2meck3jhk2n4o11.|5.2oljklg3c2bk2ahk2d6eglmlkmck4jm2nkblm2no9.|6.on2kj4edmbafhjl9e3d2l4jmonif4aino8.|7.2nmh4edmfa3f2k3d5e2deil2m3lh7bfko8.|8.ongecb2dml2bc2jld4ede3d2egkjmlf3h3bclgno8.|9.nedba2dlmh2ljmd5eded5eijl3h2bagjkfmo9.|2.d5.2nglea2demhlkm3db2e2d4e3dhjlhcbh2ljhli2o9.|.cdc4.nlm2nbd2ej2lm3eab4d4e3dejlc6lfhno5.3n2.|2daed3.nkm2nh4e2m4ed2eh3nk6ej5l2hj3n5.ngbgn.|.ded3.ongm2am5e2d5ejm4nl3e2dj2k2hin3on5.ngafbfn|2.d4.ongldam6e2d3eima2ml2nke2de2jl2n4o6.nmi3fhm|7.nmglkam4e6dgm2a4lnkedeh3jino9.nml2f2jm|7.nlejfjm3e2d3e2dkm2aklklmi2dek4jno9.omlifljm|7.njelkfm5ded2edmldgjh2jm2degkbi2jn11.m2ljkin|7.nj2ekjm8d2em2j2ibckm3ejki2jno3.n3o5.ml2kn.|7.oj3elm5d5e2mj3bci3eg5jo2.2nkcko6.mkn2.|7.2ohe8d5egml2fek2e2c5j3omgebijo7.n3.|8.om6ed4b5e2ihi2d2ci4j2oknjg2ejlo11.|2.no4.onie2d2eh3b2d8e3d5j2oinmihb2jml11.|.nfim4.oni2d2egklk2ded7ei5jmkm2njkhikh2n3o8.|obahin4.o2nh3e2ged2e2d3eh6j2m3jm2kh2lhmlaeln3o5.|obabfim4.3omh4e2de2dgi2jk2jl2m6jli2ljnib4acjn5.|ohfbfhlo5.3omk11jk2m2k4jhigklilmh2b3agcdn5.|ofjhc2jo7.3onm10j2k2jk2gcbegel2mf2b2ha2gbmn5.|ohlkbljo7.nlm12j3k4gba3gemcf3hcagbkm6.|.nh3ljo6.2o2jhj3k7j13gm4h2babiko6.|2.n2ljlo6.oi2j4g3k2j13gadgm2h2fi3leno6.|3.n2ln6.2oghj11glgec7gbcilkf4lhi2o7.|4.2n7.odcik4gb5g2l4c2gk2g2deij2m2lhi3o8.|12.2o2bhki2gcad4gmd4cgjk5gi2jl2hn2o5.c4.|12.oi2bhknhc2abc2glmb4cikm5gigjkn2o6.3d3.|12.oi2fiknic3ab2gmha3c2imj4gi3jk2n7.db2d2.|12.omcfjnomgbab3gm4c2j2m2j2gicbi2meb2n6.cd3.|12.2o2l4o2gbe3gme2cjkmn3j2ijicjmi3bin10.|13.4o2.oi3g2cgk2ijlom10jm3lhin10.|19.2oi2g2c2gi4m10jmo5mn10.|20.o2l6gi5jh4jijkn6o11.|20.onjlm3k6j3g4jl2o17.|20.on3j2mk5j4g3jk2o18.|21.nk3j2mn2onl4gjkm2o19.|21.on3i2l2o.oni2g2jkno20.|22.om3ino2.2okh3jk2o20.|22.6o4.on2jik2o21.|23.4o6.6o22.|34.4o23." },
  Isabel_out_1: { w: 37, h: 49, p: "fdccf3,fdc1f2,f8b2f5,e4acfe,f0a8fe,dda6fe,dc95f3,f37edd,b786f9,b072f0,9f65e5,7e2ca2,1e034b,0d022c,0c0029", r: "17.o4n2o2n11.|15.4o9n9.|12.2n3oki5efjl3o7.|11.2nmjg8ea2efkno6.|10.2nj2id8ec3edkno5.|9.2nk2i9egml4em2n4.|8.2nl2id9elhal4el2n3.|8.2n2ig10elhagl3ef2n3.|7.2ok2if10el3hl4el2o2.|7.on3i11el3hl4eg2o2.|7.ok3i12eh2l4ekgko2.|6.2n4i18e2lmjo2.|6.2nf3i4efl2mk9emanio2.|6.2nf3g3efl2m2ak8e3mgn2.|6.2nfgig3el3m2am8em2lc2n.|6.on3ig3elf5m5e3mgljac2n|6.onigig3elam3lm4elkgjlbdab2n|6.onjf2gf3eka3lg3elkjebc2lfb2o|6.2nkj2ig2e2c3ac3emk3gce2g2l2o|6.2nk3ji6c2b2cmli7gjn2o|7.2n4jd5c2b2c2m7klmn2o|8.nl3jic8bc2m5k2ml2n.|8.onk4jg2c6bejn4o2k2n2.|9.nm6jfc5bd7jlo3.|2.omo5.nmk17jkno4.|.nmfl2n2.2nm3l13jklno5.|.nj2fk2nonk18jk3n4.|2ni3fj4k2ji4f7j3h2jmlno3.|ok2i3fijml10fj9hlk2o2.|o3jif3mk12f2bc4hcbl2jo2.|o3jim10fj4f10bilinl.|n3j2m2lj7fj3f12bliln.|nlijni10fl3f11bamjlo.|nm2jmk10fm2f11b2amjln.|.oljomk3j5fkm2f11b2am2ln.|.2o2j3ml4f2imjg13bhml2n.|2.okjkmji5jkljh12b2hm2n2.|2.on2jlmk3jl2mij2h6b2a2b3h2n3.|2.on2j2i5ml3j3hc5b2c3hk2o3.|3.2nk11j13hj2o4.|4.2nl10j12hjno5.|5.2omk9j9hjl2n6.|6.3onl8j5hjkln2o7.|8.2onmlk9jlmnml2o7.|10.5n5o3nml3kj2o6.|11.nm5l2o2.2nl2kgjno6.|11.nol3jhj2n2.2n3on2o6.|12.2og2lek2n16.|13.4o2no17." },
  Isabel_out_2: { w: 70, h: 73, p: "eec4fe,d8aefe,d6aaff,d4a9ff,d4a3fd,bc8af9,af7af6,ab74f6,a26ef0,955be0,924ed6,743dc2,4b1a8d,110134,0d002b", r: "39.4o27.|39.okano26.|39.onedno25.|24.3o2no2n8.2nabno24.|22.6o4n3o4.2om2ajn3.l20.|11.e8.3onf6abkno2n.2onf2ajn7.l16.|11.hg6.3nf11ae4niebaejn7.l16.|11.hg5.onf7ab3db2ab4e3agjn6.3l15.|11.2f4.ong7a2b5c8afgkn4.3lf3l13.|16.one7a6c3d6be2imo6.3l15.|16.oie2akmba2b8c6e2hl2o7.l2.l13.|15.onedbmahl3b8cbcf2k2ikn3o6.l3.l6.n5.|6.3o5.2n4dmabkm2b8c2bej2l4nln10.l5.3n4.|5.olmn5.nm2b2cmj2km2d9c2d2ef2kibln9.l5.onf2n3.|5.nlhmn3.2ok4bmkikme2d3cb2c3dfh2edc2bmn4.l3.l5.2oaf2n3.|5.nlhimo2.2oj4bmihm5dc3bc3deji2ecbimn3.l2.fj5.2naegno3.|5.nk2ik2o.2onj3de2mb3del2nmg2e3dil2j3i2n12.2n2agh2o3.|5.ole2ino.o3ne2d2ecbcdel2okn2mcb2cim4j2o12.2n2ae2g2o3.|5.ol4im.2oanie3dc2bcg3n2fmj4bh2m2l3o11.on2ad2fjno3.|5.om2i2fk2nomnid5c2bmf2n2amj4bh2n3o11.3o2ae2gfmn4.|5.onihe2hinolmi4b2c2b3nm2amedcb2h2n12.3njabf4g2n4.|6.nl2ig2imoame4mc2demlklal2e2deih2n8.o4nf2ac5gln5.|6.2n2i4jnjfm2aejm3e3lba2e3de2i2o6.3omgf4agfb2gjno3.i.|7.nm2j3i3mfaefhjl2edc2bc4de2ilo5.3nlb4ac3gbaghmn5.i|2.f4.2olj3ijnm2ael2fim2edcb2cdb2e2i2o3.2nld5abf5gfgjno3.f.j|6.3on2jij2o2a6fkled5cde2il2o2.2ob3a2beh3lj5g2n4o.f.|6.o2nlk2jmn2ae5fgklhed2c3b2hj2o2.2oe3adeklkcbcmh3g4n3o3.|6.olj2l2nj2a6fikmig3dcbe2gh2o3.om2a2bfjlf2abhl2hjlnm3glo3.|6.ol2jlnfeb4fghklmlih4e4gm2o3.ob2ae2lhgd2bgk2hjlih2gdflo3.|6.om2jk2n6k2m2n2l4k4hglno3.on2acjk3h2dgk3gj3hgb2fno3.|3.l2.oni3j8n3o5li5h2n4.of2afl3h2gkl7ghf2gln4.|2.k4.nl3j5k3jm2o4l6hm2o4.obacgl2ghjljhli2fb2gbghgno4.|.l5.2nl11j2n2lh2g4hi2o4.2nbaeli2ghf2e2dl3gfa2gj2o5.|.l6.2ok3ja5j2nj4h3g2hno5.nl2beli2hfac2dgmhgce3g2o6.|.l.l5.onk2jg4jkong5hgfbh2o4.2oe2bgl3g3bcjl2he3gk2n7.|3.l6.2n3ke3j2oi2h2g2hf2bh2n3.jomd2blk6g2lg4h2o2n8.|2.lel5.3n2k3j2nk3h3g2dcbgk2n2.2oe2del5g2lh3gjm3o2n5.l2.|2lfabkl3.nlklk3jnl4hg2b2c2dhkl2n2of2delkh2g2jilh6g3hmn3.kak.|2.lal5.ol4jkomfbde2d4c2d2hil2nhdcbdl4hc2bglg3hgcbfhmo4.k2.|3.l6.oni3jnofd3cdcd5cdhlnm2b2cblig2hfed2bl2ghafc2gino7.|3.l3.l2.2omkj2nc3d10cd2ldc3bclj4gf2hkl3g2e2hgi2n8.|3.l8.omkne3a2d5cd4c4dc2bl2gh2gi4l2hgaf2ghlno9.|12.2o2n3ac4d3cdcd4c3dhk3g3hgji7himn2o4.lj4.|13.2nd2a2c2a4dc2d5cdci2h2g3h3glg2hlm5o5.fl2k3.|7.2l4.ni2aec3ab5d8cf5hjl2g2l2g3hn2o.o5.3lk3.|7.lf3.2n2abdab2a3c3d5c2bce6hi3l2gfe2ghn5o4.2l4.|12.2o2beba2c3b2c3af4c3df3h3ghih3gfgiln2o2lno9.|12.2oebleacbe3ab3aje2dc4dfhk2g2hil7nol3jlo9.|12.2o2imfab2f3a3bfje6d2cfim3hin4o2nl5j2o9.|12.3o2li2bfjb2ab2ljge6d3c2glm2non5k4jlno10.|13.2ojglfeilg3elig8d2cdfh2g3l5k3jkl2no10.|13.2o2filfi2l2g2lgb3c9df6g4k2j2ljm2n10.|13.on3fi2l2i3lh3b3c9dh4g2fkhj3k3j2o10.|13.2njfcd3ie2ihed2b2c9de3hg2fkgj6k2o11.|14.2nif4e2dc5dac6dcbd4hgilgf3j2kl2o12.|14.2ol3ied3bc7dcd2c2bf8hgjk3j3o13.|15.2ok3hg3bc8dc3b2g8h3k2j2ni14.|16.2ojh4gbd6edcg2h4g6h4kl2o16.|17.2o5g16h2g4h3kln2o17.|18.2nk2g19h3g3km3o18.|19.3nk5h4g2h3g6hgjkm3o20.|21.2omjih4g6hg3hih2ln2o22.|22.4om2l11ilm4o24.|25.3onm3n5onmn3o26.|27.oml3n6olkno27.|25.2nom2ko6.2okmo27.|22.3onm4k2o4.no3ko27.|21.2o2kg5k2o3.on4kmo26.|20.2onkfg2kfkmno2.2o2kg3kno25.|20.3on2okgjmno2.2ogkgf2kfmno24.|22.on7o2.2oe2kgefk2fno24.|33.6og6o24.|33.4on8o24." },
  Isabel_out_3: { w: 77, h: 78, p: "fefefe,f3cbfc,d390ee,b56eef,b353e7,945ae3,8b57e4,8d39cf,7330c4,6027b1,5718a5,481a94,481390,1b0445,0d002d", r: "29.2o46.|28.4o45.|28.2oh2o17.3o24.|28.o2f2o16.onmo24.|27.2ofi2o15.2ofjo24.|27.2ofk2o3.3o9.onfio24.|26.2ofij2o.3on2o6.2ohefno24.|24.3okjmj4on2fmo2.5ojdfj2o24.|23.2ol2hnon3og2fin6onlhfjko25.|22.2oefilon2ol3fjk2onlfdhkf2hk2o25.|22.oicimolfojd4gkon2e2d2hm2kj2o25.|21.2o2imoncfj6gonece3h4mn2o25.|20.2o2hloncd3f4g2ohdejh4k2m2o26.|20.2ohing2d7fgo5h3mkn3o27.|20.2ojmf2d2f2g2fa2fn5h2mjn2o29.|20.2onjfhm4g5fj4h2mk3o3.3o24.|20.2onfhbcm2gb6fj2hjnm7onio24.|20.ongfiacm3gf2gfg2fim3nm2j3nihlo8.c15.|20.on2fjcem12g3i3j2hegh2o3.c20.|19.2oh2fk2em6g3f4g4f4gilo4.2d19.|19.on3fjej6g3c2f5gb3fijm2o3.cfdc18.|19.2o2g2fm3f3gc2dg2f6g2f2jm3o2.dfgfdc17.|19.3o3g6fcdl4onj2gd3fjm3o5.fc5.c13.|19.oao2g8fj2o3cngfg2fgfji2n2o4.d20.|19.oin4l3g2fgnfn3an2g2f2gfg2fhn2o24.|19.oi2n2cjm3gfn3mhamig3e2g3ij2no10.9d3e3.|19.2on2b2cmj3gnhijabjg4e2gkl4o8.3ej11l2d.|19.2o2b3cemf4g5fe2be2gik3o6.3de7lg8lid|19.2o2b4chn6g4f2cf2g3il2o3.dei4li7dceklj3le|18.2o2b2cf3ci2n5g5f2g5i2o3elkg2di10ljfik3le|17.2o2b9chm2n4g4f2ij4o3lkik3l7dh5ld3lid|14.4o2b12ceho4g2f2jk2om3lh2lie3d8adj3lc4ld|13.2on3b10ce2neho4gi2kj2o5lkedb9a3oac3le3ld.|6.2g4f2oe2b10ch2n3h2o3gj3k2ol2k2edc12aoj2oc2lge2lid.|5.hi5j2o2b8chmnm3heon2gh4k2omk2d15a2ohioc2lgk2le2.|5.gijg3e2ob6chimn4hm2on6kimol2d12a3o2aoh2ileli3kd3.|5.gijd3a2o3cdi3ni3h4on7k2h2o14a2ojobom2ehcki3kd4.|5.h2ib3acondh2o4h4on8ki2hio14a2o2i2onhidch3lke5.|6.hic5aono7n3o4kj3k4hn2ob8ob2a2oj2iln2h2ch2k2ld6.|6.3hc5aof7a2o5kj2kh4en2onmk2jijkn4o6ihdc2j2khd4.dc.|7.3hb11a3om6kih2ed3eiji2h3g3hi3on5ifc3klcdn3.cfc.|8.2ihc9a3on4kji2h2eba3ei9ji2hij2o2nicdi2kl2c2o4.dc.|8.b3hc7a2onoh11ea2ehji3f3g4ji2hjmocbfj3k2cm2o7.|10.i2hc5a2omnjh13e2hg3fb6ghjkjkjcbj3kbchkl2o7.|11.2hfc3a2ok2ni3f11eh4fbac6ghkmlbc2klhbdki2k2o7.|12.g2hcamo2joi5f9ef2gfd2fb2f2gd5gbfj2k2cdmkcek2o7.|6.f6.bhifb2imn2gcd2fgc6ef3gd8fdb2g2bd2jh2bl2o2khmof7.|13.2df2i2boifg2b2f3ge5f5g9f2bd3jcbcfh2oc2k2o8.|12.ei2md2id2bfg6f2gb2g4f5gfd4f2bh2ij2chjmn2o3k2o8.|2.cf6.ci3m2lhi2j3b2g3fd6gj2f6g3f2bd3ibcil2n3io2km2o8.|2.3f4.dkljmec2o2di2gbc2f2d5g2fmf2gc5g2bf3if2bl3ib2ikn2k2o9.|2.cf4.d2klme2a2ojo5gb2c5g3fn7g2be3i2dbeim6ionkm2o9.|7.di2jkd3a2ojokhd4gcbc5fgm4gf2bch2ihgbg2j2k4ilonlk2o10.|6.ek3id4a2ojokhedfg2hgcb2c3g2mgdbcdgih2dc2igijm2hkmn2o2mn2o10.|5.d3kle5a2okmji5e3g2fcbfgc3b4ihbfg4himnm3nmon2m2oh10.|4.d2lk2md5acomlmjih4edf3hd4b4id2bc2hil2nm4k2jn3mnohih9.|3.e2lhlme7aonko2j5h2fh4bhcb2igbik2icfi5k2jijn3mn2ockig8.|2.d2lgl2mc8a3on2j2h2ic3b6id2bj5k2jd5km2om2lm2o2adji8.|.dmlfdkmh9a3on3je3bf6icbdjkc2bd2m5jkn2onm3k2o4afkj7.|.d2mhbi2ld10a2ok2bdf2j4ic2bdifdj3k4b6on2mi2kno5abiji6.|d2mhbaejlm2d7a4bdf4jif3bh3ihifdi2k2lg3b3n2mj2m2o7agji6.|d3mebhl4mh4dcdj2k6jc2b5h2ij3mk2dhlk3l2bch3m2o8afji6.|d2m2ldi2l7ml2k2lc2kdc2bl3k5i9m3f4kj4bd8afiji6.|dm4ld9fd3k2lkdbl4m3kb4mih8ml2dg4kli9fgjig6.|de2mc6mc7m3d2.2on2md8m2d5mb5mlkfgi15j6.|.2d8m3l3d2e6.2on24m3o4.d8jc8.|3.11d12.4on2mh15mn3o24.|28.6o12m2n4o25.|15.f5.d8.3o2n10on2i2o27.|13.cdg2d13.noki2n8o2ji2o27.|14.cgc11.4olj3i2o5.okhi2o27.|15.gc8.3onjehj2h2i2o4.2oi2hl2o26.|24.2oh2chjhc2hino4.2o2hd2hio26.|24.2ojehjb2chm2o3.2of2edc2hcl2o24.|24.6o2c4o4.o2c2e2c2hcbco24.|29.4o6.oicjhe2c2hm2c2o23.|38.7o2c7o23.|44.4o29." },
};
const PIXEL_ART_HD_B: Record<string, { w: number; h: number; p: string; r: string }> = {
  Lauren_in_1: { w: 54, h: 47, p: "bb928c,8a65a7,825c9c,573679,563479,543476,553377,513273,4b2966,41195e,260e39,150125,10011f,0f011c,0b0016", r: "21.2nm3l2m2n23.|11.o2n4.2l10m4l4.2n2m12.|10.o3no.n3ljf7hfj3l2n.n4l12.|9.2mihl3nl3eg7fgfgfj3nlf2e2l11.|9.2l3hln2h3fg7fg2f3h2mhfgi2l11.|9.2lhgfj3h14f3hjf3gkln11.|8.3lj2eg2fh5fg4fg7f3gjlm2n10.|8.2nlj2e2g6fg3fe6fgegfgfj2inm10.|9.2n2hf5g7fg2f2h2fgeg2f3hm2n10.|9.nm2hd3bc2deg4fg6b2e4fim2n11.|9.nj2h6bd2ef2h10b5hj2l11.|8.2lhd8bd2eg12b2hfg2j2l10.|8.lke10b2e13bcfgegjkl10.|7.2lic2b2lmk4bd5bd4m5bd3e2jml9.|7.nlh2bkalmnj8bclm2nan5b2dg2j2n9.|7.nmdbdal2a2n7bclcam2nal4bdeg2jno9.|7.nldblal2a2m7bimca2lmal4bfge2jmn9.|7.2ldblal3ml7bi6lal4bhge2jlm9.|.mn2o2.2ldblak2m2l7bh3lm2kal4bh2g2j2l4.2mno.|lm2nm4ldbm2a4k2blmk2bhij3kjam4bhgh2j2l2.5lno|2mfg5lhbdcaj2kabk3ac2bcaj2k2al3bchfh2j2m.3l3emn|ml3eil2nicb2c3akcm3al2b2c4ak4b2ghi2jnm2lj4e2l|mlh2egjmokf2bd3lbco2akl4b2m2l4bdehi2jmomlh4ej2l|.mnifh2jolfd6bgk2aldc10bc2d2jm2ol2jf2edinm.|.3okh3jml2d4bdhi2l2dgf7bcdei2jlm4hkhfgkl2n.|.no3k3jk2lidg11f2edefg3h3j2l2eg2fkhiljh2l.|.2n2hi4j2l2j3fe3d2f4de2d3f5jk2d3ehjij2hg2l.|.2nk3g3jmkjh3f4df8d3fh4jfd4e2j3ghflm.|2.onmde2jknjhge2f10de4defh3j3fg3j2e2gkno2.|3.nmle2jkojgegi3b5de4f6ef2j3f3gjgejl2o3.|5.ml2jkojg2ek3bd3be2fcd2ed2e2de2j4fi2jgjlmc4.|4.2m3jkojg2dj2bk4bc2fcbjf2ede2d3jhijkj2hge2m4.|4.2n3jlnj3ekjik5bkhgikh2d2ed3jlkl2j2i2hg2m4.|5.2o3nmkje2djkjk3bdkjijh2fd2ed4jm2n7o5.|6.on4m2j2e2fh2kbcjdej6fg6jkm2n4o6.|11.mlj2h4f3j5d2e2fh7j3mn10.|11.2o3jhfe8d3efh7jkm2j2m9.|12.ol3jhe5defd3e8jlm4j2m8.|13.omk3j2h4i2h10jmo3jk2m9.|14.nl2k18jl2o2l3n10.|16.3mk13jk2ln5o12.|17.oko4no2n4mnonk2n17.|16.o2aocfn5onkdnidok18.|16.o2an2a2nk2.omdan2ao19.|16.o3n2on4.2oakoaln19.|17.no.2o5.7o20.|28.nmn23." },
  Lauren_in_2: { w: 49, h: 65, p: "b1abaa,6d82b5,3a4679,2d4174,2c4073,2d3e70,2c3466,1b2854,18244e,151f49,10133a,090321,06031f,050119,050016", r: "6.mn41.|5.o2n29.3o9.|5.ng2o8.o4n5mn9.n3o8.|4.2m2glm3.n4om8ln3o4.nlkfno8.|4.2mgefl2ml2m2nhf2e4dejln4mnonlfhlm8.|3.onmh2ej2mlge4f2ed3e3f2ij2l2m2fhk2l8.|3.onmiedfj2fe3d4e2d2e3fe2hf2defhj3m8.|3.ojkjg2d5fb2de2d5ede2d2e3dgimo3n7.|3.m4j6faf3eda3f2e3d3fdfhijl2j2o7.|3.2lk2jh3fef2aefe2a3fe3d2fegh3jihi2o8.|3.m2l4jf3d7a5f3j2i6jn2o9.|4.lk6j3d5a3d2j2k5jhi3jn2o9.|3.nlij5bie5fdei2j6b2j2fgi2j2o9.|3.olhc6bi6fhj9bgj2fg2iko9.|2.2ojh8bj4fk12bhj2fg2i2m8.|2.2oj3b2l5bjdfj6b3l5b2j2f2hlm8.|2.ong2bh2kmc4bij6b2mnml5bj3dhimn7.|.2oj3bkcm2o4bh6bn3ocbl4b2i2dhjmn7.|.nmi2bl2bakon9bilam2nbcm4bj2d2ikn7.|.mlh2bnaba2om9b2la3l2al4bj2f2ilo7.|.2mi2bm2a2oml9blmnm2l2al4bj2f2ilo7.|.2nj2bl2ahihl9blghihj2al4bj2f2ilo7.|.oni2bj2a2hgm2b3l4bla3hg2al4bjfh2ilo7.|.nmh3bh2agahbkhcic3bh2agh2ak4bfhf3iln7.|.2nhj3bc2ac2bob2cl4bc4ac5bj2d2hiln7.|2.oig4b2h3bncfhm5bhi2j5b2fd3himn7.|2.2o2g8blcglc13bh2g4hlm8.|2.omh2g7b2lmk13b3g4iknm8.|3.nmhgj7b2l12bhjgh2im4nm8.|4.noj2g18bgj2e2honihikmo8.|3.nmljgfhj13bk2jfd2hkmj2fedfjno7.|2.onhl2hg2fijg7b2ji4f2hklk2f2edefhlm6.|2.ojgnhegig2f2gh6gfg5ik2m2d3e4fg2l5.|.mnfgm2fedf2h9g2hijij2imi3de2f2ac2dmo4.|.mldmh2fe4d9g3d2fi2jle4df2ac2del2o3.|ongdl4d2e3d5f8dejofe4d3ae2defmn3.|2oedl2dbd4ed4ad5edb2dhofe2ded3a2d3eim3.|2o2fm2db3e2f3a5d2efeb3dnfe4d3ade2fefmn2.|2n2fo2f2b3f2afe6d2f2be2dnfe4d3a3fa2dmn2.|nmfio3fbce3a9d3b2feofe4d4ac2afeno2.|onfiof2e3d3ad5e3d2bd2efoh4defb4a2def2o.|2o2iofe4d4a2fefcfedc3defnm2d3efe3c3dgf2o.|2o2imf5df4a2e2afe5dedhmjf3eded2efhdlmln.|.olhkj3de3f6a3f2e5dh2nhfe2dhd3fifl2hm.|.omhjlge5fd4ac2de2fe4dhlolj2gegk3fknmhgn.|.2n2hklfhkfj9dkfki4d2inl2m2fgo2n2okihko.|2.nlhiogf3k2def5d3k2fd2fi2hmik2onl4hl2hkna|3.mkinkgekf2dk3fk3dkd2e2f2i2hno2i2hjk3gl2hg2m|3.onijljf3de5ke6df6i2oi3hl4gl2hno|4.2oijk2h2dfe3k2fe5d2h6i2o3hij3gkm2ho|5.on2l2h2ig2fk5fdg5h6i2ok2hji3gm2ho|6.3nlj14i6h4ijonmh2ki2glkho|7.mnomj15i5h4ik2nmlmlj2glhn|9.2onj3i3h9i5h3in3on3o4lm|11.omjih13i6hlolk2ij2nmn2m.|11.onl2hkm2k4j7i3hln2jl2jihimn3.|13.mlki2jl4nmk2h4i2klmhij2o2ih2m3.|13.3nl3n2o3n2m2ln3ojij4i2o2n2o3.|11.nlkg4ck2o3.2mljc2gomjnmk2hko7.|9.n2lcgl5cg2o.olk5cg3o2nmn2o7.|9.olicl3ck3lmo.ojch2ck3co14.|9.oklnihbn3onln.nclmcbolbjn14.|9.4o4l7.2l2oimonljo14.|12.2ono8.lm.olo2.2ng14.|27.2n20." },
  Lauren_in_3: { w: 87, h: 71, p: "9692bd,7b77b4,665495,3c3f85,4f308c,3d3b83,363b83,31327f,41267b,24205c,211b56,151248,090322,06011c,050018,000000", r: "25.3o25.2m32.|24.mimo25.mco31.|23.nmbjo25.naeo30.|22.2oacm26.ocanm29.|22.2oacn26.o2b2m29.|22.nkbco7.2mn6onmn6.on2b2m29.|20.3mk2cn4.on4mno3n5m2o3.n3c3mn27.|20.2mcl2cfo.n2onm3d6f2jkn3on2m2cim2ko27.|2.non15.2nejicfn3mg13f3jl3m2ceoli2o22.nm2n.|2.4m14.2o3ecf2m2dfg5fdb6f2jk2m3c2l2i2o21.on2mn.|.2m2dmo13.2oj2e2cm3dfgcg2fdc2d5fh2mi3cij2ino21.2o3g2o|.2m3gno13.o2jecack4fd3f4d3floni4c4ino20.3m4g2o|.2n4gmn12.2ojic2acm9f3dlj3b3c5imn20.3m3d2g2n|.2o4gd2m12.ok2i2abek3f2b4f2j3a2bc3j2i4mn17.2ong2db2dhmn|2.om2ga2d2m11.nmlic3bl3dbc3f2lb4ace2jlnonjk2m15.3o2hg5d2m.|2.on4d2gm2o9.mn2o2c2bam5dfml6bcjln2omk2jlmn12.2mno9g2m.|3.mjd5ghn2o7.mnh2jkcbam6dm3b2ci5m2l2k3jln10.n3m5gc4gmo2.|3.2m2dagjh2gn3m4.2n2d2elm2bamdf2dm2abckmk6cjhd3jk2o6.4o2gd3ghg2a3g2o2.|.2mnml2ghjlh3g3m3.2odbcecim2abj2fm2abmkf8cb3d2jk2o4.n3o2h4glj2hag2hn2on.|4m2njg2hjlh4gmo2.ombc4mjkab3mb2alj3mn2oec2ba2df2jklo3.3m7g2l2h3ghn3o2n|2mdenon2hbhjlj4g2o.ojbnic3mf8bek3mnlcm5b3f2jk2o.2m6gjmlj3hd2gm2o3go|2nefdenmgh3j2l3gh3ocbm3am2n7bce2macmna2m4bf2d3jn3o5gj2mlkjhk3gln2h3go|2o3e2gel3jhjkmhgh2oncbm3a3nc7bn2mam2n2am4b3d3j3oh4glm2k3jkhgjl3ga3go|2o2egad3g2jch2kmh2g2ncamac2n2m8bn6m2ao4b3d3j3oh2ghl2jka2jkjhj5gadgln|.on2ed2e2ghjl2kjmjgdnmcbn2a3lm8bo2l4k2ao4bf2d3jn2o2ghl5jckjg3h3gc2ghm.|.2mi2edc3gj2l2klmgd2ncbk2a3lo2bkl4boc3lk3ak4b2fd3jnol2gm5jklk3hd2he3ghon.|2.2nl4eg2hj4kmhgnmd2bf2akajclabk3bj2a2k3aj5b2f4j2n2ghm4jk2l7hf2gh2o2.|3.3o4e3h3jk2lg2nf3bc2ajbn2abcn3bj5ak5b2fgk3jnm2g2lk2jklk2lj2g3h2ejno3.|4.2om3e2gh4jkmgmn2g3bcd2bn2ablo4b5d6bdfjkjk2n3gm2kjkdj2hklk2g2ein2o4.|3.4onmedgkjabhjm2holg7bn2b2mg14b2d4jkon2gj7kg2hlh2e2mn4o3.|3.2o4e2fhlkbh2jkljlokg5bdgmbmf2dc10b3d4j3ohghl2ja3kb2lk2hf7eo3.|3.nm6eghk4jkmkj2oh2d5fk2m2d2fd7bc2gf3jmn2o2ghjk4j2k3lid2h7eo3.|3.2nl2eb2efg2lkh3km2jnl2d5f2df3d12f3jmnm4gkmk4j2hjlhk2hi6emo3.|4.on6eghj2la3kmj2nkfd2f10d6fdfj3k2nf2dg2j2l2ka5jhljga6emn4.|5.oni5ehe2l2kaklnonjhfd3f9d5fh2j2kmjgdfh2jkl6kh2jl2hg5em2o5.|6.2omj2ebh2l3k2jhmnfcbd3f4d8f6gh2j3g3jml5ki4lh6ejn2o6.|7.eimnoiflh3k3jkmd4bc2dfd8fd3bch4f3hjml4j2k3hfilkh2e2o3no7.|8.mnok2ejlhka3j2m7b2d4f10bj5fl2mk3jhabjf3hil4ei2omn8.|7.nmk5ei3lj2knc2ba5bc2f10ba2bk3fj4ka3jdkj3h2lh3eb3ek2n7.|7.mj3ec3ekl4koc5ba10ba7bl3dj6kjdjklk2lh2i2ebab3emn7.|7.om6ejklhjaknc23bjk3dj4kj2l3h2k2ehl4eb4emo7.|8.2o3em2o2e4kmc12b2a9blf3d4jkck2l2hk5em7emn8.|9.ono3n3ehejkmkb2c4ba8ba2bch2bl2f2d2jlijklik2lif4elmn3op2o9.|12.on2ea2eief2mcjd16bjkfk4fd2ji3lhi7eb2e2m15.|12.2n4eimjeinlkd5ba5bc3bcj2fk4fk3jhief5eok5emn14.|13.nmie3nieiokfh2bl8bl3b9fkj2k9ejom4emn14.|14.2o2n2o3eolfjcb2k6bkljb2hdfd5fkjkli3em5e2om2klo15.|15.2o.on2en2ohfj2hkc5blgfkj3f2d3f2k2j2ki2enm4e7o15.|18.2om3onj4dfj4bk9f3djk3j2k3mnon3mn21.|24.nmf2d3fl2bk11fdh7jkm2o2.o3n21.|24.onj6f3k2d9fh8j2k2o27.|25.nljk6f2dfd7fjk7j2k4o26.|25.on3k3f5d3f2df3jk7j2k2om2n25.|26.2ol4kj4d2f15j2ko3kmno23.|27.2o3k23jknm2k2jm2o22.|28.2ok12jk7j2knjnm5k2lm2n20.|29.n2m2j4k4j2k7j2ko2n2km2kjliemno19.|30.m3n6k2jklk7jk2o4kmk2jeh2e2o18.|30.nolk4n4k2m8jk2o2kj2kl2j2e2ieo18.|31.2ol2kjn5onl4j3k2nmlj2kji2m3ikon18.|32.2ol3km4o2nm2j3k2oliml3iei2n4o19.|31.4on2ono4.non2k3omjienl2ieimn23.|28.3o2nm3ion6.2on2l2om2lm3n2lmo24.|27.n2okcie2c2imn4.i2o3in6o.2n2o25.|26.om2ckocb3c2imn2.2on4ce3o33.|25.2oibcncbcm6n.2o5ce2c2o33.|25.olkonkej3o5.2ni2cncbmk2co33.|25.5oimno7.nmj3oemonmcn33.|29.3o9.o2n3oe2o.2no33.|41.3o2.omo3.2o33.|46.mn39." },
  Lauren_out_1: { w: 40, h: 59, p: "59466f,322745,312644,2f2640,302542,2e243f,251637,1f0b31,1d0a2e,090317,050114,030010,02000c,010008,000007", r: "13.2ml24.|12.ml2kl.l2k19.|11.lkfbgknml2m18.|11.jkg2bgmndhm18.|10.4kjc2eieg2kl16.|7.3nm3klmfec2bj4k14.|6.jk2mfe2bcde6bg2jkl12.|5.l2kief4a6bc3bclmn11.|4.nmkjb6a4b5c2efl2m10.|4.2nge7a4b6c3ej2k9.|3.2mifd7a4b7cecbjk9.|3.2kece5a5bcb7c2bh2k8.|2.2kh2bcec2e2cbcbcb8c2bckm8.|.2kj4b2c3e4c2e8cbcein8.|.2lf7b4cec3e2c5bcefimn7.|.2nfmki4b4c4ej2ki5bcfijm7.|.onin2mi4b4cef4lkj2b2cefhjl7.|.mnmj2am3c3b2cej2nljejkc3efhjl7.|.l2mb2an2e2c3bcemn2aj2glc3efhjl7.|.k2lb2on3ec5bkm2am2hm2c2efhjl7.|.2lkbm2nfe2d4cb2klmn2amf2ef2hjk7.|.m2kaihl4fe3cbkhklm2bm4e2hjk7.|2ngi2ahgmn2mf3ebjbikbabm2fec2hjl7.|2m2fi2ak4aeg2fdbi4aied2fihilm7.|lm2fcg2j3abab3f2e4hb2cef2ijn8.|noifgkg7abi2fedede2ce2h2imo8.|2ohlj10an3f3e3c4hk2o8.|.nlk9ablmi4f2e5hikm9.|.m2lj7bj2k2ih2f7hi2k5.l4.|2.l2m2nl2k2ji6hih3i2hj2k5.mkl3.|3.2onl5i9h4i3k5.nlkmo2.|5.3l2m3ji8h2j2m2lk3.lm2fno2.|7.nonj3i8h5ijk5l2f2ml.|6.k2l4i8h2ihd3fil3midckjkl|5.m2k13hifde2d2fginmfebjflm|4.onmi2d6hi6f4dfd2f2dfgd2i2m|3.n2onf9d4f7dfglkdg2ifimn|2.klgng2fhf7d2fg5df2de2cijh3ino|2.kihl2fj4f7djc3df4dc2bk4h2m|.lkf2kcdl6f4delc7defi3k3hkl|.nmglkbdk2jfh2fde3dlidf3d6fhk2h2k.|.2nhmld2fhj2i2f4dfm2i5d5fhk2hkl.|.2mh2o2f2dhlif4d2f2mhe3d2fgi2onl2hkl.|.noinoif2dfhe2d5fil2hgd3fh3in2ilm2.|2.onml2hcde3d5fih2k8himo2ino2.|2.nmlk4he7f2i2hk2m2i4h2k2in2o2.|4.mlk3h2i4f2i5hl5ml2k3hmo3.|5.mli2h4i9h2i3l2ml3hkln3.|6.2n4i14h5i2h3k4.|6.mnoji17h3ijnml5.|7.2onlj16hjkn3o6.|9.nl4k4h4i2hj3kmn9.|11.5m5lm5l2k11.|12.2mlmlk2l2mnonbik12.|10.l3kelml4.mon2bm12.|9.j5bkm4.2kl3bo12.|9.kc3bflm3.mki4bo12.|9.2lm2n2o4.nm4bkm12.|21.2nml2k13." },
  Lauren_out_2: { w: 60, h: 68, p: "594671,302641,302543,2e253f,322346,2c213d,211034,1e0b30,1d0a2f,0b051a,050113,02010b,030011,02000c,010008", r: "23.4n5k28.|20.3on4m4km27.|18.2kmkif5cfgjn2on24.|16.n2kj2c2dc2e3cd2fg3k23.|15.onmb2e5a4cdc2dcgkm22.|14.2o3f8a10ckmg20.|13.mnfdf8ae10cgjk20.|12.2kh2cf8ae11cjmn19.|12.2k3cde5a3e11chlo19.|11.lnd4cbe2aed13cdfj2o18.|11.olf6c3bcb10c3dfi2n18.|11.ojfd10cdcd7ck3dhi2k17.|11.3lf2d7cbdf4d4km3c2g2k17.|11.2lolfh8chfdfi2n2mnj3c2gkn17.|11.nlfnlidb6cgfm4lmilf3c2g2n17.|11.2m2alof2d5cgknalonianfd2c2h2n17.|11.mkajno3fd5cdn2anmhakf3dih2n17.|11.mkajkmfnlnk4cf3onmgajbc2d2i2n17.|11.nmae2km3aek2c2dkg2nfagie2cd2ilo17.|11.oijc2k6an2d2cj3ajnd3c2hi2o17.|11.onfmn7alnfc2e2kmjfd3c2ghno2.2kj12.|7.3k.2ojke4aj2aekj6c4dc3h2kn2.k2b2kml8.|6.kjcj.m2k11aej6cb2d4h2k4.nbfginlk6.|4.kolgb2lmk13ajmdb4cdf2ih3k4.ld3g2hjmk4.|3.kmj2dfon12aeifnf2db3c2h3ion4.kfd2kjihfgjk3.|2.2kjbijgnm10aejgjkif2dfdcg3hi2o5.kbfj3ej2ghjl2.|.ojigighgi2kg4e2aeg3ij2h3f2i5hkl5.nkc2h5e3gjo.|.ojig3egikmlonm5jk2i7hih2ij2k5.on2i3g5eg2in.|l2ig5ejin2oa2o2n3mkmj8hinon5.2oi2ke2g3ejm2n3k|mjkolj3ejij2o4anm5i8hino5.kmhik3eg2ejm3.2mn|mkj2.lj2efe2j2l3a2m13hi2mn2.l2kf2j5e2ik7.|6.lk2f2ejik3mk13hgdghmn2ongijekn2oijo8.|7.2knlnkjghk2mi3h2ihi3hgb2dgjmnoihkjejk3.2lm8.|7.2m3.ln4mgf2ih4i4db5dhj3ninm15.|13.l2nmgcd3f7d5b2d2fgi2mn16.|13.l2oi2b9d7b5dbfhmn5.2no7.|12.mimof3dc8b4d2bd2bdbdbdg2m2.kmn2o7.|11.olikgfgjd8b5d9b2dhk2nmjfkl7.|10.2ninmdgjfd5bdb2d3f2d6b4dbj2ni2fjm7.|10.nmilhfjf2d5b4dfih3d5b2d3fi2nigfjk7.|10.o2gmfdkfd3bd3b3dfji3d4b2dfi2fgikjih2k7.|10.oikm2bh2i11dig2d5b2d2flk2i2hkjkn7.|10.njkm2bchjfdf8dij5b4d3fjoj2i3km7.|10.mjmnd2bd2jfi6d2bhkg2b5dg3fh4j4k7.|10.mikmb2d2f2jg6d3bkjg4d2fgki2h4i2n2m7.|10.mijmf3d4f4d4bcin2i6fgi2kigin2lo8.|10.mkmnif7d5b2dfg2o4i2fdcghj2kmnkjo8.|10.mnmo2id2b4d3b3d2fgino5i5hijmkjno8.|11.2o2n3h2d3b5d3f3inlo2i3hihi2nmijkn8.|12.n2m5h2b7d4h3i5m2n3ol2i2m9.|14.2n2i7h2i11hkmnl3o3io2l9.|14.loli23h6iknl10.|15.oni25h3il2n11.|16.mkh3i22hi3o12.|17.kno2i18hi2hkm2o13.|18.3om11hih6inm2k15.|20.n4m2h10ij2n3o17.|22.2nmk2m7nln3mn19.|23.2mej2ml3o2nojf2m20.|23.km2e2k6.kef2o20.|20.nmkmn2emk6.m2ejn20.|17.n4k5eol5.ol3eka19.|16.mnf5ea2e2o5.kg3e2j19.|16.mng2aefeaekn4.mkf4aejo18.|17.n3km2emkm3.lokae2a2eael18.|21.nmno5.nof2e2a2e2an18.|30.2mlolekmlo2n18.|34.l2n23." },
  Lauren_out_3: { w: 64, h: 77, p: "cdb3d6,643e88,522975,462762,492566,472561,42225c,33134d,2d1046,2c0d44,140727,0b021c,040211,03000d,000008", r: "11.3b50.|9.2b2ab50.|8.b3ab8.2b41.|7.b3ab9.3b40.|7.b3ab9.ba2b7.ml30.|6.b3ab10.b2ab6.2lgl29.|6.b3ab10.b2ab5.mkce2l28.|6.b4ab8.2b2ab4.2mk2e2l28.|6.b4a2bkl4kjb3a2b4lkedh2m28.|6.b5ab2g4eb4ab2lhg3edjmn28.|6.b6ab3c2b5ab3g4egi2m28.|6.b16abce5f2hkl29.|6.eb15ab3e3f3j2l.l27.|5.lkb14ab5ehi2j2melm27.|4.2lecb12abce5fhilmlhlm27.|4.lkfecb10abc2e5fehihch2m27.|3.mlefd2eb7a2b5e6f2g2hlm27.|3.mh3f3ec6b8eg3fg2j2il28.|2.nmjg2f11e4fhj2k4f3j2m28.|2.3mkf11efgi6l4fij2n29.|2.2m2lk3f2d6ehk7l4fhlm30.|2.2mb2lg6fd2eg3libaglh4fim31.|2.2m2ami8fek2l2alagmg3f2im31.|2.mlaklk7fdi3lagiagmg3f2jn5.m2n23.|2.2lajlkf2hig3f2lk2lkbadjg3f2jn3.l3km23.|2.mibg2kg3bj2fg2mcklebaig3fg2jononj2hkl3.2on5mn11.|2.mg2ijla4bkfgmkh3baih4fi2j2n3j2il.2mnkf2e2fgimn10.|2.niegjba2bg2blf7g5f2hiln6jmlkhc2e3ji2l12.|2.omikba2bj4bl2f3gfg5fh2i2m4jnml3ci3j2ekm13.|2.iomh2a8bl9fg2ih2l3ijnmcdgjkie3bkl14.|.mnm2a9b2el6f2gh2ji2m3ijm2ck2je4ben15.|mc3a8b3glje5fg4j2n4iljc2jgc5bm16.|mc8be2d2elke6fh3jmo2j3il2e4jc4bm16.|.2mh3ed3gmnmlh2e4fhi3jn2o4jim2ejhcghi3bo16.|2.5mn3oki4h3ih4ij2no6jlcjih3b2h2bo7.2m3n3m.|4.2mn2om2jih11ilnao5jnifjc2d3bchdm6.lidn6m|8.on5m10il2am5jnj2icbd4bcgdm5.lgej3ghlm|10.m2i3j4ij3ihlmk2ji2jmkjkdebd3bnon2m2.onoldhf2gn2o.|10.mj9i3jghml2i2jljijh2dbg2bl7.nmomg2egln3.|9.nlj5i2jih4fghmljm2khi4dbghm8.m2bk3fkm4.|8.mlg3j3if2g4fg2lonml2ij2dk3lgm8.mlbifefikm4.|7.mlge7fd5fjh3gjklkdeln3.2m7.njlhg2ehkm5.|6.onlf2e5f2d3fgk6fgh2ml14.ncglf2ehlm5.|5.2ong2fd4fd5fg2fdfd3e2fj2n13.n2cjfegjk6.|4.mk2ljg4f2d9fd3e4fgionm4.2o3.m.mbj3filn6.|3.2lgl2j3fdf2d3fd3f2df3e2fd3fih4mnkom.ogkmlge2fiko6.|3.m2gnj4fd3f3d2fjf2e2fd8flh2mnlgmo.o2cmk3efj2o6.|3.lfimghfedf6d2fj4ed3fd3fd2ekjl2gf2mnodhkf3ehjno6.|2.mje3ki2efd3fdfd2el3e6dfig3egl2khf3m3ng2f2ehjmn6.|2.nhglgjhe8f3el2e4d3fdekh2ekjiko3mhe4f2g2hk2m6.|2.o2hmeg2ig3fjfi4elh3f2d2f4el2ml5h2mfe4fg3jlm7.|2.o2hm2eiji3fifh4ekli3fdgi2e2fglilk4hmn3fefg2ijkm8.|2.m2hm2efikgfieg3e2fgojg2f2egh3gikhgh2ml2mh3fegh2ijno8.|2.mjhmg2f2gilh4ed2fgomjh4egkm2n7h2m2h2e4himo9.|2.2mh2m4fgj3e6fjlk2h3gf3j3kjhik2oji6h2j2m9.|3.n2jmgf6e4d4fjkljk3lm3ghjklmnloj5ihjhlm10.|3.4ojf5ef4d2f2ehi2mk2jih5gj2mhklj3ij2k2dlm10.|4.2onl2h2e2fdf2df3e3hi3no3i2h4m2hmj2ij2l3glm11.|6.2m3h2if2dfd2e3h3i2jlnm5nm3hkl2k2l3gkno12.|7.mjh6i4h11i6jihimlkg3dgmn14.|7.2mj19ih8ijnl5dklm15.|8.2okj2i4h12ih4i2jkol3dkl2m17.|9.2omi3h14ih4ij5n3on19.|10.4mh19imn4ono22.|12.2mn2ok9i3jij4m28.|14.3on2mk5i2j3o2nm30.|16.n3mn6mnoih2o31.|17.mgh2o5.2n2h2o31.|16.nmgdno5.2m2c2n31.|13.nomlg2ehm5.ml2cjm31.|10.2mlij2gd2egm4.nm3cd2m30.|9.omdcd2he2d2lm3.nm4cbkn30.|8.2nm4hcekmon3.2mgh2bd2bho29.|8.3mnonhkl2m4.nm2ghb3hcbm29.|13.2o2n6.2onleblnomcm29.|23.onbmdlo3bmn29.|26.mno35." },
  Priscilla_in_1: { w: 37, h: 53, p: "e1f7fe,ade9fd,82dcfe,81dafe,7edbfe,7cdafe,7bd9fe,79d7fe,84c7ed,55acf9,4897ec,1c417f,09093a,050535,04032f", r: "19.4o14.|17.2no2i2o13.|16.2nlbcj2o13.|14.2on2acfmn14.|12.3oab3cin15.|11.2ob2cg2ecin15.|10.2nab2a3fein15.|9.on2b2ad2e2fio15.|8.2obcb2a3cefi2o14.|7.om2ba2b4cefhko14.|5.2nl2b2ab4cd2efh2n13.|5.nmc4ab2e5d2cjmn12.|4.okbc4acfe5d3cjmo11.|3.olb2cb2ac2e4de2d2cej2o10.|2.on2bha5cd3ed5efhkn10.|2.oi2c2fgedc2d4ef2e4fjmn9.|2.o2ced4ec7e4fec2jm9.|.olc2g2d11efgfed2cjmo8.|.niklmic2d2e2fg2fl2ml2c2dfjlo8.|olcmi2l2c2d2efgh3miklcd2f3ko7.|omkimame2fedeghl2a2mbklefe2jko7.|omkamimg2fe2dfhm2a2mkal3d2jko7.|omja3m4ec3d5mkalcde2jkn7.|omjak2m3de3dc4mlkak2fe2jkn7.|omja2klh4fedclkmlk2akgfe2jkn7.|omjhi2kheg3fdcl3k2a2h2g4kn7.|omjh3cfdh3gfdc2hcbch2gh3ko8.|2oke3cef2ghj2ge5de2f3kno8.|.nm3celh2fklh3gfe3dej3ko9.|.nmke2gh4lg2h4ge2djkjkno9.|2.2nk2hgfd2cdefg5h2jkl2n5.2no2.|3.3ojhf2ec3egh6km2n5.mci2o.|4.3ok5jkj6kl3n6.mcgko.|6.on3mk4j6klo7.o3ho.|8.2nl2k3j3k2jhjl2o5.ohfjko|7.3oj4i5jeg2hl2o3.onacjkn|6.2m2l6i3jdg3hk3n2.nkac2jm|5.2mklkb6alcd2g2hjm4njadc2jm|5.mdkl6ablibcdh2ghkl3hahfd2jm|4.nkhkl6akl3c2jefgjkhg4h3jm|4.okh2l6amechjmld2egkj5h3k.|4.onklm6amh2j2mjefefjkj3h3ko.|5.2n2m6ak2l2mjhg2fe4jk2jkno.|7.2mi8a3j3hge5jkjmn2.|7.2mli8a2jc4hl3j2hl2n2.|7.mnl2i6aijh2ch2jmkdcdm2o3.|7.nokm7i2ke2b3jmjdc2mo4.|7.2o2i2l5i2khfd3jmno2n6.|8.ok3jm4nmkg2f3jn2o8.|8.nm3j2k2nonl5j2m10.|9.mh2jk2m3.ml4jmn10.|10.3o2n4.nlh2jmn11.|20.2o3n12." },
  Priscilla_in_2: { w: 67, h: 65, p: "a7f2e0,b4e8d3,6fd8cf,57bcb8,38c0bf,38bebc,37bbba,5baeab,37b5b6,1c8f9e,147a8e,115269,080f3a,070532,03042f", r: "12.n2o52.|11.2nbn12.2on37.|11.n2bn11.2nbn37.|10.on2bn11.m2bo37.|10.2nbhn10.nmbhn37.|.2no5.2n2bho8.3n2b2n37.|.ojmn4.n2b2hno6.2n4bn38.|2.nkmn2.on3hm5l2mnm4bno38.|2.nlimn.3nmli5ejlh3b2hn8.3o28.|2.nl2j3nmige2c5em3b2hn7.nmim2o27.|2.okikmnme4ceg3fgi3b2ho5.2ojefmo28.|2.ohdjnlidc2ae3g2f2gj3ml2o2.2n3ikmn25.o3n|.2ohain2i3c4e4f2g2k2jmokn2mejki2o24.2o2cn|2ol2anl2efdef5ef4gfe2jnokiekg2ao23.nmk2aom|o2k2dndc3e3fe2acefgfgf2ejnjfkld3an22.mh3aco.|.n2jl2oc5egcad6ef2gmiek2c4an21.nc4ao2.|2.nklnligf4e2ci3nm2efgjigk3c4a2n19.oda2c2an2.|2.nklnl2g2f4ef2o2nbl2e2gildc7a2n17.om2acaln3.|2.ojm2n2e5fgohb2nkm3efg2l8kj2n12.o2.oh2ac2aln3.|2.2ok2n4efgfgonb2ojmf3efigf3e3kl2o12.nc2oc3ad2amo3.|3.2okof3e2f2e3nonimg4ejlkjg2caon14.nadm3a2d2alo3.|3.2nkjgf6emnoniadif2eji2d4ano15.o2adadj2d2aln3.|2.2oiefg2f5ek3jdbf2gfj3k4a2n16.o4akfj3amo3.|2.ojg4e2f6ekgad2efg4ki3ao17.o3aigid4a2on.|2.njf2ef3e4f9ejknm3j2co17.o2ahjgic4ac2mo|2.njef2gig3e4gf5ejkjk2nmkjio17.njak2ilc4a2clo|2.nl5g5eli2gf2eij4k3o2mgjm16.nlck2el2da2cd2o.|3.nlig3e2feli4g2j3k2jk3o2.2mo6.n2o7.omij2el2cdhon3.|4.2ok2jk2mlg2e2j2k2olk3j2o11.nmcmo6.2nkgefl2dm2o4.|5.3no5k3jmno5kjln11.nad2cn7.nm3gld2no5.|7.9onm3d5k3n9.o2adcao8.og2fkln7.|9.2on2o7dj4kodm8.odaic2a2o7.og2ei2o7.|12.2o7d3jkmodo7.onadi3amo2n5.okefgko7.|12.2o6d2j2ijnhdo4.3nmac5lk2acn5.ni2gi2n6.|12.nl5dckfegjn2do3.oam2adlf3gfiklcm5.2oigfem6.|11.2n3dc2ajigejkndno2.2oadikjgi2g4el2m6.oi3emo5.|11.oc6ai2gjlmhm4.oai2jefgi2ad4ekmo5.nme2fi2o4.|10.ol6akfgiklohn3.2na2ki2g2aci2gfd2el2o5.mj2gilo4.|9.2o7agefgk2mo4.nmdj2iefcf4g2fgeiko6.n3gimn3.|9.nc6a3e2flmho4.nlj2gdeg4f2gf4gi2m5.oi2gejmn2.|8.nl7agf2ejlmlo3.2okj2fd2g6f4gfelm5.mlgfeikn2.|7.on7ai2g2fjmn5.o2kigd9f4g3fn6.n2e2fkno.|7.om7a5gl2n4.2n2ki2g7f2ef5gimo5.m2e2gk2o.|6.2n8a4gilo4.nmlkjei3g3fe3k2j2f2giko5.n2f2i2kn.|6.nj7ad2f3glo4.n3k7g2f6kj4gio5.niagijkm.|6.n8a5fgk2o2.2nki2f6gi3kmn3k2g3fn4.nmga2gjkm.|6.n8a5fgimo3n2k5f3gi2k2m2d4k3felo3.mkfa2ejkn.|6.o8ae3f2gikl4k8fi3kn5d2ke3fio3nmigf2ejko.|6.o8ae2f4gi3kjig7fg2knl5d2kif2g2inml2i2ge2jkn.|6.n8ae2f5g4i3g4feg3knok5d2k4ig2fgi4g3jm.|6.n8af15g2f2e3k2n.n5d3k3i3gf3gi2kj2m.|6.o8agi3g5f8gf4kn2.n5d4k2i3g3fg4kmn.|6.n9a2i2g9f2g2i4k2m2.nm5d4ki2g5f3kmn2.|4.onmk8a2i2g5fejifg2i4kjn4.oh4dj4k2fe2f2kj2kno2.|4.okimd8aj3fe2i3el3j4kj2n4.nm6d10k2jmn3.|3.mi2jmlhd6ag4e2lgefcmnm3ki2o6.2m6d7k2ji2m4.|2.mkijdknh3d5a2jejkliefc3a2mhmn8.om6dj5kie2m5.|.nmji3dnoh4d3ad4kmni2d4a3m10.nmk9dh3m6.|.nh2j3dm2n9d2i2kmli2ac3ahn11.3m7lmnon7.|.nji2d2mnonmh11dkm2f2ad3an12.4mn2o4n9.|.n2jn3m3.n3m10d2mdf3a2do32.|.mlno9.2mno4n6m2i3adlm31.|.2mn11.n3o3n2mn2.2m3i3a2m30.|29.onm3ikm30.|32.3mn31." },
  Priscilla_in_3: { w: 67, h: 73, p: "e9f8ff,d3f2fe,cde8f1,bbe6fe,a2dafd,8dcffc,7fcdfd,8cc5ee,7bc8fd,68a2dc,4677ba,193478,0f1d59,0a0c3f,080736", r: "12.2o53.|12.oa2o51.|12.oc2o19.3o29.|12.ocko18.oc2o29.|12.ocjo17.2oc2o29.|11.2ncjo16.noch2o29.|10.onjcjo7l9.nkcho30.|9.2n3c2o2lb2ab2l7.nm2cno30.|8.2n2cjk2old3abe4l.2o2n2ch2n30.|7.2o2c2j3le3a2d2je2lnkj3cjko31.|2.2l3.o2c2jl2akh2ad6em5c2j2o31.|.ljk2l.oc2jk4ai8eka4c2k2o32.|.mgijlmohk2l4a5ejehk4cj2k2o33.|.l2ajimljlke2ad3e5kj4c3k2o3.4l27.|.m2aif2mlgk2b3e2kjgijl4c2k2no2.2m3gkm16.5l5.|.liabjmk2gkb3ekj5gj3c3kolb2m3ifbem15.l2k3dl4.|2.ld2amf2gka2ekj7gjkj2k2n3mfi5an14.lfd4a2l3.|2.lkami3gkadk2i8gi3lkmkjfj5alm13.ld6al4.|.2lkelj3gkbkj11gi2k2mgij4adkm12.2lf5abel4.|2ldb2kdf3gkj14gkmgih4aejm6.5l.2lj6ael5.|me2blkda8g3e2gi5gk2gjb3adhj2m5.lk2dk3l8al5.|lh2enmhb7gdbdeg3i4gigi5ad3a2m3.lh3ad2k4d5adl4.|lkhenale6gi2demn2mk5gi3a2b5aem2.lk5afe5d2abdk2l3.|.mlmnkmf6gi2f2ncjhm2i3gjed3ed3adem2.mj2ab2a2e2df2e2def2eh2l.|3.2nkn8gil2nakb2h4gj6e3delm2.mjabd2a2efkjed3eb4akl|3.2njn8gi3n2kach3gijk8elm3.ljbe2abdfjik2d2e6adl|3.onkji7g2l2n2j2a4gijf2ed3ejlm4.ljbf2aekj2fk3d2ae3abdm|2.2nlei8gm3k2jai4g2ib3abim2l5.lj2dfdk2igkjd5ae3adm|2.ond10gi3kjagi3g3ie4abemo5.lkdbdikigik2e5afb2dkm|.2oe17gi2gigj3iebae2a2o6.m2edk2gikmf2e4aedegm.|.2oi19g2i2jmj4ieadno6.m2edk2fgjm2fe3dedek2m.|.2nil3gf2k3g3i5gi5jnmkjigdlno6.2mfki3gjme3f4el2m2.|.2ni4gl5gilk2i3gi5j4n2kmn9.mlk3gikl3e3fekm4.|2.nmj2g2i4gf2l4ig2jlk3jnfkn2on11.mk4ikm3efj3m5.|2.3nj5i2glf2g5jm5jn3fn12.2mkig2ikle4m8.|4.2n7lfi3jk3n6jn3em11.3lk4gjl2o11.|5.2o2k5i2kln2kh6jlk3em10.2l3k5gkn12.|6.2om7l5h6jnf2e2m10.ljbaj2i3gkn12.|9.3non7h6jn2f3m10.lkbadji3gjmn11.|12.o8h6jhl2n13.le2bki3gijn11.|11.om7h3j2gikf2n14.2lebk2i3gjo11.|11.nk7hj5gledn15.2lbk2i2gijmn10.|10.2nd6hdi5gm3e2m13.2lak5ijl2n9.|10.nm3b4df3i3gmede2m12.2lbak5i2j2n9.|9.2n5b3d7imf2e2m5.2m2l2.lkdafj3g2i2jno9.|8.onl7bd7imfdlm5.lkedalmlk2ak5gi2jno9.|8.oned6bdg6imfh2m4.ldb2abkljdbdk5gi2jlo9.|8.oj2d6bdg6imfn5.le2a4bldbfk6gi2jlo9.|7.2o4d5b2g4igikfn5.mb2ab2fbfefjki6g2jlo9.|7.2o3db3dbd7gijk2m2.2mfba2e2ae2f2j3i5gjilo9.|7.nl4b5di5g3il5ml2bh2f2b2ek6i4gjhlo9.|6.2nh3b6di8gj3lhd2b6f2k3g5i2gijfno9.|6.2n4b6di2gegeb3gjkji3e3hj2kj5ged4ikjf2n9.|6.2n3b7dgigbe2b3gi2j7k3ji4gebjg2ijkjh2n9.|6.2n2b2db6d2ih2d3idk3ig4i2g4ig3dji2gi2kgk2n9.|6.no3d5b3di2gj2g2ik2iji8g2idbdkj4gik2gn2l4m5.|6.2o4d4bd2b4g2j3i2g2k2g2i4g3bh2jik2g2jk2h2n2mefm5.|6.2oh2d8bj2g3i2kgfji4g2i5gj4iki3j2fkhlk2bdk5.|6.2oh10bdj6i2kji6g3i4gi2ki3k2jkfbdh3dl5.|5.2onhd7b3dk8i2gi2gjk4i7g5khe2bhe2dfn5.|5.njmk2hbd3b5dj10i2gfkmj3g5ij3ki5h3bd2o5.|5.nhjnk2hd3b5dj7ilj4g2fkl2m6kj2hih5bdkmo6.|4.nkiknl3h3b6dk5ig2kj5gfe2d2m4khj3n4fe3n7.|4.nhj2kln3h9dej2i2gj2ljgi4g2f2dmk4h4n5on8.|4.ohik2jm8h2db3dkj2g2jkje3g2f2j2dmk3hon17.|4.ohi4jn9h4de5j2kjd4f2d3jk2h2o18.|4.ojhj2hikoj12h2b4knjidfif5dj3n19.|5.n4himonm17h2njf2ej2i3deko20.|5.2nlh2io.2onl16hjlki3ehi2jgj2n19.|6.3o2no2.3n2ok13hm2nlj5e2fehjn18.|18.2o4n5o11nmj5egn18.|20.2n7o5n3.4o8n18.|42.6n19." },
  Priscilla_out_1: { w: 44, h: 54, p: "f6fdff,f3fcfe,f3fbfe,f2fcfe,f1fafe,ebf9fe,bde3fe,ccd7c7,9fd8fc,7bcdfd,61a4e0,526380,050a3b,02042f", r: "21.5k18.|19.2kg2fdak17.|18.kfdbdebad3k14.|14.5ke5b2cf2k14.|14.5kf5bd2egk14.|13.kf2efkg2abc3efg3k12.|12.kgb2dedkbc4ec2k3ak11.|12.kga2bde2gf4ege2acbgk10.|11.k3g2acei4ged3abcbgk10.|11.k7g2j5ga3b2agk10.|11.k7g2j5gf2ededgk10.|11.k6gk5gk2gfef2g2k10.|12.k2g3kgabde2fk5gkf2m9.|13.2k2fd8b5k2fg2m8.|13.mgf2ed9bdef2ed2im7.|4.2k6.mjg8dcd2b2d2edbafim7.|2.2k2gk5.mia3b4d2b6dc3begkn6.|4k2e2k3.lmga3b5d3ecd4b2defjn6.|k2fi3eik2.lm2a3bcde3f2edcb2cd2ef2gn6.|kge4df2k.nea2bd3be2l2me5bdef2mlm6.|k2gdbgeg2k.ne2dc4dmef3m2cd2edbm2a2m6.|.ki2gk2g2k.n2e2dcd2emef3mc4eda3mlm6.|2.3k.3k2.mg2edbdefn2lmkm2ade3l2m2kn6.|3.2k.2k3.mge3d3eml3km3al3hml2kn6.|11.mgfc3edal4kmec5h2lkl2m5.|11.m2gf2e2c2a4k2fl7h2lmn5.|12.nifed5bd2efm11hn5.|12.nigf2a2bd4edg2m3l6hn5.|13.m2i3gf2ed2b2aflm2n3m4n5.|7.nm5.mjigi2gd2b2a9g2mn4.m.|6.n3mn4.m2kji2g4f5g2ijkl2m.4mn|6.nafin4.3mki11gjkm2n3.2m2jn|6.n2afim.3mlj2gk9g2k2m2kn2mj3gn|6.m3adimjgf3a13gjk2m7gm|6.mif2akgd2edc3a3gjebdg2ij2a2m4g2jkm|6.m2ij2m2ac2ded3cgj2c3efkf2agim2gk2ln.|5.2m2jldb4abd2eg2ik2abd2efib2agm3giln.|5.2mk2medaeg2acdei2jk2abc2de2g2fimi2gjl2.|5.n2j2m3f2g2abdfk2jk4a2d2ejg2imjgj2m2.|5.n3jml3keacbagk3jk2ajidefk2ikmjgk2m2.|5.nk3jm3gf3eal2ij2i4kgdi2k2m2i2n4.|6.n2k2j2m5glj3i6j3k2i2m2n6.|7.m2k2jm4nmkj4i8jij2m8.|8.2mkj5k16j2l9.|9.2m3k11j3i4jk2n9.|10.lnlk12j4ij2kn10.|12.nl6j4k2ji4jln11.|13.4m3j7kj2k2m12.|16.15n13.|17.nl3n3.n2l4n12.|16.nmhlm4.n6ln11.|15.2nl2hmn3.n2l4hn11.|15.2n4hmn3.7n11.|15.8n21." },
  Priscilla_out_2: { w: 67, h: 69, p: "daf8fe,cff7fe,ccece6,bdecf5,9ee0f8,85cbea,9fbab3,74bee2,5eacd5,6b737a,276c9e,1d2143,020a3a,020431,00032d", r: "29.2n36.|28.nlko35.|28.n2il35.|28.ofekm34.|28.oheakm2n25.2n4.|3.o2n22.ohfd2akm5o4n15.ofmn3.|2.nlakn18.o3.mked3a2bfh3f3k2n12.ofikn2.|2.nlabo18.on2.2nie2a4b2a4b2akmn9.hn2fkn2.|2.mlabfn17.nhm3nki3f2b3a2b4a2b2mo7.l3fjo2.|2.nl2ben17.nfkm2nli3f5b6a2bemo7.m3fjo2.|2.om3b2n16.nfd3bhife3a2b6a3bdf2n6.m3fjn2.|2.om4b2m16.nh6b11a7bm5.hk3fjm2.|2.omh2baflm16.oh3bdfe2b2a3k9bekm4.o4fjm2.|2.omiab2ajmn16.n4fb2h3f2b2kd5bab2fm4.n4fjn2.|3.ml2ababmno12.4okhf3b6f4d5abiekn2.m5fko2.|4.mba4bnon11.ok3jf2b2e3f3kj3b5abijl2n2m4fi4o|3.2mf4bden2m10.oid5b4flmn2okb6abi2o2nm5fn4o|nm2kmkd2b2e2a3m10.o4hf2a2fimnakolk3b3abik3oi4fhmnoho|nb3mnk2bd2e2afm2n9.4m4afhoaka2nl7bianokh4fkml2fo|m2b2e2ohbab2ea2bl2ok9.2ma4bhoakn2mla6bkmim6fkih2fn|m2b3dhl2a2bfi5blnm7.2nd4bdoaknkmla2b4j2kfm5fkih2fhm|nh4de2i3bfih4b2jl2m5.2od3bdefai2kml2bg5jkfm4fhkh3fjm|oif3dbe2i2d2fki3b2aikmn4.nmi2b4eai3kebcj4gjmdm4fih3fio.|.oih2b2defk2f4khaba3bno3.nmlhd5e2ad2egj2gj3gjlnhf2hk3fiko.|2.2mhb5dfikdfh2kh5bn5.m2i8e2i2j7gj2oi2h3fhkn2.|3.2mh7dk4bhik5bn4.nl2i7e4j9gj2lk3f2m3.|4.mni6dhk2bd3hk4bim3.nok2h6ehjl3j9gjm2fl2mno.|.n2on2mk6dfi4d3h4bn4.omk9h2l11jlkh3lklo.|.3n3m2k5de2k3d4h3bo5.m2k9hl2j4l4jlk2i2lk2fn.|.ojf2dk2mki3dei2k2e3h2i2bnm5.n2k7h2in3on5mi2h2k2hfhm.|2.2m5dehi2fk3i2k4hi2bim6.oli3hi4knoaom4ih3i4hkn2.|2.2mi8dfk5d5hk2bm6.nmk6h2ina2nm3i2h2if3hkln2.|3.2mi8dfke4d4hk3blm5.2m7h2ionk6i5himo3.|4.3mi7d2f2k2f5hk3bjn4.nmhf2e5hkm7i3hk3m4.|5.2m2kif5df2k3i4hki3bl2m2.lih4ehi2hi2m5i2hi2k2n5.|7.n3ok5dei3k5hkd3b4m3h6e2he3m2i3h2k2n7.|8.2o2nm2k3hk5de3hkh3bkm4h2a8elk2if2k3ikon5.|7.oie8dhk5d4h2k3bk4h4ab4efefm2i3h2fio6.|8.m2i8de5k5hik3b3ib5ab2efbabdmi4hkm7.|9.mki6dhkhe3i2di4hkb3db8a3bdfifmkl2nm8.|10.nl2k4jkif2efh2i5hke3d12abeilmkno2n8.|11.on3m2nk5ei2k5hkf3d2b9a3be2mio11.|15.3m5e3kf3hikf5dk9afedad3o11.|11.n2o.om3deknml2def2ke6dkak7ad2eado13.|11.n2hn2gon3mnle2dinif7d3kbabf4a2i2dn13.|11.ok2e2lhfn2h2m3nmfe9dhkbd2f4a2khfm13.|11.nmi2e3i8he12dh4fb2ad2khmn13.|11.2mkieh2i8h13deh2fie2aei2hon13.|11.nmnki10h15di2fhi2bk3hn14.|11.n3hi2k5h2f16db3ekbki2fko14.|12.o7he19de3defk4fo15.|13.nmk2ik3hfe14dh6e4fikn15.|15.3m2k4he11d11hfhkm16.|16.mnmki4h10d13him17.|19.ok5he6d14hio18.|20.oki11hk11hio19.|21.n2mhk8hk7h2ih2n20.|23.3ni6hli6hik3o21.|24.3on3hi3n4on2mno23.|25.2olj2km3n3ol2k2n24.|26.njl4o4.m3kn25.|26.n2jlo6.m2j2o25.|26.o2glo6.n2j2o2n23.|25.ol4jn4.2o6jn2o20.|25.o6gn3.2oj2g2j4go19.|24.m8g2n2.nlj2gj2g2no19.|24.n2gj2gj2gln3.n5j4n19.|24.ngjnjgj2ogm4.4o3n21.|24.o2n.3oj.2j32." },
  Priscilla_out_3: { w: 85, h: 74, p: "f6fcff,f1fbfe,edf1e7,bfd9f7,bdd1f2,a0ccf7,aaa7a8,7ba8dd,629bda,4c82c8,505c80,1c468a,07164d,03083b,020432", r: "38.2n45.|37.njho13.nki28.|5.2m30.njhn12.n2lk21.2m5.|4.4m29.ojhjm11.mhln20.4m4.|3.2mafm29.ojfj2m9.ojhln20.mfalm3.|2.2mbab2m24.m3.njfhmn9.ojhln20.m2admn2.|2.2m3bd2m22.ojo2.nj3hjm8.njhijn17.2mf2bd2m2.|2.2n3balm22.oi3nal2hbabm7.nj3hn17.2m2bde2m2.|2.2n2b3agm21.oih3n2jb2a2bml5.oj3hdn15.mgbab2emn2.|2.nm4a2b2l20.nj2hjkljda3bgm4n2onm4hn13.jmg2a3e2n2.|2.2mb2a3b2l20.nj4hljhd3bak2m2no3nj2hfnm12.jlfab3e2n2.|2.2mha5b2l20.o4hf2jfdb3aj6bfhml2f2m11.mf2bd2eimn2.|4.m5b2a2l19.oj2hf2abjid2abi9bdlfimn9.mi3b3em4.|4.mh3b4a3l18.n2jh4bhjd2bf7b4anino8.2m2ac3eim4.|4mbmb5a2b3l18.nkhf2b2abi15bl2o7.2m2b5enbm3n|mkbe2ml3abd3bhj2l13.3n2omhf2b3h2j3b3a7bdno6.2m2b5ej2ngefn|n3b2klha2bd4bf2kl12.n2l2mkihfi3h2jh2db2a7bdln5.2m3b4ehl2kc2em|n3b2amif3bedb3ahlm11.n2ihdb2lj6h2jih2a7bdjlo3.2me2aehfefim2a3en|n2b4am2h2b4da3b3m10.nj2i4b2i4hfhfhj6b2adjlo2.2m3be2hf2hmba4en|mhd3abd2ljb3d2f4bdh3m8.n2li3baf4j5hj4b3a2jlnmni3bf4hjld5ein|.mjfa4bf2jadeh2jib5af2m7.3o2njdcbj4nlj3h2b4a2jlnld2ehj2l2hljd4efhn.|2.mlf4babdifjf2bf2j5a2b3m8.n2dcadn2dnomlhj3a3bjm2n3dj2h2eljfd4ehkn2.|3.nh2b2a4dejdbabdhihd6bkm7.n2d2adobde2ol2j2a4bjnondf2hf3elih5ejn3.|3.2o2b2a5djf3a2df2h7bm7.nd3abogedlnm2j3b3clm2o2fhf3ehl2hf4e2n3.|.3o2nfbab4dh2f2a2bdeh2j5bdm6.n2d4bldjlminj2bc3kofhohi5ejl2hfefh5n.|.ngabnmje2b4dej4b4dfj3b2am6.n2ed4be4ibjbgk3ckgnoi6ej4hej2n3dn.|.ng3af2mlj5delf4b4djb4am5.nhed3b5a3bk2gkg2co2n6el3hj3l3e2dn.|2.2ma4bfili3def2l3b4dfih3am6.n3e6a2bk7g2ck2n2ej4lh2jh5ekn2.|2.2mf4b3af2i2hl2ijl2j4dih3am6.nie2d4a3b2k7g3cg2ojh2elh7ef2n2.|3.mkfb3a4dfhj5b3f3d3f2ahn6.mi4da4bo4k10gm2edl2h4edfkm3.|4.nfb3a4dejl6be5dfiabd2n5.mjd3ed3ben5k9gn2ehj2h5efm4.|5.nh4b3d2ejf3b3a5dfi3b2n5.fij9eo4g4k4g2nijl3hf3ein5.|6.2o2jf5delfb6a3dfif2b2n6.2nf3e2f3edh4n4o3ndeji3hfhkl2o6.|8.3njd4eh3lfdadh5di2bamn7.o3e4f3jmnan6h3l5hj3n8.|7.7nl5hi3lh5de2i2akln6.o3e6fhnoao6hd2l2hjl6n7.|7.ng2a2be2df3hlh4b6dh3afjn4.jn6e4fnon6h3dl4h2edekn7.|7.2ld3b5dehlf5b6dh3aej3nml2b9ef2o5h2edj3h2f4e2l7.|7.l2md2b6dhlhf3ba6die3af3nmj2b3d8em5h3ek3h2f3ekml7.|10.ni7d2h3l3baif4djhd4b2ji2b4a6e2dm2h2j3l4hefej2n9.|11.3n2o3nl4h4l3da2de2jf4bd2f3a5b2e3adn4flhl6no11.|14.2n2oi3ef3hl5a2d4flfb2abj2a6b4a2bdnfilj3h3n14.|13.n2fb3e4dhj2l3babj5fl2d2bj2a6b2a4bdbnki6hfm13.|13.nlf3e4dj2li7le3bjhjdehj7baba3bdibnlhj5h2n13.|13.n2lhfh3f4l2h7l2dij4hjl13bdhdnlhk2i2jm2n13.|16.2n4onj6hijh3ljl3h3jl2e2b3a2bfe2bdahnl2hn4o15.|21.om2i2hj2nm3h2lj5h2fhld2abda3be2i3anmjhin18.|22.6onm3h2l4hli4fld3be5b3ada5n19.|19.n2om4aok2hj2n4hni5fdlbdfld3ba3b2d2n22.|19.n2ij3o2amo2nj5ni7fhlefl2d2a4bld2o22.|18.2om2jhijn3on6j2h8f4l3d2ab2dlh2o22.|16.2nmlk2i2jikm2l5ji3h9f3jf3db2df2l2o22.|15.2nmli2hi2l2hl6j4h13fl6dh2lo23.|15.om2h3j2ih8j5h13file2dfhlio24.|17.nh4fh9j6h13fjle2hlijo24.|18.onj3h2jl6j7h13fj2lj2in25.|20.n7o5j9h10f6iln25.|27.on6j15h2i6jm26.|27.onm5j10hi3h2i5j2ln26.|30.nljmj8hi11jlmo27.|31.olmji6h8j3il3o28.|32.2o3j4hjlm7jmno31.|33.nl3ji2jn7om2lo32.|34.2ok3j2no.2o5lo33.|34.2ok2lkno3.o4lmo33.|34.o2k4o5.2n3o34.|34.o3ko7.o3ko34.|33.om3go7.okgko34.|33.ok3go7.o3gko2n31.|33.o4gko5.o5gk2g4o27.|32.o7gok3.2ok4gk3gkgo26.|31.2o8g2k2.2o2k3gk4gko26.|31.ok5gk2gko4.4o2gkgm3o26.|31.ogko2kgkokgmo7.5o29.|31.3o.4o.4o41." },
  Rebecca_in_1: { w: 43, h: 59, p: "febf4b,fdb445,fea237,ef9637,ff7415,ff720d,fd7313,fe6f10,fd480f,e83b1d,811c26,210127,11012b,0e0127,0a0122", r: "18.i24.|18.2i23.|18.ici22.|11.i6.bci22.|11.2i6.j23.|10.hfi30.|9.iebh4.2j5.2i17.|9.i2be4.3j3.ici17.|9.eci4.5j2.hi18.|10.j5.jif2j22.|2.m2no7.3ji3fj9.on3m8.|.an3lnm4.jiji3fi3j6.o3lmn8.|.no3hil2m2.3i3fi5j2.omlk2hijo8.|.onhj3hk2mjihfbafi2jh2jkolk3h3i2o7.|.nmhjke2hjmji2f2acfi2fijmk3hije2i2o7.|.2mhe2kh2f2jhf4ac3fjlkg2fjk2ecimn7.|.2mhdejh2f2j2f5a2fh2kh2f2k2e2bi2m7.|.2mhbcejh2f2j2f3a3f3h2f2kgd3bi2m7.|.2mh2bdhj3fjifa6fh2fhk3e3bi2m7.|.2mh2bekh4fj10fhf3k4bi2m7.|.mni2bjh19fgk4bi2m7.|.2njdkh14f2h5f2k2bei2m7.|.on2jk3fg6fh11fhk2bhknm7.|.2o2kj2fcbg6fh2fbc7f2jeh3o7.|2.onk3fe2bg7f2bdg5f2hjij2o8.|2.2ok4febe7fbc3fg3f2h2jkno8.|2.on3f2geg10f4gfhfh2fj2m9.|2.2mgek2mlg8f2g2mnkh4fgj2m9.|.3melmlamh7fgkmanonkh3fhj2m9.|d2lkg2mnaoh4fgf2g2oa4m2g2f2j3l8.|ogf2glko2ng3f2gf2e2n3mkm4fihgekm7.|mjgegljn2mgf4cg2e5mjnh5fhj2m7.|kmk2h3kmlebd2l3bdlm2kc2kh4fik2n4.2m2.|k2mhigklmg2bdld4bdk3lk2fh2fhk2o4.lkhm.|mngfe20bc4fijk2o2.mdb2k.|nljie6blblobl10b2f3ijno.ol2bm2.|.oljg6bal2bo11bhijij2m.noj2blm.|2.omlec18b3ej2mnm2.mn3bjm.|4.ml2ec14bc2hjklmna2.lka4bln|5.nolge11bc2eik2n2m3.olec4bho|6.2onkj11ejk3ojnm2.nli2h4bho|7.2onkj10e6jhgn2m4i2hb2hn|6.2oj13eh3i2h2fhnl5i2cihm|6.kldc3b4e5beg2f2h3fjlj7im.|7.2mj4b2e6bc2g2fh3fgmlj4ijkm.|7.mk14bjg7fglkj2i2jk2m|7.ld12bd2j8fhlk7jl|7.mdje10bdh9fhkl6jn.|7.2noedc7be2h7f2gekm4k2n2.|8.2odh2ed2b3ejh5f2h2fgik3m3o3.|9.2o2l2ecb2ejh3fh3f2hfhjko8.|9.2okml4ekh4f5jif2j2o8.|9.on2jm2l2enj3fhk2jl5jno8.|10.n4j2onmj3fjl3ol4jmn8.|10.m4jko2mj2fgjl4o4jm9.|10.kl3jlo.nk2fgk2m.nm3j2n9.|10.kn2jkm2.ok2hknm2.4m2o10.|11.2on2m2.nl2klo4.3mn11.|19.2n2o20." },
  Rebecca_in_2: { w: 71, h: 70, p: "fdcf68,feb549,faa02c,f9831d,fe5e1a,ff4d12,ff4c11,f06223,fe4911,ef2911,be1723,710f20,240126,12012b,0d0125", r: "2.3n33.n3o29.|.2nm2n31.3nmn29.|.no2l2o28.onm3lno28.|.o4l2o26.2o5l2o28.|.olm3l2n23.3o3l2m2lo28.|oml2m3lno21.2o4l3m2ln28.|o2lh2m3l2o19.2n4lm2hm2ln28.|o2ldhm4l2o17.nm4lm3hm2lo17.2j9.|n2l2d2m4lml15.onjk2lm4hm2lo15.4j3.2j4.|n2lbdhml3imn14.2o2if2ldhc2bm2lo14.2jeij3.2j4.|n2l2bd2l2ifk2n12.2o4il2hc3bm2ln13.2jfei4.jej3.|o2l3bhl4fkn4om.2n3.2n4imk2h4bm2ln8.2j3.2jdej3.jedj3.|o2l3bd2l2fik2ml2jmnml2n.m2f2i2l3h4bm2lo7.jfj3.2jdej3.j2dj3.|olk2b2dhlifj3ml2ihlmfk2nm3fik4h4bklno6.jgdj4.jdei3.jdgj3.|o2k2bhbh2kj2k2flk2fik2ilni3fl3hbh4b2kno6.j2dj4.j2dej3.jh4.|o2k3bdchli2l7f4il2if2khd6b3ko7.jdj5.jdbdij8.|n2k3bhdhmlkji3fg10ilhdb2d4b3ko7.2j5.2jd2bdij7.|nm2k3bhdmlg3ig11ikldbcdh4b2k2o7.j6.j2d2bdej7.|.n2k2bdhlkf17ik2lkh4b3kna10.j3.j2d3bdgj6.|.omk2bhlj3fg14igfjl2d4b3kna9.3j2.jd4bdej6.|.2o2kb2l5f13i2g2i2l4b3kon10.3jhjid4bcdij5.|2.o2kcl6f11i3g4il3b3klo11.jd3j2d5b2djh4.|2.2oklk3fg3i3g10ig3fklbh3k2o10.2jd2j2d6b2d2j4.|2.o2nl3f2b3i3f2ig3b3ig2fg2ik2l2k2o10.2j2djdc7b2dgj4.|3.onlg2i2be2i3f2i3bc2ig2fg3i5kno7.3j6d3bd4b2dgj.3j|3.2nj4ib2g2fg2fgcd3i3f4ig3kl2n7.kj2g2db2d3b2d4b2dg2ji2j|3.2ni3k2i3fg2ig2f2i4k5if2kl2n7.mje3dbcdc2b4d3bdeg2jdj.|3.nlmnmoli3g4igfjm3n2ok3igf2k2n6.mkg2d2bcegdc5d2b2de2jdgi.|3.nln2kalk4ig4ima3nm2ok2i2f2klno4.nli2dg2dg2i3df2gd2b2dji2djh.|.l2nimjl2al3i3fgilo2anmimoki3f3ko2n3.nj2di2e2ie2d2gige3bd2i2dej2.|3nkemjm2olig4fgiol3nmihnkgig2i3kl2n.nmidged3idfg4ie2bedfg2dgj2.|nohefncdonl4f3gkok2o2nchnkf8i2m.nmjef2gfgig6id2be5dgj2.|.2o2blhclnl4fg2imn2d2oe2cmed3bd3ion2ank7fg7i3de5dgja.|2.2o2blchm2e3fgbfmnc4dblfe3b2df3ona2nkg6fg2f4ig2d2e5dgjk.|.3ohbhkjmlnok6b3i2jid4b2dim3o2a2nkig8f2gig2dejf2df2dg2j.|.2o5bcncol20b2dh2o2anmkijig7f2g2dgikfejf2dfjk.|2.2nh4bm7bm12b4dh2o3aonkij2ig8f3gikfgkedfjka.|2.a3nc2bh2loc2bm12b3dh3n4aon2kj3ik8f2g2jgkje2gjma.|4.3n2hbhkdl2n11bc2dhlo2n5aon2kj2iki2g8f4kidgilk2.|6.3o16b3dhl3o8am3kj2ki3g6fj4k2dgjo3.|7.3omd10bdh2dkm3no3a2o5nm5k3ig3igfi4kjdg2jo3.|8.lo2nlh7d3hlo2n2kl2n5o5n4kji2gf2ik2i5kfgijo4.|10.4nm7dh8kl4m2i3fknm4ki3f2k2ij4k2fgi2n4.|11.mn3d2h5dhe2kj2kj2kfg2i2gfg2i2l9kij4kigfjmn5.|10.anm2d4h2d3bd3i2k2ig3f4g4ikl14kjh2nl6.|11.2n3bdhdc5bci3k3ig3f5gigjm14k2l2n7.|11.m5bc6bdhi2j4ig3f2g2fg3f2l15k2o7.|10.ocbc10bdefjfg3i4gf2g5fimn12km2o8.|10.oh2d11bk6f5gfg6fimn3om5k2m2n10.|10.3od11bkg6f5g6fgjm2o.2o6n13.|11.on2d8bdck2i6fg2ig5fg2imo23.|12.odk2d6bdk4i2g4fgik4fg2ijmo23.|13.2nk2d2bd2b2k7igf4k4f3ikmn23.|13.2no3hb2dcl2f4i4k3dl2fg4ikmn23.|13.2okm2h4dm3fg2il4h2dmk6i2kn23.|14.o2kmo4dnig2fgim4h2on2k3if3kmn22.|14.o2kl2n2dholig3fn2h6o2kif4kmn22.|14.2o3km2n3o3ifi4nlk2l2o8k2n21.|14.2n4kl3om4ik3nl2k2l3on6k2n21.|15.n4kloa2m4ik4n4l2o.no4klon21.|15.n2klklo2.m2f2iko2an4l2n2.om4l2o21.|15.o5lo2.o2kjklo2an3lmn4.m4lol21.|15.o4lmn2.o2l2kmoaom3l2n4.m3lmna21.|15.o4l2n2.n4lm2no3lmol3.nm3l2n22.|14.om4ln2.2n4ln.4n2ol3.2n4l2o22.|14.om3lmo2.nm3lmo2.3n2o4.nm3lmn23.|14.o3nmol2.o4l2o11.2n5o23.|15.3n2o3.olm2ln12.3n3o24.|23.4o2n42.|24.n3o43." },
  Rebecca_in_3: { w: 63, h: 79, p: "fee056,feb83e,fbad28,fe7c1d,ef7a2d,ff4e13,ec521a,fe4910,fa4810,f9270b,c41e21,6a1323,3d0222,15012a,0e0126", r: "3.o59.|2.2o40.no17.|2.2o36.o2.olo17.|.olo.2o17.g2j13.3onlo17.|.nln3o18.3j11.4nlno17.|.o2lnlo18.jfhj10.n2m2l2n17.|om2l2mn18.jfhj10.n4lm2n16.|o4lmn12.jg4.jfdj10.n5lon16.|om3lmn12.ji2.3j2dj2.j6.n5l2o17.|.n2m2lno10.3j.3j3dj2.2j3.on2lm2l2o18.|.2n2m2lno7.2jdf3j5df.jfj2.2o2l3mno19.|2.nmem2lno5.2j2d2jf5d3jhdjk2o2l2mlmn20.|2.omen3l2n3.2jdcdj4d2cd2jf2dknm2l2mekmn20.|2.om2e4lmn.2jd2c3d2c2adji3d2mk2lmn2ekmn20.|2.om2bgl2fkmojhdca3c3acdic2d2n2fklm3elmo20.|2.om2bem3flnjd2ca2c3a5cdnoi2hlm3ebkmo20.|2.om2b2el2fhjf2c2ac4ac3acmoih2im4ebglo20.|2.om2b2elg2hj2c2ac8a2bmg2himk3e2bglo20.|2.om2b2e2k2hj2c11acnl2fhlm4e2bgln6.j13.|2.nm2bebekihj2c8aca2cmg2fim2e2be2bgln5.2j13.|2.nm2be2bljijdc7a4cjkihfl2e2b2e2bgln4.jdj13.|2.nmkb2eb2lkij2c4a5c4ihil3b4ebglo3.j2dj13.|2.2nk4b2lifihcbab3ch2j5h2k2be5bkmo3.jhj14.|2.2olg2blkh3fj2ca2cij9hile2b2e2blo4.2j15.|3.2ok2bl5fhj3cjh3f3h2f4hk2b2ebklo21.|3.2okgl5f2hj2cj2h4f2h2f4hfke2beklo5.je14.|4.o3l3fb4hfj5hfb3f2h4fhkle2k2n2.e3je14.|4.onl3f3b3hj6h3b2f2h3f2him3knk.2jf2j15.|5.omf2hi2b4h2f3h3bh7f3h3koli2jfdj16.|5.2n3bfib4h2f3hbid7bmfh2fklndijfdj17.|5.4noebf3h3f3hfbem3n3onfh2f2m6dj7.3o2m5.|4.3nmkmobf3h3f2hi2bo2nlfn2oi2h2fknkcdc2dj7.omlmn5.|3.enklmfm2ob6f2h2bolmngfioi4h2fkm3c2dj7.on2lm2n3.|3.nlkgnc2mob8fbkng2n3cni3kh2fi2lacdje.j6.n3lm2o2.|2.onkhgncmo2n8fbnlgno3cnfh4khiklacdjb.j7.n3lmo2.|.nokijgl2cngn2f4h2fkndg2obagm3fg2k2igmcadjbdj7.n4lo2.|.2nfgkebg2clni4h3f2n2dg3bl2fe2b2kl2ilcadjbdj6.nm4loe.|.2ogoeb3fcgnk4g2fgmngdc2bgi2fke2bklngncbdh2j7.o5lno.|.3olb2k4fb2mlml3b2f6hihf2ke2bkn2ocb3dj7.nlk3lno.|2.aoeb2k2fh3blml5b5f2hi2ki2k2belmc2bc2dj7.n5lon.|3.oe2b2f2hg3bo5beb5f2he3k4bemc2bcd2j6.nm2ki2l3n|3.ne3b3hnebm2n3bln2b5fh8bem2bcdjg7.nmfkg2l3n|3.n3ebf2hemnlbk2nom3b5fh3b2e3bembch2j7.2n3fklml2o|3.neol2b2he12bh4f4bene2bemcdln3o4.on4f2l2koa|3.3ond2b2fd10b2h3f5be2nebkndji2fn4onk4fh3kno.|4.o.ne2bkn2g7bf2ig2lge3b2e2n2enmi4h3fnogih3fg2kmo2.|6.mkegm2kl7efk2l2cl2e2benc2nenfj2h2jdj2f2ni2hi2kln2o2.|6.lndlkjdc9l5cmeb2en2c2olj2hjdjcfj2f2n7kno2.|7.3nkd17cn2eod2cdk5hj3cj3fn6kmn3.|8.ong2ca10c2a3cne2n2cdjhij3hjf2cj3fln3knon4.|8.2jh2c2a7cb3a3c3o2cdjfidcdj2h3j3h2fn4o6.|8.jid2b4a4c7aclo2cdj2hi2cji9hi2n9.|9.idcac4a2c8a4cd2j3h3j8hjhfin9.|10.id2c4ac6acb4cd2j4h4f4hi2h2j2f2n8.|10.2j2dc9a4c2dfj9h3f2hi2ji2jf2n8.|11.2j2i2c6a2cdc2fjih2f8h3fjc2j2cjino8.|12.lkj2db4ac2dfdfj2h4f5hik3fj5cjimn8.|12.onk3db2ac3d2ij3hfj2fhkhi2klghfhj3cj2hln8.|13.onm4db3dekj4h2j3fm2k2dmk3fh3j3hlo8.|13.olnl8dlg2hf2j2h2fne3dmlk8h2ko8.|13.o2k2n2e5dlk2fhj2chjfn3e3o2k3hf2h3kmo7.|13.n3kl2ne3delk2hj3chjinek5o2k2fhi4kl2n6.|13.2n4k2on3eknghj2cdhjio2nmkmo2n10kln6.|14.n5km3nelog2hj2djhiom3kln.2n10km6.|14.o6kln4og2fh2j3hgln3kn2.3o8km6.|14.n2j5ko2.lnl3f4hikol3kn4.on7km6.|13.on3j4ko3.2oi3f3hkmn4kn5.2n6kl6.|13.ol3j3klo3.2oih5fkon3kmo6.o6kl6.|13.nk3j3kln3.2oi4h2flnl3kno6.o6kl6.|12.nm6jlmn3.og6hfon3kmo7.o6kl6.|11.2n3g4jlo4.nkf5hion2ekmo6.ondfdg2kl6.|10.mle3beg2jno4.ok3f3hio3egn6.ol5bgkl6.|9.olk2bec2egmo4.one3bd2hio2de2n6.o2e5bko6.|9.oel2cl4e2o4.l6beimo2n2o7.obl2bl2beo6.|9.ogl2el3e2n4.ol4bk3bnl11.nelcel2b2n6.|10.n6o2n5.nlk3bl2bena12.3n5o7.|24.n2l2bemeb2n28.|24.4n5on29.|26.2n5o30." },
  Rebecca_out_1: { w: 33, h: 61, p: "febd32,ffaf26,ffae25,fead24,fcac23,f88d1f,ff6b11,f86a17,f95c11,f91505,af4323,220524,100327,0c0222,0f0121", r: "17.2j14.|15.3j15.|14.3j16.|14.2ja16.|14.3j16.|15.3j15.|15.jgja14.|15.j2gj14.|11.j2.2j2gj14.|10.5j3gj14.|9.5j3g2j.j12.|9.j2ij4g5j11.|8.2ji3ga2gi4j11.|8.2ji2g3a2gi3j11.|8.2jig5a3g2j11.|9.2jg5a2g2j12.|10.j2i3afi3j12.|9.m2n2ie2i2l14.|7.2ml2f4ef3nm12.|5.n2m2a3b4dedb3m10.|4.noeb4a2b3dc4b2m9.|3.no2e5a10be2n8.|2.mofe5ac10bdf2n7.|2.mhc4de2dc5bcbc2dehn7.|.2m2bcbc3dc4b3cb4de2n6.|2mi5b3c2bcb3cbc4de2m6.|2ne4b8c8dcdhm6.|2nehlkd5c4d2he3dcbch2m5.|noeoaodcb3c2deilnl2dc2bchmn5.|noemnm3b2c4dnlnm5bdh2n5.|2nflmkb3fb2c2bm3n5bdh2n5.|2nf4k3lk2bcdkmnkd2c2bghmn5.|2n2e2k2f2ghkfd2eklf4degh2m5.|2m2lk2a4gi2ked4bcde2gkm6.|.2nhgf6gioe2c4bdeghon6.|.2nk2hg4iklked2c3bcghon7.|2.4m3o2mkhe4d2c2gh2m8.|3.2mo5hge2bcd4gh2m9.|4.2nol11gh2o3m4.2n2.|4.2noi2kh9g4hm4nhom.|3.3mf13g2c2bek2nkbh2m|2.2mklbe7g6bc3dedc2bh2m|.lohl4b2c3dc5b2cdegh3b2gon|2nfhlbc2b2c3dc2bhb2c3deolkb2gon|2nhofd9c2bo3d2c3bhok2g2m|2nhnd9cdcdo2ed5bf2l2h2m|2nhoc3b7c2d2oc4bcdh2lhlm.|nmhoh3b7cdcklkbc3dhlo2ion.|.3mh2bc2dcd2c3bfklm4hlm2hon2.|2.3mh6dc4bc2g6l2himn2.|3.mohg2fd3c3bef3g4k3hlm3.|4.2nh3g6f10gh2m4.|5.no2h15ghlon5.|6.2ml2ih8g2h2lo2n6.|8.2m3l5o4l3m8.|8.2mlko6nmk2m10.|7.ml3kln3.2no2km10.|6.l3h2kl3.2oigikn10.|6.m2o3mn2.ofh2gikn10.|7.5nm2.n2moh2mn10.|16.6m11." },
  Rebecca_out_2: { w: 64, h: 75, p: "f9af38,fc7212,ff6e12,fd6e12,fe6d11,fe5d0b,e95510,f03015,f71607,e5281c,9a1f1f,180728,140224,100123,110020", r: "31.lk31.|31.l2n30.|31.mgon29.|31.mfgl29.|31.l2fgn28.|25.mn3.lh2fgn28.|24.nkon2l4fgn28.|23.nmflm2fe3fln28.|22.nogfjhfba3fmk3n25.|22.nk4fb2a2fim2kmn25.|22.lfb2fb3a2fijhikn25.|22.kf7a2fh3iko25.|22.kf5ab3f3ijm26.|22.kf5ah5ijo27.|21.mkfb3af2hefio3n26.|19.2ol2kf2a2f5edk3n25.|18.nmb2ekhbf7e2cgk2n24.|17.nmb3egjf7e4cfko24.|16.mlb11e5c3eflo23.|16.mlbc9e5c5eg2n22.|15.2n4c7e3c9eln22.|15.2ne2c18e2clml21.|14.lngdk2b6ec3egkg2e4cjnm21.|14.2nblmk6c4egl2nb4cejmn17.no2.|14.2ndoaoe5c4ek2anlb2c2ejmo16.4n.|14.2ndoaoe5c4eo2anl2c3ejmn15.2nj2n.|2.2n10.2nd2nme2c2b3ecd4nm5ehln15.nkg2n.|.4n9.2nb2nleb3ob3cbm3nm3e2chln14.mlgf2n.|.nkgo9.nmbkmldk3bk4bm3nm3ecgjlm13.nlg2f2n.|.okhkn8.nm2bknma4bl2b2dmnmb4e2jln12.nog3fmn.|.nkfgml8.nlb2m2abgk2blod2e3bc2egjln12.nogh2fhml.|.nk2fg2n7.3nl2a7bko2e5cehj2o10.2nogh3fmn2.|.nk2fhg2l5.l3n2a8bko3e4ch2j2o9.n2o2g3fgmo2.|2.n2hf2h2n3.lnb3a7bfg2o4ecbh2jlo8.3n2a5fkna2o|2.nkh3fg2l2.2n9bfgknod4ef3jlm7.2mnl3ai3fg3m2n|2.2ohfhifgm2l.3n8gl2m2bd2e4j2l7.3nk4a2ihgon2ljn|o3nk2fifeg3n.l2no3n2ml10jl2n6.n2ol6a3ikmo2hkm|2o3lgfhi2fgklnk2a4lml2k8j3o5.n2l8a5i3hkmn|2ohfgk2hijh3egko6anlk8jo6.nl3a2b4a4ih2fhi2n.|.nkf4hi4j3e2kl4an10jn5.nl2a2b4ce4i3f2iln2.|.lnk2h2fa6jecgm4am9jg2n3.2n2ab3cdce4a5ilm3.|2.nlj3f2a6j2cg4nke5jd2cdkn3.nbabed4c5a4ilon3.|3.n2lhi3ah5j2eg3lbd4e5cbknonlab3ed2cb4a2il3o5.|3.2mnk2i3a7jcglk4ec4edc2bl3abdec2e2ca2b4im5n3.|3.3nok2iag9jlbce4cdcd2cbkb2a8e7i2h2fh2n3.|3.lj7i8jla3c3d6cbkbd2c7e3abi3h3fmo4.|4.l4if3a6jklbe4cdcd4c3d2ed3c2e5a3if2hlnm5.|5.nl4i4a4jma2ecd6c3d3c3e3ci5a5ilnon6.|6.2nl6i3jklaec3d4c4d5ce3ca6io5n8.|7.n4m3ie2j2lac3dcdc2dec3d4ce2hb2af5h3o10.|9.2lj2i2jkjmoa4c3dcdcdcd2ce2jhe4i7hko10.|8.nm4joljknoa4c3dcdc2d5cjk3j2hlmg4hmn10.|9.o4no3k2mb8cdcd6c2jolj2hjo4n2m11.|11.3nolklmld3c2e2dcd3c6e2jkml2koklnm13.|14.non2mlk2cecd8c5eh3j4kjmn14.|19.nl3ec2dcd3c2ec4e9jo15.|19.noj2ecd6c2e3ce7jhjln15.|20.okjd5cd2ce4c7jhjkn16.|20.2nk2j5ce3c11jkln16.|21.2lk20jl2m17.|22.3nk17jon19.|23.4o14jl2o20.|23.lokjl2mn2om6jln22.|24.2ok2jlno2nml3jl2m22.|25.2n3mn3.m2n2on24.|25.lngk2n5.nlgl24.|22.o2nmlgkno5.nljl24.|17.o2nm4lk3gmn5.nlgln23.|16.2o3kjgd2e3bmn4.nl3bmn22.|16.2nlgd2b2gbegon4.2o5bon21.|17.mnmebgd2bg2o4.2m7bmn20.|18.n3on2bgln4.nl2bdgbedcbon19.|22.2m3n5.obmlgbeg2ob2n19.|32.2o2nm2g4o2n19.|36.m3n24." },
  Rebecca_out_3: { w: 62, h: 81, p: "fdcb66,ffb124,ffa41f,f49922,fe6310,fe400d,f95311,c95121,eb3114,e11c15,b91627,670f25,1b0325,0e0224,0f001f", r: "26.2n34.|18.2n6.3n33.|18.ngo5.nin33.|18.ngn4.2nfn33.|17.nmgn4.ndfm33.|16.nmein3.2ndfm33.|14.2nmejkn.2nogikm33.|13.n2mdekl2nmecj2kn33.|11.nom2dehmnmide3kon33.|10.nm2cfkl2h2dh4kmn34.|9.nmbdfi2hei6knm4.2n29.|8.nmde5f4k3m2n3.noho29.|8.nde5f5kfe2dm2nmnhko29.|7.nmdg4fjg2e3kif2dc3bjko6.2j9.3n9.|6.2nle4fc5bci5ked2jkn5.f2i8.mkhn9.|5.no2lg2fec9b8km5.i2ei6.om3fn9.|4.nm2bl3f11bcln4kmn5.jd2e5.no4fn9.|4.ne2beic13bdl3non6.fdej5.m5fo6.j2.|3.nm2ab2d13bedemnl8.gfi5.m5fio7.j.|2.lod16bd2fdbm11.i5.o7fio6.2j|2.2ng11be7fdb2m15.2o3fb3fin5.i2j|2.2nje9b9fceim15.mj2f2b3fin4.i2ei|2.2nmg8b2g5noifc2en8.2m2n2.nj2f4b2fin3.f3ej|2.nlam7beg2nml2am2fcego7.mkfhn2.n2f5b2fin2.j4ei|2.nkln7bf2na2k2amfebego6.mk2fgm2.lg2b2c2b2fko2.idbei.|2.ni2nb2h4binolfh2ameb2egn6.o4fk2njfbe2k2b2fl3.jfdi2.|2.njlnl2dl2bcomolg2al3b2eln5.oife2fknmjfb3kbc2fn3.a2i3.|2.olgn2a2dhcedgmidahc2bc2e2m5.o2fbcfknm2fb2jkbefin9.|2.nomabdg2eld4bcbc3begkm6.nf3bfk2n2fb2j2bgfm6.4o|2.noab5edld7bc3jln5.nkfbkeckol2fbj2befio4.3nhio|.2nab7edlm5be3jkon5.n2fb2kckoj2f3b3fln3.onhg2fo|2nabd5em2onc4be3jk2o6.n2fbkbckoi2fb5fm3.ok4fmn|oac3dho2lkl2i4e4jkon4.mn.o2febcfkl2fc6fn2.l6fn.|odeg2nmklno2k9jln4.ngo.o3fbgf2h2fb5fm2.l2gebc2fo.|od2o7n2o8jkm5.n2f2o3fc2fkhf2d4fio.ohd3bg2fo.|3o6.mnk9j2n5.n2fgoi2fcfgmhfc5foaomedjcbg2fm.|10.nk7jehn6.nfde2l2fcfinkfc5fnomfc2kcbgfm2.|10.n6j3e2o6.nfcfimkc2fimkce4flnm2fc2kcb2gm2.|9.2n4j5eo7.nic2jmjd3kmkc5f2m2fecjec2f2m2.|9.m10eo8.nifklkd2kl2keif2klm2fe2ce3flm3.|8.oh7e2bem8.okf3kd2kmke5knlgdbe4fkm4.|7.no5ed4beln7.oli3kd2kmki4kmlkdcg4flm5.|6.hncb2d8bem4nol2.n3kmd2km5k2lk2eij2ijmn6.|5.nld12b2g3bd3onal2kmdklki3k2lk2e5klm7.|4.2nda11bge7be3n2kmikmkg2k2lkh6klal2no3n.|3.mdna11b2eb3a6bdn2m3kmg2k2lke6k4nmg2ign.|2.2ndm12bkb3a8bghomkml3klkg5k3oki5fjn.|2.oemh11bgkb2a9b3gdm4klkg4k2no2kg2cbg2fmo.|.2oeog10bdgm9bij2cegdim9k2ml2kidkdb2gmn2.|.oegoecd6beb2go10bf2jbeicel5k3m8kcdfln3.|.ogfofde3bd2b2kgio7b2fc2bjib2ibhl2kmo7k3bcdflo4.|.ogfof2k3bk2b2k2foe6bc2j3b4i3bon5k2eg4kfl2o5.|.ogfm2fk2be2kbk3fm2ebc2fdb2j5id5bnm11kl2n6.|.n2im2fihbkf2k4fkme2cegebf2i2bi2j6bd2l5klonm9.|.nikli2f2ik8fmgecegie2bf3b2jgig5ben5o12.|2.ngjm3f2i8fjm4e3i2fgcdjibcijih2ben17.|2.mkjmi13fklge2def3ijife4bd3m2n17.|3.nl2mi11fi2kl2ie2dijfe2d2ec3bcdhn18.|3.noko2k10f4klk2i4jd3bd2e2dh2o19.|4.omom2k3j4f8k3l2j2ig4ege3o20.|5.o2nm18ko11mn22.|7.3n24kl2n25.|9.2n23kon26.|10.3o18k4o27.|11.4om6kl8k2o29.|12.o2k3m2on2ol7kn30.|13.2m5komlo6kmn30.|14.2n3k2o2ahn4kon31.|15.5o4ahn4o32.|16.o2ho6ao2ho32.|16.o2hn6ao2ho32.|15.no2hm6an2ho32.|14.nmhgo7am2hn32.|8.7mh2e3m4anm2em32.|7.m6hg2e3hmn2aom3eln31.|7.m2he2h2ehmn.3nml2h3ehn31.|7.3o2melmon3.2me3heh2en31.|8.4nm2n5.mdemk2em2en31.|11.o2n6.oe2n2el2oen31.|20.2o.nhl4on31.|23.n2o3.o32." },
};
const ART = (id: string) => ["@art:" + id];
const artCache: Record<string, { w: number; h: number; pal: string[]; runs: number[][] }> = {};
function getArt(id: string) {
  if (artCache[id]) return artCache[id];
  const a = PIXEL_ART_HD_A[id] ?? PIXEL_ART_HD_B[id];
  if (!a) return null;
  const pal = a.p.split(",").map((c) => "#" + c);
  const runs: number[][] = [];
  a.r.split("|").forEach((row, y) => {
    let x = 0; const re = /(\d*)([.a-z])/g; let m: any;
    while ((m = re.exec(row))) { const n = m[1] ? parseInt(m[1], 10) : 1; if (m[2] !== ".") runs.push([x, y, n, m[2].charCodeAt(0) - 97]); x += n; }
  });
  return (artCache[id] = { w: a.w, h: a.h, pal, runs });
}

function Sprite({ map, pal, scale = 6, flip = false }: { map: string[]; pal: any; scale?: number; flip?: boolean }) {
  if (map[0]?.startsWith("@art:")) {
    const a = getArt(map[0].slice(5));
    if (!a) return null;
    const raw = (scale * 16) / Math.max(a.w, a.h, 96);
    const k = raw >= 1 ? Math.floor(raw) : raw; // whole screen pixels per art pixel when enlarged = crisp edges
    const filter = pal === SHINY ? "sepia(0.55) saturate(1.9) hue-rotate(-12deg) brightness(1.12)"
      : !UI.game ? "grayscale(1) sepia(1) hue-rotate(45deg) saturate(1.7) brightness(0.85)" : undefined;
    return (
      <svg width={a.w * k} height={a.h * k} viewBox={`0 0 ${a.w} ${a.h}`} shapeRendering="crispEdges" style={{ imageRendering: "pixelated" as any, filter }}>
        {a.runs.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n + 0.02} height={1.02} fill={a.pal[c]} />)}
      </svg>
    );
  }
  const col: Record<string, string> = { "0": pal.d0, "1": pal.d1, "2": pal.d2, "3": pal.d3 };
  const w = map[0]?.length || 16, h = map.length || 16;
  const rects: any[] = [];
  map.forEach((row, y) => row.split("").forEach((ch, x) => {
    if (ch !== ".") rects.push(<rect key={`${x}-${y}`} x={flip ? w - 1 - x : x} y={y} width={1.02} height={1.02} fill={col[ch]} />);
  }));
  return <svg width={16 * scale} height={(16 * scale * h) / w} viewBox={`0 0 ${w} ${h}`} style={{ imageRendering: "pixelated" as any }}>{rects}</svg>;
}

const gen1Stat = (base: number, statExp: number, lv: number, hp = false) => {
  const v = Math.floor((((base + 15) * 2 + Math.floor(Math.ceil(Math.sqrt(Math.min(statExp, 65535))) / 4)) * lv) / 100);
  return hp ? v + lv + 10 : v + 5;
};

function Bar({ pct, color, bg, h = 6 }: { pct: number; color: string; bg: string; h?: number }) {
  return (
    <div style={{ height: h, background: bg, border: `2px solid ${GB.d0}`, borderRadius: 2 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }} />
    </div>
  );
}

function GbBox({ children, style }: any) {
  return (
    <div style={{ background: GB.d3, color: GB.d0, border: `3px solid ${GB.d0}`, borderRadius: UI.game ? 12 : 4, boxShadow: UI.game ? `inset 0 0 0 3px ${GB.d2}, 0 4px 0 rgba(21,48,74,.15)` : `inset 0 0 0 2px ${GB.d2}`, padding: UI.game ? 14 : 10, ...style }}>
      {children}
    </div>
  );
}


// ---- Outbound creature (separate XP: only Apollo-sourced contacts + Outbound-source deals) ----
const SPRITE_HONK = ["................","................","......000.......",".....03330......",".....030330.....",".....03333000...","......033311110.","......03300000..","......0330......","....003333000...","...03333333330..","..0333222233330.","..0332222223330.","...03333333300..","....000000000...",".....11...11...."];
const SPRITE_GANDER = [".....000........","....03330.......","....030330......","....0333301110..",".....033300000..",".....0330.......",".....0330...00..","....033300.0220.","..0033333302220.",".033333333322220","0333222222333320","0332222222233330",".03322222223330.","..003333333300..","....00000000....","....11....11...."];
const SPRITE_SKY = ["...1.000........","..1.03330.......","....030330...00.","....033330111020","00...03330000022","0200.0330...0222","02220.0330.02222","0222200333002222",".022203333333222","..02233333333330","..0332222223330.",".03322222222330.","..0332222233300.","...00333333000..","....00000000....","....11....11...."];
const DEFAULT_OB_TARGET = 10; // FQ4 policy: 55 inbound + 10 outbound; >100% attainment unlocks only once outbound target is met
const OB_SPECIES = [
  { name: "HONKLET", map: SPRITE_HONK, base: { hp: 44, atk: 52, def: 44, spd: 56, spc: 60 }, flavor: "Waddles up to strangers. Usually gets ignored." },
  { name: "GANDERWING", map: SPRITE_GANDER, base: { hp: 60, atk: 70, def: 58, spd: 72, spc: 75 }, flavor: "Never flies alone; always brings three contacts from the same account." },
  { name: "SKYGANDER", map: SPRITE_SKY, base: { hp: 80, atk: 92, def: 76, spd: 95, spc: 95 }, flavor: "Its honk reaches the VP of Data before the gatekeeper notices." },
];
const OB_MOVES = [
  { lv: 1, name: "LIST BUILD", type: "NORMAL" },
  { lv: 5, name: "COLD EMAIL", type: "NORMAL" },
  { lv: 10, name: "CONNECT REQUEST", type: "FLYING" },
  { lv: 16, name: "GATEKEEPER DODGE", type: "GHOST" },
  { lv: 22, name: "MULTI-THREAD", type: "BUG" },
  { lv: 30, name: "TRIGGER EVENT", type: "ELECTRIC" },
  { lv: 38, name: "WARM INTRO", type: "FAIRY" },
  { lv: 46, name: "EXEC OUTREACH", type: "PSYCHIC" },
  { lv: 55, name: "ACCOUNT TAKEOVER", type: "DRAGON" },
  { lv: 65, name: "LAND & EXPAND", type: "DRAGON" },
];

// ---- Per-BDR trainer classes + creature lines (original pixel designs, 24x24) ----
const CREATURE_MAPS: Record<string, string[]> = {
  KINDLIT: ["........................", "........................", "........................", "........................", ".......0...0............", "......020.020...........", ".....02200020...........", ".....02222220...........", ".....02222220...........", "....0222222220......0...", "....0222202220.....010..", "....0233302220....0110..", ".....0333222200..01110..", "....03333222222001110...", ".....0002222222211110...", "......022222222221110...", "......022333333221110...", "......02233333322000....", ".......0233333320.......", "........02222220........", ".........0220220........", ".........0220220........", "..........00.00.........", "........................"],
  BLAZETAIL: ["....0.....0.............", "...020...020............", "...0220..020.......0....", "...0220.0220......010...", "...022200220......010.0.", "...022222220......010010", "...0222222220....0110110", "...0222202220....010110.", "...0222202220...0111110.", "..033333222200..0111110.", "...03333222332000111110.", "...03332233322221111110.", "....0002233222222111110.", ".....02222333322221110..", ".....02233333333221110..", ".....02233333333221110..", "......023333333320000...", "......022233332220......", "......022022220220......", "......022022000220......", "......0220220.0220......", "......0220220.0220......", ".......00.00...00.......", "........................"],
  PYRALYNX: ["..010...010.............", "..020...020.........0...", "..0220.0220........0100.", "..022200220........01010", "..022222220........00110", "..0222222220..0...011110", "..02222222200010..011110", ".02222202221110..0111110", ".023332021111100.0111110", "..033332111112220111110.", ".0333332211111112211110.", "..000222211111122221110.", ".....022231111333222110.", ".....022333113333322110.", ".....022333333333322110.", "......0233333333332000..", "......02233333333220....", "......02202222220220....", "......02202200220220....", "......02202200220220....", "......02202200220220....", "......02202200220220....", "......02202200220220....", ".......00.00..00.00....."],
  HOOTLET: ["........................", "........................", "........................", "........................", "......0..........0......", ".....020........020.....", ".....0220......0220.....", ".....02220000002220.....", ".....02222222222220.....", ".....02233322333220.....", "......033333333330......", ".....02331333313320.....", ".....02230333303220.....", ".....02223311332220.....", ".....02233333333220.....", ".....02233333333220.....", ".....02233333333220.....", "......023333333320......", "......022333333220......", ".......0023333200.......", "........011000110.......", "........0110.0110.......", ".........00...00........", "........................"],
  DUSKOWL: ["....020..........020....", "....0220........0220....", "....02220......02220....", "....022220....022220....", ".....022220..022220.....", ".....02220000002220.....", ".....02002222220020.....", "......003332233300......", ".....00331333313300.....", "....0223313333133220....", "...022223033330322220...", "...022222331133222220...", "...022222333333222220...", "...022223333333322220...", "...022223332323322220...", "...022223333333322220...", "...022223332323322220...", "...022223333333322220...", "....0222233232322220....", ".....00023333332000.....", "........02333320........", "........011000110.......", "........0110.0110.......", ".........00...00........"],
  NOCTURNEX: [".....020........020.....", ".....0220..00..0220.....", "......022001100220......", "......022211112220......", "......022200002220......", "..0....0200000020....0..", ".020....00222200....020.", ".0220...03322330...0220.", ".0222000331333130002220.", "032222202302230202222230", "033322222221122222223330", ".0333222223113222223330.", ".0333332233333322333330.", ".0333332233333322333330.", ".0333332233333322333330.", ".0333322233333322233330.", "..03322023333332022330..", "..03220023333332002230..", "...020..02333320..020...", "....0....023320....0....", "..........0000..........", ".........010010.........", ".........010010.........", "..........0..0.........."],
  DRIZZLET: ["........................", "........................", "......0.................", ".....020................", "......020...00..........", "......0220.0220.........", "......022200220...0.....", ".......02330220..010....", "......03333330..0110....", ".....03333333300110.....", "....033333333331110000..", "....0333033333301102220.", "....03330333333000022220", ".....033333333300..00220", ".....0333111333330.00220", "......033333333333022220", ".......00333311333222220", "........033111111322200.", ".........031111113220...", "..........0331133000....", "...........000000.......", "........................", "........................", "........................"],
  TIDEWYRM: [".020....0...............", "..020..020..............", "..0220.020..............", "..02220220..............", "..00233320..............", ".0333333330.............", ".0333033330.............", ".0333033330.............", ".0111333330.........0...", "..00333330..00.....020..", "....003330.0220...0220..", ".....0333300220..02220..", ".....0333300220.02220...", ".....0333302222033220...", "......033333303311320...", "......0331133311333330..", ".......033311113333330..", "........003331333033330.", "..........0003330333330.", "........0....0000333330.", ".......010000000333330..", "......011133333333330...", ".....011003333333330....", "......00.03333333330...."],
  SKYLEVIATH: ["........020...0.........", ".0......0220.020......0.", "010......0220220.....010", "0110....03333320....0110", ".0110...03333330...0110.", ".01310..03303330..01310.", ".013310.03303330.013310.", ".0113310033333300133110.", "..01333100031330133310..", "..01333310033331333310..", "..01133330033303333110..", "..01133330033303333110..", "...013330.03130033310...", "...01030..03130.03010...", "....0.0...033130.0.0....", "..........033130........", "...........033130.......", "...........0333330......", "............033330......", "............0333330.....", "......0000000333330.....", ".....02233333333330.....", "....02222333333300......", ".....00033333330........"],
  ZAPPIP: ["........................", ".........0....00........", "........010..0210.......", "........020..020........", ".........020020.........", ".........0200200........", "........022202220.......", "........0200.020........", "........020..020........", "........02000020........", "........03233320........", ".......0333333330.......", "......033333333330......", ".....03330333330330.....", ".....03330333330330.....", ".....03332222223330.....", ".....03322200022330.....", "......032222222230......", ".......0322222230.......", ".......0033333300.......", "......022002200220......", "......022002200220......", ".......00..00..00.......", "........................"],
  VOLTWICK: ["........................", ".........0....00........", "........020..0220.......", "........020..020........", ".........020020.........", ".........020020.........", ".........032320.........", "........03333330........", "......000330303000......", "....0011133030311100....", "...011111333333111110...", "..01111111333311111110..", "..01111111222211111110..", "...011111222222111110...", "....0011122222211100....", "......000222222000......", "........03333330........", ".......0333333330.......", ".......0331111330.......", ".......0331111330.......", ".......0331111330.......", "........03333330........", ".........000000.........", "........................"],
  THUNDRAKE: ["........................", "........................", "...........00...........", ".........003300.........", "........03333330........", "..00000003033300000000..", ".0111111130333011111110.", "011111111333333111111110", "011111111112211111111110", ".0111111112222111111110.", "..00000000222200000000..", ".0111111112222111111110.", "011111111122221111111110", "011111111112331111111110", ".0111111110033111111110.", "..00000000.01300000000..", "..........00330.........", ".........033330.........", ".........033330.........", ".........031330.........", "..........033330........", "..........033330........", "..........03330.........", "..........0330.........."],
  LILMYST: ["........................", "........................", ".......00......00.......", "......0110....0110......", "......0110....0110......", ".......020....020.......", ".......0220..0220.......", "........02000020........", "........02333320........", "......000323332000......", ".....03333333333330.....", "....0333333333333330....", "...033333333333333330...", "...033333333333333330...", "....0333330333033330....", ".....03333033303330.....", ".....03313333333130.....", ".....03333333333330.....", "......033333333330......", ".......0333333330.......", "........00000000........", "........................", "........................", "........................"],
  VIOLOOM: ["........0......00.......", ".......020....0220......", ".......0220..0220.......", "....0000020..0200000....", "..00222202200220222200..", ".0222222222002222222220.", ".0222222220232222222220.", "022222222233332222222220", "022211112233332211112220", "022211112230302211112220", "022211112230302211112220", "022211112333333211112220", "022222222333333222222220", ".0222222233333322222220.", ".0222222233333322222220.", "..00333333333333333300..", "..03333333333333333330..", "..03333333333333333330..", "..03333333333333333330..", "..03333333333333333330..", "...033333300003333330...", "....000000....000000....", "........................", "........................"],
  AMETHORA: ["0.......020110220......0", "20......02000020......02", "220......020020......022", "2220.00..020020..00.0222", "22220110.032320.01102222", "22221110.03030..01112222", "22222110.03030..01122222", "222221220033330022122222", "022222222033330222222220", "022222222233332222222220", "022222222233332222222220", "022222222233332222222220", "022222200033330002222220", "022000000333333000000220", ".0003333333333333333000.", ".0333333333333333333330.", "..03311333333333311330..", "..03311330033003311330..", "...033333003300333330...", "...033330..00..033330...", "....03330......03330....", "....0330........0330....", ".....00..........00.....", "........................"],
  // outbound duck lines
  CINDUCK: ["........................", "........................", "........................", ".............0..........", "............010.........", "..........0010..........", ".......0001110..........", "......0331110...........", ".....03333330...........", "....0333033330......0...", "..001133033330.....010..", ".011111133333000..0110..", "..01111333333333001110..", "...0000333333333311110..", ".....0333332222333110...", ".....0333322222233110...", ".....0333322222233010...", ".....033332222223300....", "......033332222330......", ".......0333333330.......", "........01133110........", "........01100110........", ".........00..00.........", "........................"],
  BLAZEDRAKE: ["............010.........", "...........0110.........", ".........001100.........", "......0001111010........", ".....0331111110.........", "....0333311110........0.", "...0333033310........010", ".000333033330.......0110", "0111111333330......01110", "0111113333300000..011110", ".00000333333333300111110", "......033333333333111110", "......03333222222331110.", ".....033332222222233110.", ".....033322222222223110.", ".....03333222222223310..", ".....0333332222223330...", "......03333333333330....", ".......033333333330.....", "........0033333300......", ".........01000010.......", ".........010..010.......", "........0111001110......", ".........000..000......."],
  PHOENIDRAKE: ["..........001100..0.....", ".........01110010010...0", ".....00001111110.010..01", "....0331111111000110.011", "...033333111111111100111", "...033303331111011101111", "000033303331110111111110", "111111133333100111111110", "111111133333001111111111", "000003333330000111111111", ".....0033333333331111110", "......033332222223311110", ".....0333322222222331110", ".....033332222222223110.", ".....033322222222223110.", ".....033322222222223110.", ".....03333222222223310..", ".....0333332222223330...", "......03333333333330....", ".......003333333300.....", ".........010000010......", ".........010...010......", ".........010...010......", "........01110.01110....."],
  BREEZLET: ["........................", "........................", "........................", "........................", "........................", "...................0....", ".......0000.......020...", "......033330.....0220...", ".....03333330...02220...", "....0333033330.022220...", "..0011330333300222220...", ".0111111333330222220....", "..011113333333332220....", "...00003333333333220....", ".....033333222233320....", ".....03333222222330.....", ".....03333222222330.....", ".....03333222222330.....", "......033332222330......", ".......0333333330.......", "........01133110........", "........01100110........", ".........00..00.........", "........................"],
  GALEDRAKE: ["........................", "........................", "..................0...0.", "......0000.......030.020", ".....033330.....03300220", "....03333330....03302220", "...0333033330..03332220.", ".000333033330..03332220.", "0111111333330.033322220.", "01111133333000333322220.", ".0000033333333333322220.", "......0333333333332220..", "......0333322222233220..", ".....03333222222223320..", ".....0333222222222230...", ".....0333322222222330...", ".....0333332222223330...", "......03333333333330....", ".......033333333330.....", "........0033333300......", ".........01000010.......", ".........010..010.......", "........0111001110......", ".........000..000......."],
  STORMWING: ["0.....................02", "20...................022", "220..000000.........0222", "022003333330.......02320", "0232333333330.....023320", "0233333033330....0233320", "0023333033330...02333220", "1111111333330..023333220", "1111111333330.023333320.", "00233333333000233333320.", "..023333333333333333320.", "..023333333222222333320.", "..023333332222222233220.", "...0233333222222222320..", "...0233332222222222320..", "....00333222222222230...", ".....0333322222222330...", ".....0333332222223330...", "......03333333333330....", ".......003333333300.....", ".........010000010......", ".........010...010......", ".........010...010......", "........01110.01110....."],
  MUSELET: ["........................", "........................", "........................", "........................", "........................", ".........0..............", ".......0010.............", "......033110............", ".....03333330...........", "....0333033330..........", "..001133033330..........", ".011111133333000........", "..011113333333330.......", "...000033333333330......", ".....03333322223330.....", ".....03333222222330.....", ".....03333222222330.....", ".....03333222222330.....", "......033332222330......", ".......0333333330.......", "........01133110........", "........01100110........", ".........00..00.........", "........................"],
  MYSTDRAKE: ["........................", "........................", ".......00...............", "......0110........00....", ".....031130......0110...", "....03311330....011110..", "...0333033330...011110..", ".000333033330....0110...", "0111111333330.....0000..", "0111113333300000...0110.", ".00000333333333300.0110.", "......0333333333330.00..", "......03333222222330....", ".....0333322222222330...", ".....0333222222222230...", ".....0333322222222330...", ".....0333332222223330...", "......03333333333330....", ".......033333333330.....", "........0033333300......", ".........01000010.......", ".........010..010.......", "........0111001110......", ".........000..000......."],
  ASTRALDRAKE: ["........................", "....0..00..00...........", "...02001100220.....00...", "...0233113300.....0110..", "...0333333330....011110.", "...0333033330....011110.", "0000333033330.....0110..", "1111111333330......00...", "1111111333330...........", "00000333333000000....00.", ".....00333333333300.0110", "......033332222223300110", ".....033332222222233000.", "..00.0333322222222230...", ".01100333222222222230...", ".01100333222222222230...", "..00.0333322222222330...", ".....0333332222223330...", "......033333333333310...", ".......00333333330110...", ".........01000001000....", ".........010...010......", ".........010...010......", "........01110.01110....."],
  SHADLET: ["........................", "........................", "........................", "..........0.............", ".........020............", ".........0220...........", ".......002220...........", "......033330............", ".....03333330...........", "....0322122220..........", "..001122022220..........", ".011111133333000........", "..011113333333330.......", "...000033333333330......", ".....03333322223330.....", ".....03333222222330.....", ".....03333222222330.....", ".....03333222222330.....", "......033332222330......", ".......0333333330.......", "........01133110........", "........01100110........", ".........00..00.........", "........................"],
  NIGHTDRAKE: ["..........0.............", ".........0200...........", "........022020..........", "......00222220..........", ".....03333220...........", "....033333220...........", "...0322122220...........", ".000322022220...........", "0111111333330...........", "0111113333300000........", ".00000333333333300......", "......0333333333330.....", "......03333222222330....", ".....0333322222222330...", ".....0333222222222230...", ".....0333322222222330...", ".....0333332222223330...", "......03333333333330....", ".......033333333330.....", "........0033333300......", ".........01000010.......", ".........010..010.......", "........0111001110......", ".........000..000......."],
  ECLIPSDRAKE: ["........02200020........", ".......02220220.........", ".....0022222220.........", "....03333222220.......0.", "...02222222220.......020", "...02221222220.....00220", "00002220222220...0022220", "1111111333330...0222220.", "1111111333330..02222220.", "00000333333000022222220.", ".....003333333333222220.", "......033332222223322200", ".....0333322222222332222", ".....0333322222222232220", ".....033322222222123220.", ".....033322222222213220.", ".....03333222222213320..", ".....0333332222223330...", "......03333333333330....", ".......003333333300.....", ".........010000010......", ".........010...010......", ".........010...010......", "........01110.01110....."],
  ZAPLING: ["........................", "..........00............", ".........0110...........", ".........010............", "..........0.............", ".........010............", ".......0000.............", "......033330............", ".....03333330......00...", "....0333033330....0110..", "..001133033330....010...", ".011111133333000.0100...", "..01111333333333001110..", "...000033333333330110...", ".....033333222233310....", ".....03333222222330.....", ".....03333222222330.....", ".....03333222222330.....", "......033332222330......", ".......0333333330.......", "........01133110........", "........01100110........", ".........00..00.........", "........................"],
  AMPDRAKE: ["........010.............", "........010.............", "........0110............", "......00010.............", ".....033130.............", "....03333330........00..", "...0333033330......0110.", ".000333033330......010..", "0111111333330.....0110..", "0111113333300000..0100..", ".0000033333333330001110.", "......0333333333330110..", "......033332222223310...", ".....0333322222222330...", ".....0333222222222230...", ".....0333322222222330...", ".....0333332222223330...", "......03333333333330....", ".......033333333330.....", "........0033333300......", ".........01000010.......", ".........010..010.......", "........0111001110......", ".........000..000......."],
  TESLADRAKE: ["........010.........00..", ".......010.........0110.", ".....000110........0110.", "....03331330......0110..", "...0333333330.....01000.", "...0333033330.....011110", "0000333033330.....01110.", "1111111333330.....0110..", "1111111333330....0110...", "00000333333000000010....", ".....00333333333300..00.", "......033332222223300110", ".....033332222222233010.", ".....033332222222223000.", ".....0333222222222230110", ".....033322222222223010.", ".....03333222222223310..", ".....0333332222223330...", "......03333333333330....", ".......003333333300.....", ".........010000010......", ".........010...010......", ".........010...010......", "........01110.01110....."],
};
type CLine = { name: string; map: string[]; base: any; flavor: string }[];
const mkLine = (names: string[], flavors: string[]): CLine => names.map((n, i) => ({ name: n, map: CREATURE_MAPS[n], base: SPECIES[i].base, flavor: flavors[i] }));
const pal4 = (a: string[]) => ({ d0: a[0], d1: a[1], d2: a[2], d3: a[3] });
const TRAINERS: Record<string, { cls: string; type: string; obType: string; color: string; line: CLine; obLine: CLine; inPal: any; obPal: any }> = {
  "89400804": { cls: "Team Red", type: "Fire", color: "#e8603c",
    line: mkLine(["KINDLIT", "BLAZETAIL", "PYRALYNX"], ["Its tail flickers brighter every time a trial signs up.", "Turns a cold lead warm with a single follow-up.", "Leaves a trail of booked meetings wherever it hunts."]),
    inPal: pal4(["#3a2020", "#ffb030", "#e8603c", "#ffe2c0"]), obType: "Fire", obLine: mkLine(["CINDUCK", "BLAZEDRAKE", "PHOENIDRAKE"], ["Waddles into cold accounts and warms them right up.", "Its first email lands like a spark in dry grass.", "Revives closed-lost accounts from the ashes."]),
    obPal: pal4(["#3a2020", "#ffa424", "#d8503a", "#ffd6a0"]) },
  "95672339": { cls: "Team Silver", type: "Dark", color: "#7d8691",
    line: mkLine(["HOOTLET", "DUSKOWL", "NOCTURNEX"], ["Sees every reply, even the ones sent at 2 a.m.", "Hunts silently through the inbox after dark.", "Team Silver's sharpest eyes. No lead escapes its gaze."]),
    inPal: pal4(["#1e1f24", "#e6c34a", "#4a4e57", "#a8b0ba"]), obType: "Dark", obLine: mkLine(["SHADLET", "NIGHTDRAKE", "ECLIPSDRAKE"], ["Slips past gatekeepers unnoticed.", "Strikes from the shadows with a perfectly timed bump.", "Team Silver's outbound specialist. Its sequences never miss."]),
    obPal: pal4(["#1a1b20", "#e6c34a", "#3c4048", "#9aa3ad"]) },
  "95288851": { cls: "Team Blue", type: "Water/Dragon", color: "#2f6fd6",
    line: mkLine(["DRIZZLET", "TIDEWYRM", "SKYLEVIATH"], ["Splashes into new trials before anyone else notices.", "Its cadence rises and falls like the tide.", "Said to calm even the stormiest prospect."]),
    inPal: pal4(["#14304f", "#f6efd6", "#2f6fd6", "#8fc4ff"]), obType: "Flying", obLine: mkLine(["BREEZLET", "GALEDRAKE", "STORMWING"], ["Scouts new accounts from high above.", "Rides the outbound winds from one territory to the next.", "Can multi-thread an entire org in a single flight."]),
    obPal: pal4(["#14304f", "#ffc04a", "#4a86e8", "#e8f2ff"]) },
  "102299028": { cls: "Team Yellow", type: "Electric", color: "#e0b400",
    line: mkLine(["ZAPPIP", "VOLTWICK", "THUNDRAKE"], ["Buzzes with first-quarter energy.", "Its glow lights up the darkest backlog.", "Strikes the same account twice: once by email, once by phone."]),
    inPal: pal4(["#3a2e05", "#7ae7ff", "#f2a900", "#ffe14a"]), obType: "Electric", obLine: mkLine(["ZAPLING", "AMPDRAKE", "TESLADRAKE"], ["Fizzes with energy on every cold call.", "Its dials crackle with momentum.", "Powers through a full call block without slowing down."]),
    obPal: pal4(["#3a2e05", "#ff8a1f", "#f2a900", "#ffe14a"]) },
  "96069408": { cls: "Team Purple", type: "Psychic", color: "#8a55d0",
    line: mkLine(["LILMYST", "VIOLOOM", "AMETHORA"], ["Senses a hand-raiser before the form is submitted.", "Its petals pick up hidden buying signals.", "Reads every account like a crystal ball."]),
    inPal: pal4(["#2c1840", "#ffb8e6", "#7b4bc4", "#c8a6f2"]), obType: "Psychic", obLine: mkLine(["MUSELET", "MYSTDRAKE", "ASTRALDRAKE"], ["Somehow knows who will reply before they do.", "Its stare finds the champion in any org chart.", "Sees the whole buying committee at once."]),
    obPal: pal4(["#2c1840", "#ff7ad0", "#7b4bc4", "#d8c2f6"]) },
};
const trainerOf = (bdr: string) => TRAINERS[bdr] ?? { cls: "BDR Trainer", type: "Normal", obType: "Normal", color: "#3878c8" };
const lineFor = (bdr: string, ob: boolean): CLine => (TRAINERS[bdr] ? (ob ? TRAINERS[bdr].obLine : TRAINERS[bdr].line) : ob ? OB_SPECIES : SPECIES);
const palOf = (bdr: string, ob: boolean, shiny: boolean) => {
  if (shiny) return SHINY;
  if (!UI.game) return GB;
  const t = TRAINERS[bdr];
  return t ? (ob ? t.obPal : t.inPal) : ob ? CREATURE_PALS.out : CREATURE_PALS.in;
};
// swap every creature to the team's sprite-sheet art (top row = inbound, bottom row = outbound)
const ART_OWNER: Record<string, string> = { "89400804": "Rebecca", "95288851": "Priscilla", "95672339": "Lauren", "96069408": "Isabel", "102299028": "Divya" };
Object.entries(ART_OWNER).forEach(([id, nm]) => {
  const t = TRAINERS[id];
  if (!t) return;
  t.line.forEach((s, i) => { s.map = ART(`${nm}_in_${i + 1}`); });
  t.obLine.forEach((s, i) => { s.map = ART(`${nm}_out_${i + 1}`); });
});
SPECIES.forEach((s: any, i: number) => { s.map = ART(`Default_in_${i + 1}`); });
OB_SPECIES.forEach((s: any, i: number) => { s.map = ART(`Default_out_${i + 1}`); });

function obGameSql(bdr: string, qs: string, qe: string) {
  return `WITH params AS (SELECT '${bdr}' AS bdr, DATE '${qs}' AS qs, DATE '${qe}' AS qe),
roster AS (SELECT unnest(['80047418','83119213','87409788','88175764','80568243','89400805','89400804','94189105','95288851','95672339','96069408','102299028']) AS id),
sqa_base AS (
  SELECT d.hs_object_id::VARCHAR AS deal_id,
    TRY_CAST(d.first_date_qualified AS DATE) AS qd,
    CASE
      WHEN d.bdr_owner IN (SELECT id FROM roster) THEN d.bdr_owner
      WHEN COALESCE(d.deal_source_type,'') = 'Outbound' AND TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01'
        AND CAST(d.hs_created_by_user_id AS VARCHAR) IN (SELECT id FROM roster) THEN CAST(d.hs_created_by_user_id AS VARCHAR)
    END AS credited,
    (SELECT MIN(CAST(dca.company_id AS VARCHAR)) FROM "mdw"."hubspot"."deal_to_company_associations" dca
      WHERE CAST(dca.deal_id AS VARCHAR) = d.hs_object_id::VARCHAR) AS company_id
  FROM "mdw"."hubspot"."deals" d, params p
  WHERE d.first_date_qualified IS NOT NULL
    AND COALESCE(d.deal_source_type,'') = 'Outbound'
    AND TRY_CAST(d.first_date_qualified AS DATE) BETWEEN p.qs AND p.qe
    AND (
      (TRY_CAST(d.first_date_qualified AS DATE) < DATE '2026-08-01' AND COALESCE(d.tags_stamped_at_deal_qualification,'') <> 'Growth Account')
      OR (TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01' AND (
            COALESCE(d.segment_stamped_at_deal_qualification,'') IN ('SMB','MM','ENT')
            OR (COALESCE(d.segment_stamped_at_deal_qualification,'') = 'Micro'
                AND lower(COALESCE(TRY_CAST(d.is_focused_stamped_at_deal_qualification AS VARCHAR),'')) = 'true')))
    )
    AND TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01'
    AND (d.bdr_owner IN (SELECT id FROM roster) OR CAST(d.hs_created_by_user_id AS VARCHAR) IN (SELECT id FROM roster))
    AND (d.pipeline = 'default' OR COALESCE(d.needs_intro_meeting,'') = 'Yes')
    AND COALESCE(d.dealtype,'') <> 'existingbusiness'
),
sqa AS (
  SELECT deal_id, qd FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY COALESCE(company_id, 'deal:' || deal_id) ORDER BY qd, deal_id) AS rn
    FROM sqa_base, params p WHERE credited = p.bdr
  ) WHERE rn = 1
),
mtg AS (
  SELECT TRY_CAST(d.createdate AS DATE) AS dd FROM "mdw"."hubspot"."deals" d, params p
  WHERE (d.bdr_owner = p.bdr OR (d.bdr_owner IS NULL AND CAST(d.hs_created_by_user_id AS VARCHAR) = p.bdr))
    AND COALESCE(d.deal_source_type,'') = 'Outbound'
    AND TRY_CAST(d.createdate AS DATE) BETWEEN p.qs AND p.qe
    AND (d.pipeline = 'default' OR (d.pipeline = '690099850' AND d.needs_intro_meeting = 'Yes'))
),
apollo AS (
  SELECT ct.hs_object_id AS contact_id, lower(trim(ct.email)) AS addr, COALESCE(NULLIF(ct.associatedcompanyid,''), 'nc:' || ct.hs_object_id) AS company_id
  FROM "mdw"."hubspot"."contacts" ct, params p
  WHERE ct.hubspot_owner_id = p.bdr AND (ct.contact_source_label = 'Apollo' OR ct.hs_object_source_detail_1 = 'Apollo Integration')
),
em_all AS (
  SELECT a.contact_id, a.company_id, TRY_CAST(e.hs_timestamp AS DATE) AS dd
  FROM (
    SELECT hs_timestamp, unnest(regexp_extract_all(lower(hs_email_to_email), '[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}')) AS addr
    FROM "mdw"."hubspot"."emails", params p
    WHERE hubspot_owner_id = p.bdr AND hs_email_direction = 'EMAIL' AND TRY_CAST(hs_timestamp AS DATE) <= p.qe
  ) e JOIN apollo a ON a.addr = e.addr
),
cl_all AS (
  SELECT a.contact_id, a.company_id, TRY_CAST(c.hs_timestamp AS DATE) AS dd,
    c.call_disposition_label IN ('Connected', 'Interested: follow up', 'Not interested', 'Booked AE meeting', 'Bad fit', 'Intro not made') AS conn
  FROM "mdw"."hubspot"."calls" c
  JOIN "mdw"."hubspot"."call_to_contact_associations" cca ON cca.call_id = c.call_id
  JOIN apollo a ON a.contact_id = cca.contact_id::VARCHAR, params p
  WHERE c.hubspot_owner_id = p.bdr AND TRY_CAST(c.hs_timestamp AS DATE) <= p.qe
),
li_all AS (
  SELECT a.contact_id, a.company_id, CAST(t.event_ts AS DATE) AS dd
  FROM "bdr_terminal_gamified"."main"."touch_events" t JOIN apollo a ON a.contact_id = t.contact_id::VARCHAR, params p
  WHERE t.actor_bdr_id = p.bdr AND t.event_type LIKE 'linkedin_%' AND CAST(t.event_ts AS DATE) <= p.qe
),
touch_all AS (
  SELECT contact_id, company_id, dd FROM em_all UNION ALL SELECT contact_id, company_id, dd FROM cl_all UNION ALL SELECT contact_id, company_id, dd FROM li_all
),
first_touch AS (SELECT contact_id, any_value(company_id) AS company_id, MIN(dd) AS ft FROM touch_all GROUP BY 1),
acct_rank AS (SELECT company_id, ft, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY ft, contact_id) AS n FROM first_touch),
acct_open AS (SELECT ft AS dd FROM acct_rank, params p WHERE n = 1 AND ft BETWEEN p.qs AND p.qe AND company_id NOT LIKE 'nc:%'),
acct_multi AS (SELECT ft AS dd FROM acct_rank, params p WHERE n = 3 AND ft BETWEEN p.qs AND p.qe AND company_id NOT LIKE 'nc:%'),
em AS (SELECT dd, COUNT(*) AS n FROM em_all, params p WHERE dd BETWEEN p.qs AND p.qe GROUP BY 1),
cl AS (SELECT dd, COUNT(*) AS n, COUNT(*) FILTER (WHERE conn) AS conn FROM cl_all, params p WHERE dd BETWEEN p.qs AND p.qe GROUP BY 1),
li AS (SELECT dd, COUNT(*) AS n FROM li_all, params p WHERE dd BETWEEN p.qs AND p.qe GROUP BY 1),
hyg AS (
  SELECT CAST(t.event_ts AS DATE) AS dd, COUNT(*) AS n FROM "bdr_terminal_gamified"."main"."touch_events" t, params p
  WHERE t.actor_bdr_id = p.bdr AND CAST(t.event_ts AS DATE) BETWEEN p.qs AND p.qe
    AND (t.event_type = 'ae_assign' OR (t.event_type IN ('reviewed','retouch_set','retouch_clear','note') AND t.contact_id::VARCHAR IN (SELECT contact_id FROM apollo)))
  GROUP BY 1
)
SELECT
  (SELECT COUNT(*) FROM sqa) AS sqas, (SELECT COUNT(*) FROM sqa WHERE qd = current_date) AS sqas_today,
  (SELECT COUNT(*) FROM mtg) AS meetings, (SELECT COUNT(*) FROM mtg WHERE dd = current_date) AS meetings_today,
  (SELECT COALESCE(SUM(n),0) FROM em) AS emails, (SELECT COALESCE(SUM(LEAST(n,60)),0) FROM em) AS emails_capped, (SELECT COALESCE(SUM(n),0) FROM em WHERE dd = current_date) AS emails_today,
  (SELECT COALESCE(SUM(n),0) FROM cl) AS calls, (SELECT COALESCE(SUM(LEAST(n,60)),0) FROM cl) AS calls_capped, (SELECT COALESCE(SUM(conn),0) FROM cl) AS connects,
  (SELECT COALESCE(SUM(n),0) FROM cl WHERE dd = current_date) AS calls_today, (SELECT COALESCE(SUM(conn),0) FROM cl WHERE dd = current_date) AS connects_today,
  (SELECT COALESCE(SUM(n),0) FROM li) AS linkedin, (SELECT COALESCE(SUM(LEAST(n,30)),0) FROM li) AS linkedin_capped, (SELECT COALESCE(SUM(n),0) FROM li WHERE dd = current_date) AS linkedin_today,
  (SELECT COUNT(*) FROM acct_open) AS accts_opened, (SELECT COUNT(*) FROM acct_open WHERE dd = current_date) AS accts_opened_today,
  (SELECT COUNT(*) FROM acct_multi) AS accts_multi, (SELECT COUNT(*) FROM acct_multi WHERE dd = current_date) AS accts_multi_today,
  (SELECT COALESCE(SUM(n),0) FROM hyg) AS hygiene, (SELECT COALESCE(SUM(LEAST(n,40)),0) FROM hyg) AS hygiene_capped, (SELECT COALESCE(SUM(n),0) FROM hyg WHERE dd = current_date) AS hygiene_today
`;
}

function TrainerTab({ defaultTrainer }: { defaultTrainer: string }) {
  const [trainer, setTrainer] = useDiveState<string>("trainer", defaultTrainer);
  const [qid, setQid] = useDiveState<string>("quarter", "FQ4-2026");
  const tid = /^\d+$/.test(trainer) ? trainer : defaultTrainer;
  const qtr = QUARTERS.find((q) => q.id === qid) ?? QUARTERS[0];
  const qq = useSQLQuery(quotaSql);
  const quotaRow = (Array.isArray(qq.data) ? qq.data : []).find((x: any) => S(x.quarter_id) === qtr.id && S(x.bdr_id) === tid);
  const totalQuota = quotaRow ? N(quotaRow.sqa_quota) : DEFAULT_QUOTA;
  const obTarget = quotaRow && quotaRow.ob_sqa_target != null ? N(quotaRow.ob_sqa_target) : DEFAULT_OB_TARGET;
  const tr = trainerOf(tid);
  return (
    <div style={{ fontFamily: UI.body }}>
      <div style={{ ...PANEL(), display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", marginBottom: 12, borderLeft: `6px solid ${tr.color}` }}>
        <Sprite map={lineFor(tid, false)[0].map} pal={palOf(tid, false, false)} scale={3} />
        <Sprite map={lineFor(tid, true)[0].map} pal={palOf(tid, true, false)} scale={3} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fs(11), color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{tr.cls}</div>
          <div style={{ fontSize: fs(19), fontWeight: 700 }}>{bdrName(tid)}</div>
          <div style={{ fontSize: fs(11), color: C.muted }}>Inbound: {tr.type} · {lineFor(tid, false).map((s) => s.name).join(" → ")}</div>
          <div style={{ fontSize: fs(11), color: C.muted }}>Outbound: {tr.obType} · {lineFor(tid, true).map((s) => s.name).join(" → ")}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: fs(10.5), color: C.faint }}>
          Trainer
          <select value={tid} onChange={(e) => setTrainer(e.target.value)} style={{ ...ctl, cursor: "pointer", color: C.accent }}>
            {BDRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: fs(10.5), color: C.faint }}>
          Quarter
          <select value={qtr.id} onChange={(e) => setQid(e.target.value)} style={{ ...ctl, cursor: "pointer" }}>
            {QUARTERS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: fs(10.5), color: C.faint }}>
          Total quota {totalQuota}{quotaRow ? "" : " (default)"} = inbound {Math.max(0, totalQuota - obTarget)} + outbound {obTarget}{quotaRow?.ob_sqa_target == null ? " (default split)" : ""} · &gt;100% unlocks at {obTarget} outbound · BDR Terminal SQA rules
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 14 }}>
        <CreaturePanel tid={tid} qtr={qtr} ob={false} quota={Math.max(1, totalQuota - obTarget)} />
        <CreaturePanel tid={tid} qtr={qtr} ob quota={Math.max(1, obTarget)} />
      </div>
    </div>
  );
}

function CreaturePanel({ tid, qtr, ob, quota }: { tid: string; qtr: any; ob: boolean; quota: number }) {
  const { g, r, x } = useTrainingXp(tid, ob, qtr);

  const sqas = N(r.sqas), meetings = N(r.meetings), connects = N(r.connects);
  const callsC = N(r.calls_capped), emailsC = N(r.emails_capped), liC = N(r.linkedin_capped), hygC = N(r.hygiene_capped);
  const parts = [
    { k: "SQAs", n: sqas, w: XP.sqa },
    { k: "Meetings booked", n: meetings, w: XP.meeting },
    { k: "Connected calls", n: connects, w: XP.connect },
    { k: "Dials (capped)", n: callsC, w: XP.call },
    { k: "Emails (capped)", n: emailsC, w: XP.email },
    { k: "LinkedIn (capped)", n: liC, w: XP.linkedin },
    { k: ob ? "Hygiene + AE assigns (capped)" : "Queue hygiene (capped)", n: hygC, w: XP.hygiene },
    ...(ob ? [{ k: "Accounts opened", n: N(r.accts_opened), w: XP.acctOpen }, { k: "Accounts multi-threaded (3+)", n: N(r.accts_multi), w: XP.acctMulti }] : []),
  ];
  const { xp, lv, lvFloor, lvNext, todayXp } = x;
  const t1 = Math.ceil(quota / 3), t2 = Math.ceil((quota * 2) / 3);
  const stage = sqas >= t2 ? 2 : sqas >= t1 ? 1 : 0;
  const shiny = sqas >= quota;
  const LINE = lineFor(tid, ob);
  const sp = LINE[stage];
  const pal = palOf(tid, ob, shiny);
  const statExp = {
    hp: meetings * 1500, atk: callsC * 15 + connects * 800, def: hygC * 400 + (ob ? N(r.accts_multi) * 2000 : 0), spd: liC * 500, spc: emailsC * 12 + (ob ? N(r.accts_opened) * 40 : 0),
  };
  const stats = [
    { k: "HP", v: gen1Stat(sp.base.hp, statExp.hp, lv, true), src: "meetings booked" },
    { k: "ATTACK", v: gen1Stat(sp.base.atk, statExp.atk, lv), src: "dials + connects" },
    { k: "DEFENSE", v: gen1Stat(sp.base.def, statExp.def, lv), src: ob ? "multi-threading + AE assigns" : "reviewed / retouch / notes" },
    { k: "SPEED", v: gen1Stat(sp.base.spd, statExp.spd, lv), src: "LinkedIn touches" },
    { k: "SPECIAL", v: gen1Stat(sp.base.spc, statExp.spc, lv), src: "emails sent" },
  ];
  const MV = ob ? OB_MOVES : MOVES;
  const learned = MV.filter((m) => m.lv <= lv);
  const current4 = learned.slice(-4);
  const nextMove = MV.find((m) => m.lv > lv);
  const nextEvo = stage === 0 ? t1 : stage === 1 ? t2 : quota;
  const loading = g.isLoading;
  const px: any = { fontFamily: UI.body, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={px}>
      <div style={{ fontSize: fs(11), color: C.accent, letterSpacing: 1, marginBottom: 6, textTransform: "none" }}>
        {ob ? "◎ OUTBOUND" : "◓ INBOUND"} · target {quota} SQAs <span style={{ color: C.faint }}>· {ob ? "Apollo contacts + Outbound-source deals" : "everything except Apollo contacts + Outbound-source deals"}</span>
      </div>
      {g.isError ? <div style={{ color: C.danger, fontSize: fs(12), textTransform: "none" }}>{String(g.error)}</div> : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <GbBox style={{ minHeight: 330, position: "relative" }}>
          {loading ? <div style={{ height: 300 }} className="animate-pulse" /> : (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...(UI.game ? BATTLE_BG : {}) }}>
              <div style={{ width: "55%", ...(UI.game ? NAMEPLATE : {}) }}>
                <div style={{ fontSize: UI.game ? fs(17) : 15, fontWeight: 700, fontFamily: UI.pixel }}>{sp.name}{shiny ? " ✦" : ""}</div>
                <div style={{ fontSize: fs(12), margin: "2px 0 6px" }}>:L{lv}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(10) }}>
                  <b style={UI.game ? { background: "#e8b830", padding: "0 5px", borderRadius: 3, border: "1px solid #484848" } : {}}>SQA</b><div style={{ flex: 1 }}><Bar pct={(sqas / quota) * 100} color={sqas / quota >= 0.66 ? (UI.game ? "#48c050" : GB.d1) : sqas / quota >= 0.33 ? (UI.game ? "#f0c030" : "#c8a000") : (UI.game ? "#f05030" : "#b03a2e")} bg={UI.game ? "#f2f2f2" : GB.d2} /></div>
                </div>
                <div style={{ fontSize: fs(11), textAlign: "right", marginTop: 2 }}>{sqas}/ {quota}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fs(10), marginTop: 6 }}>
                  <b style={UI.game ? { background: "#e8b830", padding: "0 5px", borderRadius: 3, border: "1px solid #484848" } : {}}>EXP</b><div style={{ flex: 1 }}>{UI.game ? <ExpBar x={x} h={9} /> : <Bar pct={((xp - lvFloor) / (lvNext - lvFloor)) * 100} color="#3a6ea5" bg={GB.d2} />}</div>
                </div>
                <div style={{ fontSize: fs(9.5), textAlign: "right", marginTop: 2 }}>{Math.round(lvNext - xp).toLocaleString()} TO :L{lv + 1}</div>
              </div>
              <div style={UI.game ? STAGE(shiny) : { background: pal === SHINY ? "#fff4cf" : GB.d3, borderRadius: UI.radius2, padding: 4 }}>
                <Sprite map={sp.map} pal={pal} scale={8} flip />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              {LINE.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ opacity: i <= stage ? 1 : 0.35, textAlign: "center" }}>
                    <Sprite map={s.map} pal={palOf(tid, ob, i === 2 && shiny)} scale={2.5} />
                    <div style={{ fontSize: fs(8.5) }}>{i === 0 ? "0" : i === 1 ? t1 : t2} SQA</div>
                  </div>
                  {i < 2 && <span style={{ fontSize: fs(12) }}>▶</span>}
                </div>
              ))}
              <span style={{ fontSize: fs(12) }}>▶</span>
              <div style={{ opacity: shiny ? 1 : 0.35, fontSize: fs(9), textAlign: "center" }}>✦ SHINY<br />{quota} SQA</div>
            </div>

            <div style={{ fontSize: fs(11), color: C.muted, marginTop: 10, textTransform: "none", fontStyle: "italic" }}>"{sp.flavor}"</div>
            <div style={UI.game ? { ...DIALOG(), marginTop: 12, textTransform: "none" } : { marginTop: 12, background: "#f8f8f0", border: `3px double ${GB.d0}`, padding: "8px 10px", fontSize: 11, lineHeight: 1.6 }}>
              {todayXp > 0 ? <>{sp.name} GAINED {todayXp.toLocaleString()} EXP. POINTS TODAY!</> : <>{sp.name} IS WAITING FOR YOUR FIRST MOVE TODAY…</>}
              <br />
              {shiny ? (ob ? "OUTBOUND TARGET MET. OVERATTAINMENT UNLOCKED!" : "QUOTA CLEARED. IT SHINES!") : `${Math.max(0, nextEvo - sqas)} MORE SQA${nextEvo - sqas === 1 ? "" : "S"} UNTIL ${stage < 2 ? "IT EVOLVES" : "IT TURNS SHINY"}${ob ? " (AND OVERATTAINMENT UNLOCKS)" : ""}.`}
              {nextMove ? <><br />NEXT MOVE: {nextMove.name} AT :L{nextMove.lv}.</> : null}
            </div>
          </>)}
        </GbBox>

        {UI.game && !loading && <TodayLedger x={x} ob={ob} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <GbBox>
            <div style={{ fontSize: fs(11), fontWeight: 800, marginBottom: 6 }}>STATS</div>
            {stats.map((s) => (
              <div key={s.k} style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), padding: "2px 0" }}>
                <span>{s.k}<span style={{ fontSize: fs(8.5), opacity: 0.7, textTransform: "none" }}> · {s.src}</span></span>
                <b>{loading ? "…" : s.v}</b>
              </div>
            ))}
          </GbBox>
          <GbBox>
            <div style={{ fontSize: fs(11), fontWeight: 800, marginBottom: 6 }}>MOVES</div>
            {loading ? [0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), padding: "2px 0", opacity: 0.4 }}>
                <span>- - - -</span><span style={{ fontSize: fs(9) }}>???</span>
              </div>
            )) : current4.map((m) => (
              <div key={m.name} style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), padding: "2px 0" }}>
                <span>{m.name}</span><span style={{ fontSize: fs(9) }}>{m.type}</span>
              </div>
            ))}
            <div style={{ fontSize: fs(9), marginTop: 6, textTransform: "none" }}>
              {loading ? "Loading moves…" : `${learned.length} of ${MV.length} learned${nextMove ? ` · next: ${nextMove.name} at Lv ${nextMove.lv}` : " · move set complete"}`}
            </div>
          </GbBox>
          <div style={{ gridColumn: "1 / -1", ...PANEL(), padding: 10, textTransform: "none" }}>
            <div style={{ fontSize: fs(10), letterSpacing: 1, color: C.accent, marginBottom: 6 }}>// EXP LEDGER · {qtr.label}</div>
            {parts.map((p) => (
              <div key={p.k} style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), color: C.muted, padding: "1px 0" }}>
                <span>{p.k} <span style={{ color: C.faint }}>× {p.w}</span></span>
                <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{loading ? "…" : `${p.n.toLocaleString()} → ${(p.n * p.w).toLocaleString()}`}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11.5), borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4 }}>
              <b>Total EXP</b><b style={{ color: C.accent }}>{loading ? "…" : Math.round(xp).toLocaleString()}</b>
            </div>
            <div style={{ fontSize: fs(9.5), color: C.faint, marginTop: 4 }}>Daily caps: {CAPS}. Raw: {N(r.emails).toLocaleString()} emails, {N(r.calls).toLocaleString()} dials.</div>
          </div>
        </div>
      </div>)}
    </div>
  );
}

// =====================================================================
// ======================  TRAINING (XP) WIDGETS  =======================
// =====================================================================
// Live XP for one creature: server numbers from the game SQL, plus clicks logged
// in this session that the ledger hasn't caught up on yet (the share lags ~1 min).
function useTrainingXp(bdr: string, ob: boolean, qtr: { start: string; end: string }) {
  const g = useSQLQuery(ob ? obGameSql(bdr, qtr.start, qtr.end) : gameSql(bdr, qtr.start, qtr.end));
  const r: any = (Array.isArray(g.data) ? g.data[0] : null) ?? {};
  const base = xpOf(r, ob);
  const [pend, setPend] = useState<{ kind: XpKind; xp: number; t: number }[]>([]);
  const seenToday = useRef(base.todayXp);
  const refetch = useRef(g.refetch);
  refetch.current = g.refetch;
  // once the server shows XP we were holding optimistically, drop those pending entries
  useEffect(() => {
    let gained = base.todayXp - seenToday.current;
    seenToday.current = base.todayXp;
    if (gained <= 0) return;
    setPend((p) => p.filter((it) => { if (gained >= it.xp) { gained -= it.xp; return false; } return true; }));
  }, [base.todayXp]);
  useEffect(() => {
    const onGain = (e: any) => {
      const d = e.detail || {};
      if (d.bdr !== bdr || !!d.ob !== ob) return;
      setPend((p) => [...p, { kind: d.kind, xp: d.xp, t: Date.now() }]);
    };
    const timers: any[] = [];
    const onSaved = (e: any) => {
      if (e.detail?.bdr !== bdr) return;
      [30000, 75000].forEach((ms) => timers.push(setTimeout(() => refetch.current(), ms)));
    };
    const expire = setInterval(() => setPend((p) => (p.length ? p.filter((it) => Date.now() - it.t < 180000) : p)), 20000);
    window.addEventListener("bdr-xp-gain", onGain);
    window.addEventListener("bdr-xp-saved", onSaved);
    return () => {
      window.removeEventListener("bdr-xp-gain", onGain);
      window.removeEventListener("bdr-xp-saved", onSaved);
      clearInterval(expire); timers.forEach(clearTimeout);
    };
  }, [bdr, ob]);
  let x: XpInfo = base;
  if (pend.length) {
    const today = { ...base.today };
    let add = 0;
    pend.forEach((it) => { today[it.kind] += it.xp; add += it.xp; });
    x = finishXp(base.xp + add, today, base.todayCounts);
  }
  return { g, r, x, pendingN: pend.length };
}

// EXP bar for the current level: slate = earned before today, colors = today's XP by kind
function ExpBar({ x, h = 10 }: { x: XpInfo; h?: number }) {
  const span = Math.max(1, x.lvNext - x.lvFloor);
  const inLevel = Math.max(0, x.xp - x.lvFloor);
  const todayInLevel = Math.min(x.todayXp, inLevel); // leveled up today → the whole bar is today's work
  const k = x.todayXp > 0 ? todayInLevel / x.todayXp : 0;
  const tip = XP_KINDS.filter((m) => x.today[m.k] > 0).map((m) => `${m.label} +${x.today[m.k].toLocaleString()}`).join(" · ");
  return (
    <div title={tip ? `Today: ${tip}` : "No EXP yet today"} style={{ height: h, background: "#ececec", border: "2px solid #484848", borderRadius: 3, display: "flex", overflow: "hidden" }}>
      <div style={{ width: `${((inLevel - todayInLevel) / span) * 100}%`, background: XP_BASE_COLOR, transition: "width .6s ease" }} />
      {XP_KINDS.map((m) => {
        const v = x.today[m.k] * k;
        return v > 0 ? <div key={m.k} style={{ width: `${(v / span) * 100}%`, background: m.color, boxShadow: "inset 0 -2px 0 rgba(0,0,0,.2)", transition: "width .6s ease" }} /> : null;
      })}
    </div>
  );
}

function XpLegend({ x, size = 10 }: { x: XpInfo; size?: number }) {
  const on = XP_KINDS.filter((m) => x.today[m.k] > 0);
  if (!on.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: fs(size) }}>
      {on.map((m) => (
        <span key={m.k} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#484848" }}>
          <span style={{ width: 8, height: 8, background: m.color, border: "1px solid #484848", display: "inline-block" }} />
          {m.label} <b style={{ color: m.color }}>+{x.today[m.k].toLocaleString()}</b>
        </span>
      ))}
    </div>
  );
}

// Daily totals on the Trainer tab
function TodayLedger({ x, ob }: { x: XpInfo; ob: boolean }) {
  const c = x.todayCounts;
  const rows: { k: XpKind; detail: string }[] = [
    { k: "sqa", detail: `${c.sqas} SQA${c.sqas === 1 ? "" : "s"}` },
    { k: "meeting", detail: `${c.meetings} meeting${c.meetings === 1 ? "" : "s"} booked` },
    { k: "calls", detail: `${c.calls} dial${c.calls === 1 ? "" : "s"} · ${c.connects} connect${c.connects === 1 ? "" : "s"}` },
    { k: "emails", detail: `${c.emails} email${c.emails === 1 ? "" : "s"} sent` },
    { k: "linkedin", detail: `${c.linkedin} touch${c.linkedin === 1 ? "" : "es"}` },
    { k: "queue", detail: `${c.queue} reviewed / retouch / notes${ob ? " / AE assigns" : ""}` },
    ...(ob ? [{ k: "accounts" as XpKind, detail: `${c.opened} opened · ${c.multi} multi-threaded` }] : []),
  ];
  const tot = Math.max(1, x.todayXp);
  return (
    <div style={{ ...PANEL(), padding: 10, textTransform: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: fs(10), letterSpacing: 1, color: C.accent }}>// TODAY'S TRAINING</span>
        <b style={{ fontSize: fs(13), color: x.todayXp ? C.text : C.faint }}>+{x.todayXp.toLocaleString()} EXP</b>
      </div>
      <div style={{ height: 12, display: "flex", border: "2px solid #484848", borderRadius: 3, overflow: "hidden", background: "#ececec", marginBottom: 8 }}>
        {XP_KINDS.map((m) => (x.today[m.k] > 0
          ? <div key={m.k} title={`${m.label} +${x.today[m.k]}`} style={{ width: `${(x.today[m.k] / tot) * 100}%`, background: m.color, transition: "width .6s ease" }} />
          : null))}
      </div>
      {rows.map((row) => {
        const m = XP_KINDS.find((z) => z.k === row.k)!;
        const v = x.today[row.k];
        return (
          <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: fs(11), padding: "2px 0", opacity: v ? 1 : 0.45 }}>
            <span style={{ width: 10, height: 10, background: m.color, border: "1px solid #484848", flexShrink: 0 }} />
            <span style={{ width: 92, flexShrink: 0, color: C.text }}>{m.label}</span>
            <span style={{ flex: 1, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.detail}</span>
            <b style={{ color: v ? m.color : C.faint, fontVariantNumeric: "tabular-nums" }}>+{v.toLocaleString()}</b>
          </div>
        );
      })}
      <div style={{ fontSize: fs(9.5), color: C.faint, marginTop: 4 }}>Today = calendar day (UTC). Calls, emails and meetings sync from HubSpot ~every 4h; LinkedIn + reviews show up as you log them.</div>
    </div>
  );
}

// One creature in the header: sprite on its grass pad, level, EXP bar, today's gains
function ShowcaseCard({ bdr, ob, qtr, quota }: { bdr: string; ob: boolean; qtr: any; quota: number }) {
  const { g, r, x } = useTrainingXp(bdr, ob, qtr);
  const sqas = N(r.sqas);
  const q = Math.max(1, quota);
  const t1 = Math.ceil(q / 3), t2 = Math.ceil((q * 2) / 3);
  const stage = sqas >= t2 ? 2 : sqas >= t1 ? 1 : 0;
  const shiny = sqas >= q;
  const sp = lineFor(bdr, ob)[stage];
  // "+EXP" pop-ups and a LEVEL UP flash when XP rises during the session
  const [floats, setFloats] = useState<{ id: number; amt: number; color: string }[]>([]);
  const [flash, setFlash] = useState(false);
  const prev = useRef<XpInfo | null>(null);
  const loaded = Array.isArray(g.data);
  useEffect(() => {
    if (!loaded) return; // first load is not a "gain"
    const p = prev.current;
    prev.current = x;
    if (!p || x.xp <= p.xp) return;
    let best: XpKind = "queue", bestD = 0;
    XP_KINDS.forEach((m) => { const d = x.today[m.k] - p.today[m.k]; if (d > bestD) { bestD = d; best = m.k; } });
    const id = Date.now() + Math.random();
    const color = XP_KINDS.find((m) => m.k === best)!.color;
    setFloats((f) => [...f, { id, amt: Math.round(x.xp - p.xp), color }]);
    setTimeout(() => setFloats((f) => f.filter((z) => z.id !== id)), 1700);
    if (x.lv > p.lv) { setFlash(true); setTimeout(() => setFlash(false), 2600); }
  }, [x.xp, loaded]);
  const lvUpsToday = x.lv - x.lvStart;
  return (
    <div style={{ ...PANEL(), flex: "1 1 330px", minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "6px 14px 6px 6px", position: "relative" }}>
      <div style={{ ...STAGE(shiny), padding: "2px 12px 16px", lineHeight: 0, position: "relative", animation: flash ? "bdrPop .5s steps(4) 3" : undefined }}>
        {loaded ? <Sprite map={sp.map} pal={palOf(bdr, ob, shiny)} scale={4.4} flip />
          : <div title="Loading your EXP…" style={{ filter: "brightness(0)", opacity: 0.18 }}><Sprite map={lineFor(bdr, ob)[0].map} pal={palOf(bdr, ob, false)} scale={4.4} flip /></div>}
        {floats.map((f) => (
          <span key={f.id} style={{ position: "absolute", left: "50%", top: 4, transform: "translateX(-50%)", fontSize: fs(13), fontWeight: 700, color: f.color, whiteSpace: "nowrap",
            textShadow: "1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff", animation: "bdrFloat 1.6s ease-out forwards", pointerEvents: "none", lineHeight: 1 }}>+{f.amt} EXP</span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: fs(9.5), letterSpacing: 1, color: C.accent }}>{ob ? "◎ OUTBOUND" : "◓ INBOUND"}</span>
          {flash ? <span style={{ fontSize: fs(11), fontWeight: 700, color: "#d84040", animation: "bdrBlink .4s steps(1) infinite" }}>LEVEL UP!</span>
            : lvUpsToday > 0 ? <span style={{ fontSize: fs(9.5), fontWeight: 700, color: "#3a9a4a" }}>▲ {lvUpsToday} LV TODAY</span> : null}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "1px 0 4px" }}>
          <b style={{ fontSize: fs(15), color: loaded ? "#303030" : C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loaded ? `${sp.name}${shiny ? " ✦" : ""}` : "???"}</b>
          <span style={{ fontSize: fs(12), color: loaded ? "#303030" : C.faint }}>:L{loaded ? x.lv : "??"}</span>
          <span style={{ fontSize: fs(9.5), color: C.faint, marginLeft: "auto", whiteSpace: "nowrap" }}>{loaded ? `${sqas}/${q} SQA` : "??/?? SQA"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <b style={{ fontSize: fs(9), background: "#e8b830", padding: "0 4px", borderRadius: 3, border: "1px solid #484848", color: "#303030" }}>EXP</b>
          <div style={{ flex: 1 }}>{loaded ? <ExpBar x={x} h={11} />
            : <div style={{ height: 11, border: "2px solid #b8b8b8", borderRadius: 3, background: "repeating-linear-gradient(45deg, #e4e4e4 0 6px, #f4f4f4 6px 12px)", backgroundSize: "24px 100%", animation: g.isError ? undefined : "bdrStripe .8s linear infinite" }} />}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: fs(9.5), color: C.muted, marginTop: 3 }}>
          <span>{loaded ? `${Math.max(0, Math.round(x.lvNext - x.xp)).toLocaleString()} to :L${x.lv + 1}` : "??? to next level"}</span>
          <b style={{ color: loaded && x.todayXp ? "#303030" : C.faint }}>{g.isError ? "EXP unavailable" : loaded ? `+${x.todayXp.toLocaleString()} today` : "+??? today"}</b>
        </div>
        <div style={{ marginTop: 3, minHeight: fs(12) }}>
          {g.isError ? <span style={{ fontSize: fs(9.5), color: C.danger }}>Couldn't load EXP right now. Your progress is safe; try refreshing.</span>
            : !loaded ? <span style={{ fontSize: fs(9.5), color: C.faint }}>Who's that creature? Counting up your EXP<span style={{ animation: "bdrBlink 1s steps(1) infinite" }}>…</span></span>
            : x.todayXp > 0 ? <XpLegend x={x} size={9} /> : <span style={{ fontSize: fs(9.5), color: C.faint }}>{sp.name} is waiting for your first move today…</span>}
        </div>
      </div>
    </div>
  );
}

// Header band on the Inbound / Outbound tabs: trainer nameplate + that tab's creature training live
// (the card wraps below the nameplate on narrow screens)
function TrainingShowcase({ bdr, ob }: { bdr: string; ob: boolean }) {
  const qtr = currentQuarter();
  const qq = useSQLQuery(quotaSql);
  const qf = quotaFor(Array.isArray(qq.data) ? qq.data : [], qtr.id, bdr);
  const tr = trainerOf(bdr);
  return (
    <div style={{ margin: "16px 18px 0", display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
      <div style={{ background: "#484848", clipPath: "polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)", padding: 3, borderRadius: "6px 0 0 6px", display: "flex" }}>
        <div style={{ background: "linear-gradient(180deg, #ffffff 0%, #e2e2e2 100%)", clipPath: "polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%)",
          padding: "8px 44px 8px 14px", display: "flex", flexDirection: "column", justifyContent: "center", borderRadius: "4px 0 0 4px", borderLeft: `6px solid ${tr.color}` }}>
          <div style={{ fontSize: fs(18), fontWeight: 700, color: "#303030" }}>{bdrName(bdr).split(" ")[0] || "Trainer"}</div>
          <div style={{ fontSize: fs(11), color: "#686868" }}>{tr.cls}</div>
          <div style={{ fontSize: fs(9.5), color: "#888888", marginTop: 2 }}>TRAINING · {qtr.label}</div>
        </div>
      </div>
      <ShowcaseCard key={ob ? "ob" : "in"} bdr={bdr} ob={ob} qtr={qtr} quota={ob ? qf.ob : qf.inb} />
    </div>
  );
}

// =====================================================================
// ===========================  LEAGUE  ================================
// =====================================================================
// View-only. Leaderboard + Hall of Fame reuse the exact Trainer SQL per BDR,
// so standings can never disagree with the Trainer tab. Nothing here gives XP.
function summarize(r: any, ob: boolean, quota: number) {
  const sqas = N(r.sqas), meetings = N(r.meetings);
  const x = xpOf(r, ob);
  const { xp, lv } = x;
  const q = Math.max(1, quota);
  const t1 = Math.ceil(q / 3), t2 = Math.ceil((q * 2) / 3);
  const stage = sqas >= t2 ? 2 : sqas >= t1 ? 1 : 0;
  return { sqas, meetings, xp, lv, stage, shiny: sqas >= q, quota: q, x };
}
type Summ = ReturnType<typeof summarize>;
const quotaFor = (rows: any[], qid: string, bdr: string) => {
  const row = rows.find((x: any) => S(x.quarter_id) === qid && S(x.bdr_id) === bdr);
  const total = row ? N(row.sqa_quota) : DEFAULT_QUOTA;
  const ob = row && row.ob_sqa_target != null ? N(row.ob_sqa_target) : DEFAULT_OB_TARGET;
  return { total, ob, inb: Math.max(1, total - ob), isDefault: !row, obDefault: !row || row.ob_sqa_target == null };
};
const elapsedFrac = (q: { start: string; end: string }) => {
  const s = Date.parse(q.start + "T00:00:00Z"), e = Date.parse(q.end + "T23:59:59Z");
  return Math.max(0.01, Math.min(1, (Date.now() - s) / (e - s)));
};
function useLeagueRow({ b, qtr, quotas, onData }: { b: { id: string; name: string }; qtr: any; quotas: any[]; onData: (id: string, v: any) => void }) {
  const qf = quotaFor(quotas, qtr.id, b.id);
  const gi = useSQLQuery(gameSql(b.id, qtr.start, qtr.end));
  const go = useSQLQuery(obGameSql(b.id, qtr.start, qtr.end));
  const ri: any = Array.isArray(gi.data) ? gi.data[0] : null;
  const ro: any = Array.isArray(go.data) ? go.data[0] : null;
  const si = ri ? summarize(ri, false, qf.inb) : null;
  const so = ro ? summarize(ro, true, qf.ob) : null;
  const total = (si?.sqas ?? 0) + (so?.sqas ?? 0);
  const raw = total / Math.max(1, qf.total);
  const gateOk = (so?.sqas ?? 0) >= qf.ob;
  const att = gateOk ? raw : Math.min(1, raw);
  const pace = att / elapsedFrac(qtr);
  useEffect(() => { if (si && so) onData(b.id, { att, total }); }, [si?.sqas, so?.sqas, qf.total, qf.ob]);
  return { b, qf, si, so, total, att, raw, gateOk, pace, err: gi.isError || go.isError } as any;
}

// One creature, centered on its grass pad, with level + today's XP under it
function LeagueMon({ s, ob, bdr, scale = 4.6, showToday = true }: { s: Summ | null; ob: boolean; bdr: string; scale?: number; showToday?: boolean }) {
  const box = Math.round(scale * 16);
  if (!s) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
        <div style={{ ...STAGE(false), padding: "2px 14px 18px", lineHeight: 0, filter: "brightness(0)", opacity: 0.16 }}>
          <Sprite map={lineFor(bdr, ob)[0].map} pal={palOf(bdr, ob, false)} scale={scale} />
        </div>
        <div style={{ fontSize: fs(10.5), fontWeight: 700, color: C.faint }}>???</div>
        <div style={{ fontSize: fs(9.5), color: C.faint }}>:L?? · ??/?? SQA</div>
      </div>
    );
  }
  const sp = lineFor(bdr, ob)[s.stage];
  return (
    <div title={`${sp.name} Lv ${s.lv}${s.shiny ? " ✦ shiny" : ""}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0, width: "100%" }}>
      <div style={{ fontSize: fs(9), letterSpacing: 1, color: C.accent }}>{ob ? "◎ OUTBOUND" : "◓ INBOUND"}</div>
      <div style={{ ...STAGE(s.shiny), padding: "2px 14px 18px", lineHeight: 0, minHeight: box, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <Sprite map={sp.map} pal={palOf(bdr, ob, s.shiny)} scale={scale} />
      </div>
      <div style={{ fontSize: fs(11), fontWeight: 700, color: "#303030", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.name}{s.shiny ? " ✦" : ""}</div>
      <div style={{ fontSize: fs(9.5), color: C.muted }}>:L{s.lv} · {s.sqas}/{s.quota} SQA</div>
      {showToday && (
        <div style={{ width: "100%", maxWidth: 170, marginTop: 3 }}>
          <ExpBar x={s.x} h={8} />
          <div style={{ fontSize: fs(9.5), textAlign: "center", marginTop: 2, color: s.x.todayXp ? "#303030" : C.faint, fontWeight: s.x.todayXp ? 700 : 400 }}>+{s.x.todayXp.toLocaleString()} EXP today</div>
        </div>
      )}
    </div>
  );
}

// Today's XP split by type, for both creatures combined
function TodayStrip({ si, so }: { si: Summ | null; so: Summ | null }) {
  if (!si || !so) return <div style={{ height: 10, border: "2px solid #b8b8b8", borderRadius: 3, background: "repeating-linear-gradient(45deg, #e4e4e4 0 6px, #f4f4f4 6px 12px)", backgroundSize: "24px 100%", animation: "bdrStripe .8s linear infinite" }} />;
  const today = emptyToday();
  XP_KINDS.forEach((m) => { today[m.k] = si.x.today[m.k] + so.x.today[m.k]; });
  const tot = si.x.todayXp + so.x.todayXp;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: fs(9.5), letterSpacing: 1, color: C.accent }}>TODAY</span>
        <b style={{ fontSize: fs(12), color: tot ? "#303030" : C.faint }}>+{tot.toLocaleString()} EXP</b>
      </div>
      <div style={{ height: 10, display: "flex", border: "2px solid #484848", borderRadius: 3, overflow: "hidden", background: "#ececec" }}>
        {XP_KINDS.map((m) => (today[m.k] > 0 ? <div key={m.k} title={`${m.label} +${today[m.k]}`} style={{ width: `${(today[m.k] / Math.max(1, tot)) * 100}%`, background: m.color }} /> : null))}
      </div>
      <div style={{ marginTop: 4, minHeight: fs(11) }}>
        {tot ? <XpLegend x={{ ...si.x, today, todayXp: tot }} size={9} /> : <span style={{ fontSize: fs(9.5), color: C.faint }}>No EXP logged yet today</span>}
      </div>
    </div>
  );
}

function LeaderboardCard({ b, qtr, quotas, rank, onData }: any) {
  const v = useLeagueRow({ b, qtr, quotas, onData });
  const { qf, si, so, total, att, raw, gateOk, pace } = v;
  const loading = !si || !so;
  const tr = trainerOf(b.id);
  const paceCol = pace >= 1 ? C.ok : pace >= 0.85 ? C.warn : C.danger;
  const live = qtr.end >= todayStr();
  const medal = rank === 1 ? "#e0b030" : rank === 2 ? "#a8b0ba" : rank === 3 ? "#c87840" : "#d0d0d0";
  return (
    <div style={{ ...PANEL(), padding: 12, borderTop: `6px solid ${tr.color}`, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: loading ? "#eee" : medal, border: "2px solid #484848", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: fs(14), fontWeight: 800, color: "#303030", flexShrink: 0 }}>{loading ? "·" : rank}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: fs(14), fontWeight: 800, color: "#303030", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
          <div style={{ fontSize: fs(10), color: C.muted }}>{tr.cls}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: fs(16), fontWeight: 800, color: att >= 1 ? "#c89a10" : "#303030" }} title={raw > att ? `Uncapped ${Math.round(raw * 100)}%` : ""}>{loading ? "…" : `${Math.round(att * 100)}%${raw > att ? "*" : ""}`}</div>
          <div style={{ fontSize: fs(9.5), color: loading ? C.faint : paceCol }} title="Attainment ÷ share of the quarter elapsed">{loading ? "" : `${Math.round(pace * 100)}% pace`}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "linear-gradient(180deg, #ffffff 0%, #f0f0f0 60%, #e2e2e2 100%)", border: "2px solid #d0d0d0", borderRadius: 6, padding: "8px 4px" }}>
        <LeagueMon s={si} ob={false} bdr={b.id} showToday={live} />
        <LeagueMon s={so} ob bdr={b.id} showToday={live} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), marginBottom: 3 }}>
          <span><b>{loading ? "…" : total}</b> / {qf.total} SQAs{qf.isDefault ? <span style={{ color: C.faint }}> (default quota)</span> : ""}</span>
          <span style={{ color: C.muted }}>{loading ? "" : `${si.meetings + so.meetings} mtgs`}</span>
        </div>
        <div style={{ height: 8, background: "#ececec", border: "2px solid #484848", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, att * 100)}%`, height: "100%", background: att >= 1 ? "#e0b030" : "#48c050", transition: "width .6s ease" }} />
        </div>
        {!loading && (
          <div style={{ fontSize: fs(9.5), marginTop: 3, color: gateOk ? C.ok : raw >= 1 ? C.danger : C.faint }}>
            {gateOk ? (raw > 1 ? "✓ OB gate met · overattainment unlocked" : "✓ OB gate met") : `🔒 ${qf.ob - so.sqas} more outbound to unlock >100%${raw > 1 ? ` (capped, uncapped ${Math.round(raw * 100)}%)` : ""}`}
          </div>
        )}
      </div>

      {live && <TodayStrip si={si} so={so} />}
      {v.err && <div style={{ fontSize: fs(10), color: C.danger }}>Couldn't load this trainer's numbers.</div>}
    </div>
  );
}

function HofCard({ bdr, qtr, quotas }: { bdr: string; qtr: any; quotas: any[] }) {
  const qf = quotaFor(quotas, qtr.id, bdr);
  const gi = useSQLQuery(gameSql(bdr, qtr.start, qtr.end));
  const go = useSQLQuery(obGameSql(bdr, qtr.start, qtr.end));
  const si = Array.isArray(gi.data) && gi.data[0] ? summarize(gi.data[0], false, qf.inb) : null;
  const so = Array.isArray(go.data) && go.data[0] ? summarize(go.data[0], true, qf.ob) : null;
  const live = qtr.end >= todayStr();
  const total = (si?.sqas ?? 0) + (so?.sqas ?? 0);
  const cleared = !!si && !!so && total >= qf.total;
  const over = cleared && so!.sqas >= qf.ob && total > qf.total;
  const Mon = ({ s, ob }: { s: Summ | null; ob: boolean }) => <LeagueMon s={s} ob={ob} bdr={bdr} scale={5} showToday={live} />;
  return (
    <GbBox style={{ opacity: gi.isError || go.isError ? 0.6 : 1, borderTop: `6px solid ${trainerOf(bdr).color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(11), fontWeight: 800, marginBottom: 6 }}>
        <span>{qtr.label}</span>
        <span>{live ? "IN PROGRESS" : over ? "♛♛ OVERATTAINED" : cleared ? "♛ QUOTA CLEARED" : "FINAL"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Mon s={si} ob={false} />
        <Mon s={so} ob />
      </div>
      <div style={{ fontSize: fs(9.5), marginTop: 6, textTransform: "none" }}>
        {si && so ? `${total}/${qf.total} SQAs total · ${si.meetings + so.meetings} meetings` : "loading…"}
        {qf.isDefault ? " · default quota" : qf.obDefault ? " · default in/out split" : ""}
      </div>
    </GbBox>
  );
}

function LeagueTab() {
  const [acting] = useDiveState<string>("acting", "89400804");
  const [view, setView] = useDiveState<string>("leagueView", "board");
  const [qid, setQid] = useDiveState<string>("leagueQ", QUARTERS[0].id);
  const [hofBdr, setHofBdr] = useDiveState<string>("hofBdr", acting);
  const [results, setResults] = useState<Record<string, { att: number; total: number }>>({});
  const qq = useSQLQuery(quotaSql);
  const quotas: any[] = Array.isArray(qq.data) ? qq.data : [];
  const qtr = QUARTERS.find((q) => q.id === qid) ?? QUARTERS[0];
  const onData = (id: string, v: any) => setResults((p) => (p[id]?.att === v.att && p[id]?.total === v.total ? p : { ...p, [id]: v }));
  const order = [...BDRS].sort((a, b) => (results[b.id]?.att ?? -1) - (results[a.id]?.att ?? -1));
  const rankOf = (id: string) => (results[id] ? order.filter((b) => results[b.id]).findIndex((b) => b.id === id) + 1 : 0);
  const hofId = /^\d+$/.test(hofBdr) ? hofBdr : acting;
  const px: any = { fontFamily: UI.body };

  return (
    <div style={px}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: UI.radius2, overflow: "hidden" }}>
          {[["board", "LEADERBOARD"], ["hof", "HALL OF FAME"]].map(([id, l]) => (
            <button key={id} onClick={() => setView(id)} style={{ ...ctl, border: "none", borderRadius: 0, cursor: "pointer", fontWeight: view === id ? 800 : 400,
              color: view === id ? C.page : C.muted, background: view === id ? C.accent : C.surfaceAlt }}>{l}</button>
          ))}
        </div>
        {view === "board" ? (
          <Select label="Quarter" value={qtr.id} onChange={(v) => { setQid(v); setResults({}); }} options={QUARTERS.map((q) => [q.id, q.label] as [string, string])} />
        ) : (
          <Select label="Trainer" value={hofId} onChange={setHofBdr} options={BDRS.map((b) => [b.id, b.name] as [string, string])} />
        )}
      </div>

      {view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {order.map((b) => <LeaderboardCard key={`${qtr.id}-${b.id}`} b={b} qtr={qtr} quotas={quotas} rank={rankOf(b.id)} onData={onData} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12, textTransform: "uppercase" }}>
          {QUARTERS.map((q) => <HofCard key={`${hofId}-${q.id}`} bdr={hofId} qtr={q} quotas={quotas} />)}
        </div>
      )}
      <div style={{ fontSize: fs(10), color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
        Quotas come from bdr_quotas; BDRs without a row use the default ({DEFAULT_QUOTA} total, {DEFAULT_OB_TARGET} outbound). LinkedIn + hygiene XP only exist from Nov 2026 (when the terminal started logging).
      </div>
      <span style={{ fontSize: fs(10.5), color: C.faint }}>
          {view === "board"
            ? `View-only, no XP. Ranked by credited attainment (all SQAs weigh equally; >100% only counts once the outbound target is hit) · pace = attainment ÷ ${Math.round(elapsedFrac(qtr) * 100)}% of quarter elapsed · same SQL as the Trainer tab`
            : "Every quarter's final party, replayed live from HubSpot + the terminal ledger"}
        </span>
    </div>
  );
}

// =====================================================================
// ==========================  DRAFTS (AI EMAIL)  ======================
// =====================================================================
// Drafts are generated with MotherDuck's prompt() SQL function using the
// acting BDR's voice profile + a play (template) picked from their top signal.
// Nothing is sent from here: "Open in Gmail" opens a prefilled compose window
// (BCC to HubSpot so it logs like a manual email).
const HUBSPOT_BCC = "22616816@bcc.hubspot.com";
const SIG_TO_TPL: Record<string, string> = {
  "New lead": "new_lead", "No-show": "no_show", "Outcome unresolved": "no_show", "Email reply": "reply_followup",
  "Trial spike": "trial_spike", "Trial extension": "trial_extension", "Converted to Lite": "conversion",
  "Converted to Business": "conversion", "Converted to Capacity": "conversion", "Onboarding booked": "onboarding", "High AWR": "high_awr",
  "Hand-raiser": "hand_raiser", "Event attended": "event_followup", "Event no-show": "event_followup", "Event registered": "event_followup",
  "Event upcoming": "pre_event", "Reactivation engaged": "reactivation", "Usage reactivated": "reactivation", "Re-signup": "reactivation",
  "Content download": "content_download",
};
const PRODUCT_FACTS = "MotherDuck is a serverless cloud data warehouse built on DuckDB. Dives = interactive data apps built by describing what you want in plain language. Guides = our approach to the context layer for AI agents. DuckLake = open table format. Databases are easy to share across a team. Load data from S3, GCS or local files. New UI + dark mode.";
const sqlStr = (s: string) => String(s ?? "").replace(/'/g, "''").slice(0, 1500);
type DraftReq = { id: string; name: string; company: string; sig: string; tpl: string; owner: string };

const templatesSql = `SELECT template_id, label, signal_key, cc_ae, sort FROM "bdr_terminal_gamified"."main"."email_templates" ORDER BY sort`;

function draftSql(reqs: DraftReq[], bdr: string, bdrFirst: string, model: string, extra: string, tplOverride: string, nonce: number) {
  const vals = reqs.map((r) => `('${r.id}','${tplOverride !== "auto" ? tplOverride : r.tpl}','${sqlStr(r.sig)}')`).join(",");
  const extraSql = extra.trim() ? `|| chr(10) || 'EXTRA INSTRUCTIONS FROM THE BDR: ${sqlStr(extra)}'` : "";
  return `-- nonce ${nonce}
WITH req(contact_id, template_id, sig) AS (VALUES ${vals}),
voice AS (
  SELECT COALESCE(
    (SELECT guide FROM "bdr_terminal_gamified"."main"."voice_profiles" WHERE bdr_id = '${bdr}'),
    replace((SELECT guide FROM "bdr_terminal_gamified"."main"."voice_profiles" WHERE bdr_id = 'default'), '{bdr_first_name}', '${sqlStr(bdrFirst)}')
  ) AS guide
),
examples AS (
  SELECT replace(replace(string_agg('SUBJECT: ' || COALESCE(payload->>'subject', '') || chr(10) || COALESCE(payload->>'body', ''), chr(10) || '---' || chr(10)), '—', ', '), '–', '-') AS ex
  FROM (
    SELECT payload FROM "bdr_terminal_gamified"."main"."touch_events"
    WHERE actor_bdr_id = '${bdr}' AND event_type = 'draft_saved'
      AND ((payload->>'edited') = 'true' OR (payload->>'opened_in_gmail') = 'true')
    ORDER BY event_ts DESC LIMIT 3
  )
),
humanizer AS (
  SELECT string_agg(pattern, chr(10) ORDER BY sort) AS g FROM "bdr_terminal_gamified"."main"."style_rules" WHERE kind = 'guide'
),
ctx AS (
  SELECT r.contact_id, r.template_id, r.sig, c.firstname, c.email, c.jobtitle,
    COALESCE(co.name, c.company) AS company,
    c.md_onboarding_survey_role AS s_role, c.md_onboarding_survey_usage AS s_usage, c.md_onboarding_survey_data_location AS s_loc,
    c.product_lifecycle_stage_label AS stage, strftime(c.trial_end_date, '%b %-d') AS trial_end,
    ae.email AS ae_email, TRIM(ae.firstName || ' ' || ae.lastName) AS ae_name, ce.email AS ce_email
  FROM req r
  JOIN "mdw"."hubspot"."contacts" c ON c.hs_object_id = r.contact_id
  LEFT JOIN "mdw"."hubspot"."companies" co ON co.hs_object_id = c.associatedcompanyid
  LEFT JOIN "mdw"."hubspot"."owners" ae ON ae.id = co.assigned_sales_owner_id
  LEFT JOIN "mdw"."hubspot"."owners" ce ON ce.id = co.ce_owner
),
thread AS (
  SELECT contact_id,
    string_agg(who || ' · ' || strftime(ts, '%b %-d') || ' · subject: ' || subj || chr(10) || txt, chr(10) || '---' || chr(10) ORDER BY ts DESC) AS thread_txt,
    arg_max(subj, ts) AS last_subj
  FROM (
    SELECT ctx.contact_id, TRY_CAST(e.hs_timestamp AS TIMESTAMP) AS ts,
      CASE WHEN e.hs_email_direction = 'INCOMING_EMAIL' THEN 'THEM' ELSE 'US (' || COALESCE(TRIM(o.firstName), 'teammate') || ')' END AS who,
      COALESCE(e.hs_email_subject, '') AS subj,
      left(trim(split_part(split_part(split_part(split_part(COALESCE(e.hs_email_text, ''), chr(10) || 'On ', 1), chr(10) || '>', 1), chr(10) || '-- ', 1), 'Product Specialist', 1)), 700) AS txt
    FROM ctx
    JOIN "mdw"."hubspot"."emails" e
      ON TRY_CAST(e.hs_timestamp AS TIMESTAMP) > now()::TIMESTAMP - INTERVAL 120 DAY
     AND ((e.hs_email_direction = 'INCOMING_EMAIL' AND lower(e.hs_email_from_email) LIKE '%' || lower(ctx.email) || '%')
       OR (e.hs_email_direction = 'EMAIL' AND lower(e.hs_email_to_email) LIKE '%' || lower(ctx.email) || '%'))
    LEFT JOIN "mdw"."hubspot"."owners" o ON o.id = e.hubspot_owner_id
    WHERE COALESCE(ctx.email, '') <> ''
    QUALIFY row_number() OVER (PARTITION BY ctx.contact_id ORDER BY TRY_CAST(e.hs_timestamp AS TIMESTAMP) DESC) <= 3
  ) GROUP BY 1
),
gen AS MATERIALIZED (
  SELECT ctx.*, t.label, t.cc_ae, th.last_subj,
    prompt(
      voice.guide
      || COALESCE(chr(10) || chr(10) || 'RECENT EMAILS THIS BDR APPROVED OR EDITED BEFORE SENDING (mirror their voice, length and structure closely; never reuse their facts or names):' || chr(10) || ex.ex, '')
      || chr(10) || chr(10) || COALESCE(hz.g, '')
      || chr(10) || 'Hard rules: at most one exclamation mark; no hype phrases ("great move", "exciting", "thrilled"); never mention numbers about their usage or spend.'
      || chr(10) || chr(10) || 'PLAY: ' || t.label || chr(10) || t.instructions ${extraSql}
      || chr(10) || chr(10) || 'ALLOWED PRODUCT FACTS (use at most one, only if it fits): ${sqlStr(PRODUCT_FACTS)}'
      || chr(10) || chr(10) || 'CONTACT CONTEXT:'
      || chr(10) || 'first_name: ' || COALESCE(NULLIF(ctx.firstname, ''), '(unknown)')
      || chr(10) || 'title: ' || COALESCE(NULLIF(ctx.jobtitle, ''), '(unknown)')
      || chr(10) || 'company: ' || COALESCE(NULLIF(ctx.company, ''), '(unknown, likely personal email)')
      || chr(10) || 'product stage: ' || COALESCE(ctx.stage, '(unknown)')
      || chr(10) || 'trial ends: ' || COALESCE(ctx.trial_end, '(n/a)')
      || chr(10) || 'onboarding survey: role=' || COALESCE(ctx.s_role, '?') || ', usage=' || COALESCE(ctx.s_usage, '?') || ', data location=' || COALESCE(ctx.s_loc, '?')
      || chr(10) || 'signals + last-touch notes: ' || ctx.sig
      || chr(10) || chr(10) || 'RECENT EMAIL THREAD (most recent first, up to 3; THEM = the prospect, US = our team):' || chr(10) || COALESCE(th.thread_txt, '(no emails on file)')
      || CASE WHEN t.cc_ae AND ctx.ae_name IS NOT NULL THEN chr(10) || 'Their account executive ' || ctx.ae_name || ' is CCd; you may mention looping them in.' ELSE '' END,
      model := '${model}',
      struct := {subject: 'VARCHAR', body: 'VARCHAR'}
    ) AS d
  FROM ctx
  JOIN "bdr_terminal_gamified"."main"."email_templates" t ON t.template_id = ctx.template_id
  CROSS JOIN voice
  CROSS JOIN examples ex
  CROSS JOIN humanizer hz
  LEFT JOIN thread th ON th.contact_id = ctx.contact_id
)
SELECT contact_id, template_id, label, cc_ae, firstname, email, company, ae_email, ae_name, ce_email,
  CASE WHEN template_id IN ('next_touch', 'reply_followup') AND COALESCE(last_subj, '') <> '' ${/new subject/i.test(extra) ? "AND false" : ""}
       THEN 'Re: ' || regexp_replace(last_subj, '^((re|fw|fwd):[ ]*)+', '', 'i')
       ELSE d.subject END AS subject,
  d.body AS body
FROM gen`;
}

const gmailUrl = (from: string, to: string, cc: string[], bcc: string[], su: string, body: string) =>
  `https://mail.google.com/mail/?authuser=${encodeURIComponent(from)}&view=cm&fs=1&to=${encodeURIComponent(to)}` +
  (cc.length ? `&cc=${encodeURIComponent(cc.join(","))}` : "") +
  (bcc.length ? `&bcc=${encodeURIComponent(bcc.join(","))}` : "") +
  `&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;

// ---- Humanizer: shared rules (style_rules table) applied to every AI draft for every BDR ----
const styleRulesSql = `SELECT rule_id, kind, pattern, replacement, note FROM "bdr_terminal_gamified"."main"."style_rules" WHERE kind IN ('replace', 'flag') ORDER BY sort`;
type StyleRule = { kind: string; re: RegExp; rep: string; note: string };
function useStyleRules(): StyleRule[] {
  const q = useSQLQuery(styleRulesSql);
  return useMemo(() => (Array.isArray(q.data) ? q.data : []).flatMap((r: any) => {
    try { return [{ kind: S(r.kind), re: new RegExp(S(r.pattern), "gi"), rep: S(r.replacement).replace(/\\n/g, "\n"), note: S(r.note) || S(r.rule_id) }]; }
    catch { return []; }
  }), [q.data]);
}
const DASH_RULES: StyleRule[] = [
  { kind: "replace", re: /\s*[—―]\s*/g, rep: ", ", note: "em dash" },
  { kind: "replace", re: /\s+–\s+/g, rep: ", ", note: "spaced en dash" },
  { kind: "replace", re: /–/g, rep: "-", note: "en dash" },
];
function applyRules(text: string, rules: StyleRule[]) {
  let t = String(text ?? "");
  for (const r of rules) {
    if (r.kind !== "replace") continue;
    r.re.lastIndex = 0;
    t = t.replace(r.re, (...args: any[]) => {
      const m = String(args[0]);
      const groups = args.slice(1, -2);
      let out = r.rep.replace(/\$(\d)/g, (_: string, i: string) => S(groups[Number(i) - 1]));
      const off = Number(args[args.length - 2]);
      const before = String(args[args.length - 1]).slice(0, off);
      const sentStart = !before.trim() || /[.!?]\s*$/.test(before) || /\n\s*$/.test(before);
      const lead = m.replace(/^[\s,.!?]+/, "");
      if (sentStart && /^[A-Z]/.test(lead) && /^[a-z]/.test(out)) out = out[0].toUpperCase() + out.slice(1);
      return out;
    });
  }
  return t;
}
const noDash = (t: string) => applyRules(t, DASH_RULES).replace(/,\s*,/g, ",");
function humanize(text: string, rules: StyleRule[]) {
  let t = applyRules(text, [...DASH_RULES, ...rules]);
  let seen = false;
  t = t.replace(/!/g, () => (seen ? "." : ((seen = true), "!")));
  return t.replace(/,\s*,/g, ",").replace(/ +([,.!?])/g, "$1").replace(/[ \t]+\n/g, "\n").trim();
}
function aiFlags(text: string, rules: StyleRule[]) {
  const out: string[] = [];
  if (/[—–]/.test(text)) out.push("dash");
  for (const r of rules) {
    if (r.kind !== "flag") continue;
    r.re.lastIndex = 0;
    const m = text.match(r.re);
    if (m) out.push(`${r.note} ("${m[0].trim().slice(0, 28)}")`);
  }
  return out;
}
function FlagLine({ flags }: { flags: string[] }) {
  return flags.length
    ? <span style={{ fontSize: fs(10), color: C.warn }} title="Common AI-writing tells. Edit them out before sending.">⚠ {flags.length} AI tell{flags.length > 1 ? "s" : ""}: {flags.join(" · ")}</span>
    : <span style={{ fontSize: fs(10), color: C.ok }}>✓ no AI tells</span>;
}

// ---- Action queue: clicks are instant (optimistic); events are batched into one Flight run ----
type QEvt = { event_id: string; event_type: string; contact_id?: string; company_id?: string; ae_id?: string; retouch_days?: string; note?: string };
function useActionQueue(acting: string, onSaved: () => void, ob = false) {
  const [queue, setQueue] = useState<QEvt[]>([]);
  const [inflightN, setInflightN] = useState(0);
  const [msg, setMsg] = useState("");
  const inflight = useRef<QEvt[]>([]);
  const run = useRunFlight(FLIGHT_ID);
  useFlightRun(FLIGHT_ID, run.data?.runNumber, {
    onFinished: (x: any) => {
      const n = inflight.current.length;
      setMsg(x.status === "SUCCEEDED" ? `✓ saved ${n} action${n === 1 ? "" : "s"}` : "✗ some actions were rejected (only the queue owner can write)");
      inflight.current = [];
      setInflightN(0);
      onSaved();
      window.dispatchEvent(new CustomEvent("bdr-xp-saved", { detail: { bdr: acting } }));
    },
  });
  useEffect(() => {
    if (inflight.current.length || !queue.length) return;
    const t = setTimeout(() => {
      const batch = queue.slice(0, 50);
      inflight.current = batch;
      setInflightN(batch.length);
      setQueue((q) => q.slice(batch.length));
      run.run({ ACTOR_BDR_ID: acting, BATCH: JSON.stringify(batch), EVENT_ID: "", EVENT_TYPE: "", CONTACT_ID: "", COMPANY_ID: "", AE_ID: "", RETOUCH_DAYS: "", NOTE: "", PAYLOAD: "" });
    }, 900);
    return () => clearTimeout(t);
  }, [queue, inflightN, acting]);
  const enqueue = (e: Omit<QEvt, "event_id">) => {
    setQueue((q) => [...q, { event_id: newEventId(), ...e }]);
    const gain = xpForEvent(e.event_type, ob);
    if (gain) window.dispatchEvent(new CustomEvent("bdr-xp-gain", { detail: { bdr: acting, ob, kind: gain[0], xp: gain[1] } }));
  };
  const pendingN = queue.length + inflightN;
  return { enqueue, pendingN, msg: pendingN ? `saving ${pendingN}…` : msg };
}

// Saves a draft (AI original + your final edit) to MotherDuck via the Flight. Never touches HubSpot.
function useDraftSaver(acting: string) {
  const [msg, setMsg] = useState("");
  const run = useRunFlight(FLIGHT_ID);
  const st = useFlightRun(FLIGHT_ID, run.data?.runNumber, {
    onFinished: (x: any) => setMsg(x.status === "SUCCEEDED" ? "✓ draft saved to MotherDuck" : "✗ draft not saved"),
  });
  const save = (contactId: string, ownerId: string, p: any) => {
    if (ownerId !== acting) { setMsg("not saved: only the queue owner's drafts are stored"); return; }
    if (!/^\d+$/.test(contactId) || !String(p.body || "").trim()) return;
    const clip = (v: any) => String(v ?? "").slice(0, 6000);
    const safe = { ...p, subject: clip(p.subject).slice(0, 300), body: clip(p.body), ai_subject: clip(p.ai_subject).slice(0, 300), ai_body: clip(p.ai_body) };
    setMsg("saving draft…");
    run.run({ EVENT_ID: newEventId(), ACTOR_BDR_ID: acting, CONTACT_ID: contactId, COMPANY_ID: "", AE_ID: "", EVENT_TYPE: "draft_saved",
      RETOUCH_DAYS: "", NOTE: "", PAYLOAD: JSON.stringify(safe) });
  };
  return { save, msg, busy: run.isPending || st.isChecking };
}

function DraftsTab() {
  const [acting] = useDiveState<string>("acting", "89400804");
  const [sel, setSel] = useDiveState<DraftReq[]>("draftSel", []);
  const [tplOverride, setTplOverride] = useDiveState<string>("draftTpl", "auto");
  const [model, setModel] = useDiveState<string>("draftModel", "gpt-4o");
  const [ccAe, setCcAe] = useDiveState<boolean>("draftCcAe", true);
  const [ccCe, setCcCe] = useDiveState<boolean>("draftCcCe", false);
  const [bccHs, setBccHs] = useDiveState<boolean>("draftBccHs", true);
  const [extra, setExtra] = useState("");
  const [req, setReq] = useState<{ sql: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject?: string; body?: string; sent?: boolean }>>({});
  const saver = useDraftSaver(acting);
  const rules = useStyleRules();

  const me = BDRS.find((b) => b.id === acting);
  const tq = useSQLQuery(templatesSql);
  const templates: any[] = Array.isArray(tq.data) ? tq.data : [];
  const tplIds = new Set(templates.map((t) => S(t.template_id)));
  const reqs = (Array.isArray(sel) ? sel : []).filter((r) => /^\d+$/.test(r.id)).slice(0, 15);

  const g = useSQLQuery(req?.sql ?? "SELECT 1", { enabled: !!req });
  const drafts: any[] = req && Array.isArray(g.data) ? g.data : [];

  const generate = () => {
    if (!reqs.length) return;
    const safeTpl = tplOverride === "auto" || tplIds.has(tplOverride) ? tplOverride : "auto";
    const fixed = reqs.map((r) => ({ ...r, tpl: tplIds.has(r.tpl) ? r.tpl : "custom" }));
    setEdits({});
    setReq({ sql: draftSql(fixed, acting, (me?.name ?? "").split(" ")[0], model === "gpt-4o-mini" ? "gpt-4o-mini" : "gpt-4o", extra, safeTpl, Date.now()) });
  };

  return (
    <div style={{ fontFamily: UI.body }}>
      <h1 style={{ fontSize: UI.game ? fs(20) : 21, fontWeight: 800, margin: UI.game ? "8px 0 4px" : "2px 0 0", fontFamily: UI.pixel }}>Drafting Center</h1>
      <div style={{ fontSize: fs(11), color: C.muted, marginTop: 2 }}>
        Below are settings to adjust behavior, like auto CC-ing AE/CE or changing model's voice to a different BDR's style.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: fs(10.5), color: C.faint }}>Voice: <b style={{ color: C.accent }}>{me?.name ?? acting}</b></span>
         <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={ccAe} onChange={(e) => setCcAe(e.target.checked)} /> CC's AE</label>
        <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={ccCe} onChange={(e) => setCcCe(e.target.checked)} /> CC's CE</label>
        <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={bccHs} onChange={(e) => setBccHs(e.target.checked)} /> BCC HubSpot (logs it)</label>
        <Select label="Play" value={tplOverride} onChange={setTplOverride}
          options={[["auto", "auto (by top signal)"], ...templates.map((t) => [S(t.template_id), S(t.label)] as [string, string])]} />
        <Select label="Model" value={model} onChange={setModel} options={[["gpt-4o", "gpt-4o (better)"], ["gpt-4o-mini", "gpt-4o-mini (faster)"]]} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Extra instructions for AI"
          style={{ ...ctl, flex: 1 }} />
        <button disabled={!reqs.length || (!!req && g.isLoading)} onClick={generate} style={btn(C.accent, !reqs.length || (!!req && g.isLoading))}>
          <Sparkles size={12} /> {req && g.isLoading ? "Writing…" : `Generate ${reqs.length} draft${reqs.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* selection */}
      <div style={{ ...PANEL(), padding: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs(10), letterSpacing: 1, color: C.accent, marginBottom: 6 }}>
          <span>// SELECTED ({reqs.length}/15)</span>
          {reqs.length > 0 && <button onClick={() => { setSel([]); setReq(null); }} style={{ ...ctl, padding: "1px 8px", cursor: "pointer", fontSize: fs(10) }}>clear</button>}
        </div>
        {reqs.length === 0 ? (
          <div style={{ fontSize: fs(11.5), color: C.muted }}>Tick contacts in the Signal Feed (checkbox on each row), then hit "✉ Draft" — they land here.</div>
        ) : reqs.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: fs(11), padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <b>{r.name}</b> <span style={{ color: C.faint }}>· {r.company || "—"} · {r.sig.slice(0, 70)}</span>
            </span>
            <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <span style={{ color: C.muted }}>{tplOverride === "auto" ? (templates.find((t) => S(t.template_id) === r.tpl)?.label ?? "Custom") : "override"}</span>
              <button onClick={() => setSel(reqs.filter((x) => x.id !== r.id))} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer" }}><X size={11} /></button>
            </span>
          </div>
        ))}
      </div>

      {/* drafts */}
      {req && g.isError && <div style={{ color: C.danger, fontSize: fs(12) }}>{String(g.error)}</div>}
      {req && g.isLoading && (
        <div style={{ display: "grid", gap: 10 }}>
          {reqs.map((r) => <div key={r.id} className="animate-pulse" style={{ height: 150, background: C.surface, borderRadius: UI.radius }} />)}
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {drafts.map((d) => {
          const id = S(d.contact_id);
          const e = edits[id] ?? {};
          const aiSub = humanize(S(d.subject), rules);
          const aiBod = humanize(S(d.body), rules);
          const subject = e.subject ?? aiSub;
          const body = e.body ?? aiBod;
          const flags = aiFlags(`${subject}\n${body}`, rules);
          const cc = [ccAe && d.ae_email ? S(d.ae_email) : "", ccCe && d.ce_email ? S(d.ce_email) : ""].filter(Boolean);
          const bcc = bccHs ? [HUBSPOT_BCC] : [];
          const words = body.trim().split(/\s+/).length;
          const set = (patch: any) => setEdits((p) => ({ ...p, [id]: { ...(p[id] ?? {}), ...patch } }));
          return (
            <div key={id} style={{ background: C.surface, border: `1px solid ${e.sent ? C.ok : C.border}`, borderRadius: UI.radius, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: fs(11), color: C.muted, marginBottom: 6, flexWrap: "wrap" }}>
                <span>To <b style={{ color: C.text }}>{S(d.firstname) || S(d.email)}</b> &lt;{S(d.email)}&gt;{d.company ? ` · ${S(d.company)}` : ""}</span>
                <span>{S(d.label)} · {words} words{cc.length ? ` · cc ${cc.join(", ")}` : ""} · <FlagLine flags={flags} /></span>
              </div>
              <input value={subject} onChange={(ev) => set({ subject: ev.target.value })} style={{ ...ctl, width: "100%", marginBottom: 6, fontWeight: 700 }} />
              <textarea value={body} onChange={(ev) => set({ body: ev.target.value })} rows={Math.min(14, Math.max(7, body.split("\n").length + 1))}
                style={{ ...ctl, width: "100%", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: fs(13), lineHeight: 1.5, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                <a href={gmailUrl(me?.email ?? "", S(d.email), cc, bcc, noDash(subject), noDash(body))} target="_blank" rel="noopener noreferrer"
                  onClick={() => { set({ sent: true }); saver.save(id, reqs.find((x) => x.id === id)?.owner ?? "", { template_id: S(d.template_id), subject: noDash(subject), body: noDash(body), ai_subject: S(d.subject), ai_body: S(d.body), edited: subject !== aiSub || body !== aiBod, flags: flags.length, opened_in_gmail: true, cc: cc.join(",") }); }}
                  style={{ ...btn("#ff7a59"), textDecoration: "none" }}>
                  <Mail size={12} /> Open in Gmail
                </a>
                <button style={btn(C.muted)} onClick={() => { try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch {} }}>Copy</button>
                <button style={btn(C.accent, saver.busy)} disabled={saver.busy}
                  onClick={() => saver.save(id, reqs.find((x) => x.id === id)?.owner ?? "", { template_id: S(d.template_id), subject: noDash(subject), body: noDash(body), ai_subject: S(d.subject), ai_body: S(d.body), edited: subject !== aiSub || body !== aiBod, flags: flags.length, opened_in_gmail: false, cc: cc.join(",") })}>Save</button>
                {e.sent && <span style={{ fontSize: fs(10.5), color: C.ok }}>✓ opened in Gmail — hit send there</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: fs(10), color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
        Drafts use MotherDuck prompt() with your voice profile + the play. Nothing sends from the terminal: Gmail opens prefilled, you review + send.

        BCC HubSpot logs the email to the contact like your manual sends. Max 15 per batch.

        Opening in Gmail or hitting Save stores the draft in MotherDuck (not HubSpot); your sent/edited drafts become voice examples for future drafts.
        {saver.msg ? ` · ${saver.msg}` : ""}
      </div>
    </div>
  );
}

// ---- Per-contact draft (lives in the Signal Feed card; only runs on click) ----
const ASK_CHIPS = ["bump w/ a new angle", "ask for a 15-min call", "share a relevant guide", "answer their reply", "gut check / breakup"];

function DraftBox({ r, acting }: { r: Row; acting: string }) {
  const [ask, setAsk] = useState("");
  const [tpl, setTpl] = useState("next_touch");
  const [ccAe, setCcAe] = useState(false);
  const [req, setReq] = useState<{ sql: string } | null>(null);
  const [edit, setEdit] = useState<{ subject?: string; body?: string; opened?: boolean }>({});
  const tq = useSQLQuery(templatesSql);
  const templates: any[] = Array.isArray(tq.data) ? tq.data : [];
  const me = BDRS.find((b) => b.id === acting);
  const g = useSQLQuery(req?.sql ?? "SELECT 1", { enabled: !!req });
  const d: any = req && Array.isArray(g.data) ? g.data[0] : null;
  const saver = useDraftSaver(acting);
  const rules = useStyleRules();
  const cid = /^\d+$/.test(r.contact_id) ? r.contact_id : "-1";
  const lastQ = useSQLQuery(`SELECT strftime(event_ts, '%Y-%m-%dT%H:%M:%S') AS ts, actor_bdr_id,
  payload->>'subject' AS subject, payload->>'body' AS body
FROM "bdr_terminal_gamified"."main"."touch_events"
WHERE event_type = 'draft_saved' AND contact_id::VARCHAR = '${cid}'
ORDER BY event_ts DESC LIMIT 1`);
  const last: any = Array.isArray(lastQ.data) ? lastQ.data[0] : null;

  const generate = () => {
    const lastTouch = r.last_touch ? `Last touch ${fmtAgo(r.last_touch)} by ${r.last_by || "unknown"} via ${r.last_channel || "unknown channel"}` : "Never touched";
    const reply = r.last_reply
      ? `; they last replied ${fmtAgo(r.last_reply)}${!r.last_touch || r.last_reply > r.last_touch ? " (AFTER our last touch, so they are waiting on us)" : ""}`
      : "; they have never replied";
    const sigs = r.signals.map((s) => s.sig + (s.detail ? ` (${s.detail})` : "") + (s.handled ? " [already answered]" : "")).join("; ");
    const sig = `${lastTouch}${reply}. Signals: ${sigs || "none"}. Touches in last 14d: ${r.touches_14d + (r.ov?.linkedin_14d ?? 0)}.` +
      (r.ov?.linkedin_status ? ` LinkedIn: ${r.ov.linkedin_status.replace("linkedin_", "").replace("_", " ")}.` : "") +
      (r.ov?.last_note ? ` BDR note: ${r.ov.last_note}` : "");
    const ids = new Set(templates.map((t) => S(t.template_id)));
    const play = ids.size === 0 || ids.has(tpl) ? tpl : "next_touch";
    setEdit({});
    setReq({ sql: draftSql([{ id: r.contact_id, name: r.contact_name, company: r.company, sig, tpl: play, owner: r.queue_owner_id }],
      acting, (me?.name ?? "").split(" ")[0], "gpt-4o", ask, "auto", Date.now()) });
  };

  const busy = !!req && g.isLoading;
  const showEditor = (!!d || edit.body !== undefined) && !busy;
  const aiSubject = useMemo(() => humanize(S(d?.subject), rules), [d, rules]);
  const aiBody = useMemo(() => humanize(S(d?.body), rules), [d, rules]);
  const subject = edit.subject ?? aiSubject;
  const body = edit.body ?? aiBody;
  const flags = useMemo(() => aiFlags(`${subject}\n${body}`, rules), [subject, body, rules]);
  const cc = ccAe && d?.ae_email ? [S(d.ae_email)] : [];
  const toEmail = S(d?.email) || r.email;
  const canSave = r.queue_owner_id === acting;
  const payload = (opened: boolean) => ({
    template_id: S(d?.template_id) || "restored", subject: noDash(subject), body: noDash(body), ai_subject: S(d?.subject), ai_body: S(d?.body),
    edited: d ? subject !== aiSubject || body !== aiBody : false, flags: flags.length, opened_in_gmail: opened, cc: cc.join(","),
  });

  return (
    <div>
      <div style={{ fontSize: fs(10.5), color: C.faint, marginBottom: 6 }}>
        Based on the last touch{r.last_touch ? ` (${fmtAgo(r.last_touch)}, ${r.last_by || "?"} · ${r.last_channel || "?"})` : " (none yet)"} + the last 3 emails in the thread. Follow-ups reuse the thread subject ("Re: …"); type "new subject" to get a fresh one. Nothing runs until you hit Draft.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !busy) generate(); }}
          placeholder="What kind of email? (optional) e.g. bump w/ the DuckLake book, push for a call…" style={{ ...ctl, flex: 1, minWidth: 220 }} />
        <select value={tpl} onChange={(e) => setTpl(e.target.value)} style={{ ...ctl, cursor: "pointer" }} title="Play">
          {(templates.length ? templates : [{ template_id: "next_touch", label: "Next touch (from last touch)" }]).map((t: any) =>
            <option key={S(t.template_id)} value={S(t.template_id)}>{S(t.label)}</option>)}
        </select>
        <button disabled={busy} onClick={generate} style={btn(C.accent, busy)}>
          <Sparkles size={12} /> {busy ? "Writing…" : d ? "Regenerate" : "Draft"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
        {ASK_CHIPS.map((c) => (
          <button key={c} onClick={() => setAsk(c)} style={{ ...ctl, padding: "1px 7px", fontSize: fs(10), cursor: "pointer", color: ask === c ? C.accent : C.faint }}>{c}</button>
        ))}
      </div>

      {last && !d && edit.body === undefined && !busy && (
        <div style={{ fontSize: fs(10.5), color: C.muted, marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          Last saved draft {fmtAgo(T(S(last.ts)))}{S(last.actor_bdr_id) !== acting ? ` by ${bdrName(S(last.actor_bdr_id))}` : ""}: <i>{S(last.subject).slice(0, 70) || "(no subject)"}</i>
          <button style={{ ...ctl, padding: "1px 7px", fontSize: fs(10), cursor: "pointer" }} onClick={() => setEdit({ subject: S(last.subject), body: S(last.body) })}>load</button>
        </div>
      )}
      {busy && <div className="animate-pulse" style={{ height: 140, background: C.surfaceAlt, borderRadius: UI.radius2, marginTop: 8 }} />}
      {req && g.isError && <div style={{ color: C.danger, fontSize: fs(11), marginTop: 8 }}>{String(g.error)}</div>}
      {showEditor && (
        <div style={{ marginTop: 8 }}>
          <input value={subject} onChange={(e) => setEdit((p) => ({ ...p, subject: e.target.value }))} style={{ ...ctl, width: "100%", marginBottom: 6, fontWeight: 700 }} />
          <textarea value={body} onChange={(e) => setEdit((p) => ({ ...p, body: e.target.value }))} rows={Math.min(14, Math.max(6, body.split("\n").length + 1))}
            style={{ ...ctl, width: "100%", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: fs(13), lineHeight: 1.5, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <a href={gmailUrl(me?.email ?? "", toEmail, cc, [HUBSPOT_BCC], noDash(subject), noDash(body))} target="_blank" rel="noopener noreferrer"
              onClick={() => { setEdit((p) => ({ ...p, opened: true })); if (canSave) saver.save(r.contact_id, r.queue_owner_id, payload(true)); }}
              style={{ ...btn("#ff7a59"), textDecoration: "none" }}>
              <Mail size={12} /> Open in Gmail
            </a>
            <button style={btn(C.muted)} onClick={() => { try { navigator.clipboard.writeText(`${subject}\n\n${body}`); } catch {} }}>Copy</button>
            <button style={btn(C.accent, !canSave || saver.busy)} disabled={!canSave || saver.busy} title={canSave ? "Save to MotherDuck" : "Only the queue owner can save"}
              onClick={() => saver.save(r.contact_id, r.queue_owner_id, payload(false))}>Save</button>
            {d?.ae_email && (
              <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", gap: 4, alignItems: "center" }}>
                <input type="checkbox" checked={ccAe} onChange={(e) => setCcAe(e.target.checked)} /> CC AE ({S(d.ae_name)})
              </label>
            )}
            <span style={{ fontSize: fs(10), color: C.faint }}>{d ? S(d.label) : "saved draft"} · {body.trim().split(/\s+/).length} words · BCC HubSpot</span>
            <FlagLine flags={flags} />
            {edit.opened && <span style={{ fontSize: fs(10.5), color: C.ok }}>✓ opened in Gmail, hit send there</span>}
            {saver.msg && <span style={{ fontSize: fs(10.5), color: saver.msg.startsWith("✗") ? C.danger : C.accent }}>{saver.msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ===========================  OUTBOUND  ==============================
// =====================================================================
// Apollo-sourced contacts grouped by account. AE = terminal override ->
// HubSpot outbound_owner -> assigned_sales_owner -> "Unassigned (pod)".
const OB_SIG: Record<string, { color: string; rank: number }> = {
  "LinkedIn reply": { color: "#5fb3ff", rank: 1 }, "Replied": { color: "#5fb3ff", rank: 1 },
  "LinkedIn accepted": { color: "#74c0fc", rank: 2 }, "Signed up": { color: "#69db7c", rank: 3 },
  "Pricing page": { color: "#ffa94d", rank: 4 }, "Site visit": { color: "#ffd43b", rank: 4 },
  "Sequence ended, no reply": { color: "#b197fc", rank: 5 }, "Never touched": { color: "#66786c", rank: 6 },
};
const OB_BUCKETS: { id: string; label: string; hint: string }[] = [
  { id: "hot", label: "Hot", hint: "Reply, LinkedIn reply/accept, signup or site/pricing visit not yet answered" },
  { id: "followup", label: "Follow-up", hint: "Worked before, no reply, last touch 7+ days ago (or sequence ended)" },
  { id: "retouch_due", label: "Retouch due", hint: "Retouch date reached" },
  { id: "working", label: "Working", hint: "Touched in the last 7 days" },
  { id: "untouched", label: "Untouched", hint: "Added from Apollo, no touch logged in HubSpot or the terminal" },
  { id: "scheduled", label: "Scheduled", hint: "Retouch date in the future" },
  { id: "all", label: "All", hint: "Everything in scope" },
];
const HS_COMPANY = (id: string) => `https://app.hubspot.com/contacts/22616816/record/0-2/${id}`;

function obSql(ownersSql: string) {
  return `WITH owners_sel AS (SELECT unnest([${ownersSql}]) AS owner_id),
c AS (
  SELECT ct.* FROM "mdw"."hubspot"."contacts" ct
  WHERE ct.hubspot_owner_id IN (SELECT owner_id FROM owners_sel)
    AND (ct.contact_source_label = 'Apollo' OR ct.hs_object_source_detail_1 = 'Apollo Integration')
),
c_emails AS (SELECT hs_object_id AS contact_id, lower(trim(email)) AS addr FROM c WHERE COALESCE(email, '') <> ''),
email_touch AS (
  SELECT ce.contact_id, TRY_CAST(e.hs_timestamp AS TIMESTAMP) AS ts, e.hubspot_owner_id AS actor_id, 'Email' AS channel
  FROM (
    SELECT hs_timestamp, hubspot_owner_id,
      unnest(regexp_extract_all(lower(hs_email_to_email), '[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}')) AS addr
    FROM "mdw"."hubspot"."emails"
    WHERE hs_email_direction = 'EMAIL' AND TRY_CAST(hs_timestamp AS TIMESTAMP) > now()::TIMESTAMP - INTERVAL 180 DAY
  ) e JOIN c_emails ce ON ce.addr = e.addr
),
call_touch AS (
  SELECT cca.contact_id::VARCHAR AS contact_id, TRY_CAST(cl.hs_timestamp AS TIMESTAMP) AS ts, cl.hubspot_owner_id AS actor_id,
    CASE WHEN cl.call_disposition_label IN ('Connected', 'Interested: follow up', 'Not interested', 'Booked AE meeting', 'Bad fit', 'Intro not made') THEN 'Call (connected)' ELSE 'Call' END AS channel
  FROM "mdw"."hubspot"."call_to_contact_associations" cca
  JOIN "mdw"."hubspot"."calls" cl ON cl.call_id = cca.call_id
  WHERE cca.contact_id::VARCHAR IN (SELECT hs_object_id FROM c)
),
meeting_touch AS (
  SELECT mca.contact_id::VARCHAR AS contact_id, m.start_time AS ts, m.hubspot_owner_id AS actor_id, 'Meeting' AS channel
  FROM "mdw"."hubspot"."meeting_to_contact_associations" mca
  JOIN "mdw"."hubspot"."meetings" m ON m.meeting_id = mca.meeting_id
  WHERE mca.contact_id::VARCHAR IN (SELECT hs_object_id FROM c) AND m.start_time <= now()::TIMESTAMP
),
touch_agg AS (
  SELECT contact_id, MIN(ts) AS first_touch_ts, MAX(ts) AS last_touch_ts,
    arg_max(actor_id, ts) AS last_touch_actor_id, arg_max(channel, ts) AS last_touch_channel,
    COUNT(*) FILTER (WHERE ts > now()::TIMESTAMP - INTERVAL 14 DAY) AS touches_14d,
    COUNT(*) AS touches_180d,
    COUNT(*) FILTER (WHERE channel LIKE 'Call%') AS calls_total,
    COUNT(*) FILTER (WHERE channel = 'Call (connected)') AS calls_connected
  FROM (SELECT * FROM email_touch UNION ALL SELECT * FROM call_touch UNION ALL SELECT * FROM meeting_touch)
  WHERE ts IS NOT NULL GROUP BY 1
),
signup AS (
  SELECT c.hs_object_id AS contact_id, MIN(o.created_dt) AS org_created
  FROM c
  JOIN "mdw"."hubspot"."contact_to_org_associations" coa ON coa.contact_id::VARCHAR = c.hs_object_id
  JOIN "mdw"."hubspot"."organizations" ho ON ho.hubspot_organization_id = CAST(coa.organization_id AS VARCHAR)
  JOIN "mdw"."main"."organizations" o ON o.id = TRY_CAST(ho.mdw_organization_id AS UUID)
  GROUP BY 1
),
signals AS (
  SELECT c.hs_object_id AS contact_id, 1 AS rnk, 'Replied' AS sig, c.hs_sales_email_last_replied AS sig_ts, NULL AS detail
  FROM c WHERE c.hs_sales_email_last_replied >= now()::TIMESTAMP - INTERVAL 30 DAY
  UNION ALL
  SELECT contact_id, 3, 'Signed up', org_created::TIMESTAMP, 'Created a MotherDuck org'
  FROM signup WHERE org_created >= current_date - 30
  UNION ALL
  SELECT hs_object_id, 4, 'Pricing page', TRY_CAST(last_pricing_page_visit AS TIMESTAMP), NULL
  FROM c WHERE TRY_CAST(last_pricing_page_visit AS TIMESTAMP) >= now()::TIMESTAMP - INTERVAL 14 DAY
  UNION ALL
  SELECT hs_object_id, 4, 'Site visit', TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP), NULL
  FROM c WHERE TRY_CAST(hs_analytics_last_visit_timestamp AS TIMESTAMP) >= now()::TIMESTAMP - INTERVAL 7 DAY
  UNION ALL
  SELECT hs_object_id, 5, 'Sequence ended, no reply', hs_latest_sequence_ended_date, NULL
  FROM c WHERE hs_latest_sequence_ended_date >= now()::TIMESTAMP - INTERVAL 21 DAY
    AND COALESCE(hs_sequences_is_enrolled, false) = false
    AND (hs_sales_email_last_replied IS NULL OR hs_sales_email_last_replied < hs_latest_sequence_enrolled_date)
  UNION ALL
  SELECT c.hs_object_id, 6, 'Never touched', c.created_at, NULL
  FROM c LEFT JOIN touch_agg t ON t.contact_id = c.hs_object_id
  WHERE t.contact_id IS NULL AND COALESCE(c.hs_sequences_enrolled_count, 0) = 0 AND c.created_at < now()::TIMESTAMP - INTERVAL 2 DAY
),
sig_agg AS (
  SELECT contact_id,
    to_json(list({'sig': sig, 'rnk': rnk, 'ts': strftime(sig_ts, '%Y-%m-%dT%H:%M:%S'), 'detail': detail} ORDER BY rnk))::VARCHAR AS signals_json
  FROM signals GROUP BY 1
),
sqa_deals AS (
  SELECT d.hs_object_id::VARCHAR AS deal_id, d.dealname, TRY_CAST(d.first_date_qualified AS DATE) AS qd,
    CASE WHEN NOT COALESCE(d.hs_is_closed, false) THEN 'open'
         WHEN d.date_entered_closed_won_motherduck_sales IS NOT NULL OR d.date_entered_closed_won_customer_pipeline_sales IS NOT NULL THEN 'won'
         ELSE 'lost' END AS st,
    d.closedate, d.hubspot_owner_id AS deal_owner
  FROM "mdw"."hubspot"."deals" d
  WHERE d.first_date_qualified IS NOT NULL
    AND (
      (TRY_CAST(d.first_date_qualified AS DATE) < DATE '2026-08-01' AND COALESCE(d.tags_stamped_at_deal_qualification,'') <> 'Growth Account')
      OR (TRY_CAST(d.first_date_qualified AS DATE) >= DATE '2026-08-01' AND (
            COALESCE(d.segment_stamped_at_deal_qualification,'') IN ('SMB','MM','ENT')
            OR (COALESCE(d.segment_stamped_at_deal_qualification,'') = 'Micro'
                AND lower(COALESCE(TRY_CAST(d.is_focused_stamped_at_deal_qualification AS VARCHAR),'')) = 'true'))))
    AND (d.pipeline = 'default' OR COALESCE(d.needs_intro_meeting,'') = 'Yes')
    AND COALESCE(d.dealtype,'') <> 'existingbusiness'
),
sqa_live AS (SELECT * FROM sqa_deals WHERE st IN ('open','won') OR (st = 'lost' AND closedate >= now()::TIMESTAMP - INTERVAL 180 DAY)),
sqa_hit AS (
  SELECT x.k, arg_max(s.dealname || ' · qualified ' || strftime(s.qd, '%Y-%m-%d') || ' · ' || s.st || COALESCE(' · ' || NULLIF(TRIM(COALESCE(o.firstName,'') || ' ' || COALESCE(o.lastName,'')), ''), ''), s.qd) AS info
  FROM (
    SELECT 'co:' || CAST(company_id AS VARCHAR) AS k, CAST(deal_id AS VARCHAR) AS deal_id FROM "mdw"."hubspot"."deal_to_company_associations"
    UNION ALL
    SELECT 'ct:' || CAST(contact_id AS VARCHAR), CAST(deal_id AS VARCHAR) FROM "mdw"."hubspot"."deal_to_contact_associations"
  ) x JOIN sqa_live s ON s.deal_id = x.deal_id
  LEFT JOIN "mdw"."hubspot"."owners" o ON o.id = s.deal_owner
  GROUP BY 1
)
SELECT
  c.hs_object_id AS contact_id, c.hubspot_owner_id AS owner_id,
  NULLIF(TRIM(COALESCE(c.firstname,'') || ' ' || COALESCE(c.lastname,'')), '') AS contact_name,
  c.email, COALESCE(NULLIF(c.jobtitle,''), c.ap_title) AS title,
  COALESCE(NULLIF(c.associatedcompanyid,''), 'nocompany:' || c.hs_object_id) AS company_id,
  COALESCE(co.name, c.ap_company_name, c.company, c.associated_company_domain_name) AS company,
  co.domain, co.segment, co.outbound_play,
  COALESCE(co.outbound_owner, co.assigned_sales_owner_id) AS hs_ae_id,
  TRIM(ae.firstName || ' ' || ae.lastName) AS hs_ae_name,
  COALESCE(NULLIF(c.linkedin_url,''), NULLIF(c.ap_linkedin_url,'')) AS linkedin_url,
  strftime(c.created_at, '%Y-%m-%dT%H:%M:%S') AS created_ts,
  strftime(GREATEST(t.last_touch_ts, c.notes_last_contacted, c.hs_last_sales_activity_timestamp), '%Y-%m-%dT%H:%M:%S') AS last_touch_ts,
  t.last_touch_actor_id, TRIM(lt.firstName || ' ' || lt.lastName) AS last_touch_by, t.last_touch_channel,
  COALESCE(t.touches_14d, 0) AS touches_14d, COALESCE(t.touches_180d, 0) AS touches_180d,
  COALESCE(t.calls_total, 0) AS calls_total, COALESCE(t.calls_connected, 0) AS calls_connected,
  strftime(c.hs_sales_email_last_replied, '%Y-%m-%dT%H:%M:%S') AS last_reply_ts,
  COALESCE(c.hs_sequences_is_enrolled, false) AS in_sequence,
  COALESCE(s.signals_json, '[]') AS signals_json,
  COALESCE(hc.info, hco.info) AS sqa_info,
  (hc.info IS NOT NULL OR hco.info IS NOT NULL) AS post_sqa
FROM c
LEFT JOIN sqa_hit hco ON hco.k = 'co:' || c.associatedcompanyid
LEFT JOIN sqa_hit hc ON hc.k = 'ct:' || c.hs_object_id
LEFT JOIN "mdw"."hubspot"."companies" co ON co.hs_object_id = c.associatedcompanyid
LEFT JOIN touch_agg t ON t.contact_id = c.hs_object_id
LEFT JOIN "mdw"."hubspot"."owners" lt ON lt.id = t.last_touch_actor_id
LEFT JOIN "mdw"."hubspot"."owners" ae ON ae.id = COALESCE(co.outbound_owner, co.assigned_sales_owner_id)
LEFT JOIN sig_agg s ON s.contact_id = c.hs_object_id
`;
}
const podsSql = `SELECT bdr_id, ae_id, ae_name, territory FROM "bdr_terminal_gamified"."main"."bdr_ae_pods"`;
const aeOverrideSql = `SELECT company_id::VARCHAR AS company_id, ae_id FROM "bdr_terminal_gamified"."main"."account_ae_override"`;

type ObContact = {
  contact_id: string; owner_id: string; contact_name: string; email: string; title: string; linkedin_url: string;
  created: number | null; last_touch: number | null; last_by: string; last_by_id: string; last_channel: string;
  touches_14d: number; touches_180d: number; calls_total: number; calls_connected: number; last_reply: number | null;
  in_sequence: boolean; signals: Sig[]; ov?: Ov;
};
type ObAccount = {
  company_id: string; company: string; domain: string; segment: string; play: string; hs_ae_id: string; hs_ae_name: string;
  ae_id: string; ae_source: "override" | "hubspot" | "pod"; owner_id: string; post_sqa: boolean; contacts: ObContact[];
  last_touch: number | null; last_by: string; worked: number; signals: Sig[]; hot: Sig[]; bucket: string; prio: number;
  retouch_on: string | null; sqa_info?: string;
};

function OutboundFeed() {
  const [acting] = useDiveState<string>("acting", "89400804");
  const [owners] = useDiveState<string[]>("owners", ["89400804"]);
  const [bucket, setBucket] = useDiveState<string>("obBucket", "hot");
  const [aeFilter, setAeFilter] = useDiveState<string>("obAe", "any");
  const [segFilter, setSegFilter] = useDiveState<string>("obSeg", "any");
  const [playFilter, setPlayFilter] = useDiveState<string>("obPlay", "any");
  const [sortBy, setSortBy] = useDiveState<string>("obSort", "priority");
  const [showPost, setShowPost] = useDiveState<boolean>("obPost", false);
  const [selected, setSelected] = useDiveState<string | null>("obSel", null);
  const [search, setSearch] = useState("");
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Partial<Ov>>>({});
  const [aePending, setAePending] = useState<Record<string, string>>({});

  const scopeIds = (Array.isArray(owners) ? owners : []).filter((o) => /^\d+$/.test(o));
  const ownersSql = (scopeIds.length ? scopeIds : ["89400804"]).map((x) => `'${x}'`).join(",");

  const ovQ = useSQLQuery(overlaySql);
  const podQ = useSQLQuery(podsSql);
  const aeQ = useSQLQuery(aeOverrideSql);
  const q = useSQLQuery(useMemo(() => obSql(ownersSql), [ownersSql]));

  const pods: any[] = Array.isArray(podQ.data) ? podQ.data : [];
  const aeName = (id: string) => pods.find((p) => S(p.ae_id) === id)?.ae_name ?? "";
  const podOf = (bdr: string) => pods.filter((p) => S(p.bdr_id) === bdr);
  const ovMap = useMemo(() => {
    const m: Record<string, Ov> = {};
    for (const r of Array.isArray(ovQ.data) ? ovQ.data : []) m[S(r.contact_id)] = toOv(r);
    for (const [k, p] of Object.entries(pending)) m[k] = { ...(m[k] ?? toOv({})), ...p } as Ov;
    return m;
  }, [ovQ.data, pending]);
  const aeOverride = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of Array.isArray(aeQ.data) ? aeQ.data : []) m[S(r.company_id)] = S(r.ae_id);
    return { ...m, ...aePending };
  }, [aeQ.data, aePending]);

  const accounts: ObAccount[] = useMemo(() => {
    const byCo: Record<string, ObAccount> = {};
    for (const r of Array.isArray(q.data) ? q.data : []) {
      const cid = S(r.company_id);
      const ov = ovMap[S(r.contact_id)];
      const li = ov?.last_linkedin_ts ?? null;
      const hs = T(S(r.last_touch_ts));
      const liNewer = li != null && (hs == null || li > hs);
      let sigs: Sig[] = [];
      try { sigs = (JSON.parse(S(r.signals_json) || "[]") as any[]).map((s) => ({ sig: S(s.sig), rnk: N(s.rnk), ts: T(s.ts), detail: S(s.detail) })); } catch {}
      if (ov?.linkedin_status === "linkedin_reply") sigs.push({ sig: "LinkedIn reply", rnk: 1, ts: ov.last_linkedin_ts, detail: "" });
      if (ov?.linkedin_status === "linkedin_accepted") sigs.push({ sig: "LinkedIn accepted", rnk: 2, ts: ov.last_linkedin_ts, detail: "" });
      const last_touch = liNewer ? li : hs;
      if (last_touch != null) sigs = sigs.filter((s) => s.sig !== "Never touched");
      const lt = last_touch ?? -Infinity;
      sigs = sigs.map((s) => ({ ...s, handled: s.sig === "LinkedIn reply" || s.sig === "LinkedIn accepted" ? false : s.ts != null ? lt > s.ts : false }));
      const ct: ObContact = {
        contact_id: S(r.contact_id), owner_id: S(r.owner_id), contact_name: S(r.contact_name), email: S(r.email), title: S(r.title),
        linkedin_url: normUrl(S(r.linkedin_url)), created: T(S(r.created_ts)), last_touch,
        last_by: liNewer ? bdrName(ov!.last_linkedin_actor) : S(r.last_touch_by), last_by_id: liNewer ? ov!.last_linkedin_actor : S(r.last_touch_actor_id),
        last_channel: liNewer ? "LinkedIn" : S(r.last_touch_channel), touches_14d: N(r.touches_14d) + (ov?.linkedin_14d ?? 0),
        touches_180d: N(r.touches_180d), calls_total: N(r.calls_total), calls_connected: N(r.calls_connected),
        last_reply: T(S(r.last_reply_ts)), in_sequence: B(r.in_sequence), signals: sigs.sort((a, b) => a.rnk - b.rnk), ov,
      };
      const a = byCo[cid] ?? (byCo[cid] = {
        company_id: cid, company: S(r.company) || "(no company)", domain: S(r.domain), segment: S(r.segment), play: S(r.outbound_play),
        hs_ae_id: S(r.hs_ae_id), hs_ae_name: S(r.hs_ae_name), ae_id: "", ae_source: "pod", owner_id: S(r.owner_id), post_sqa: B(r.post_sqa),
        contacts: [], last_touch: null, last_by: "", worked: 0, signals: [], hot: [], bucket: "untouched", prio: 0, retouch_on: null,
      });
      a.contacts.push(ct);
      if (B(r.post_sqa)) { a.post_sqa = true; a.sqa_info = a.sqa_info || S(r.sqa_info); }
    }
    const today = todayStr();
    return Object.values(byCo).map((a) => {
      const ov = aeOverride[a.company_id];
      a.ae_id = ov !== undefined && ov !== "" ? ov : a.hs_ae_id;
      a.ae_source = ov ? "override" : a.hs_ae_id ? "hubspot" : "pod";
      for (const c of a.contacts) {
        if (c.last_touch != null && (a.last_touch == null || c.last_touch > a.last_touch)) { a.last_touch = c.last_touch; a.last_by = c.last_by; }
        if (c.last_touch != null) a.worked++;
        for (const s of c.signals) a.signals.push(s);
        const rt = c.ov?.retouch_on && c.ov.retouch_event_ts != null && !((c.last_touch ?? -Infinity) > c.ov.retouch_event_ts) ? c.ov.retouch_on : null;
        if (rt && (!a.retouch_on || rt < a.retouch_on)) a.retouch_on = rt;
      }
      if (a.contacts.length === 1 && a.worked > 0 && !a.company_id.startsWith("nocompany")) a.signals.push({ sig: "Single-threaded", rnk: 7, ts: null, detail: "", handled: false });
      a.hot = a.signals.filter((s) => !s.handled && s.rnk <= 4);
      const dl = daysSince(a.last_touch);
      const seqEnded = a.signals.some((s) => s.sig === "Sequence ended, no reply" && !s.handled);
      if (a.retouch_on) a.bucket = a.retouch_on <= today ? "retouch_due" : "scheduled";
      else if (a.hot.length) a.bucket = "hot";
      else if (a.last_touch == null) a.bucket = "untouched";
      else if (seqEnded || (dl ?? 0) >= 7) a.bucket = "followup";
      else a.bucket = "working";
      const top = a.hot.length ? Math.min(...a.hot.map((s) => s.rnk)) : 9;
      const newest = Math.max(...a.hot.map((s) => s.ts ?? 0), 0);
      a.prio = top * 1000 + (newest ? Math.min((Date.now() - newest) / 36e5, 999) : 999) - a.worked;
      return a;
    });
  }, [q.data, ovMap, aeOverride]);

  // write path: batched action queue (same Flight as the Signal Feed); optimistic state bridges the ~1 min share lag
  const aq = useActionQueue(acting, () => { ovQ.refetch(); aeQ.refetch(); setTimeout(() => { ovQ.refetch(); aeQ.refetch(); }, 30000); setTimeout(() => { ovQ.refetch(); aeQ.refetch(); }, 75000); }, true);
  const busy = false;
  const runMsg = aq.msg;
  const dropLater = (key: string, ae = false) => setTimeout(() => ((ae ? setAePending : setPending) as any)((p: any) => { const n = { ...p }; delete n[key]; return n; }), 120000);
  const actContact = (c: ObContact, type: string, extra: any = {}) => {
    if (c.owner_id !== acting) return;
    const now = T(new Date().toISOString().slice(0, 19));
    const patch: Partial<Ov> = {};
    if (type === "reviewed") patch.reviewed_ts = now;
    if (type === "retouch_set") { const d = new Date(); d.setUTCDate(d.getUTCDate() + Number(extra.days || 7)); patch.retouch_on = d.toISOString().slice(0, 10); patch.retouch_event_ts = now; }
    if (type === "retouch_clear") { patch.retouch_on = null; patch.retouch_event_ts = now; }
    if (type.startsWith("linkedin_")) { patch.linkedin_status = type; patch.last_linkedin_ts = now; patch.last_linkedin_actor = acting; patch.linkedin_14d = (c.ov?.linkedin_14d ?? 0) + 1; }
    setPending((p) => ({ ...p, [c.contact_id]: { ...(p[c.contact_id] ?? {}), ...patch } }));
    dropLater(c.contact_id);
    aq.enqueue({ event_type: type, contact_id: c.contact_id, retouch_days: type === "retouch_set" ? String(extra.days || 7) : undefined });
  };
  const assignAe = (a: ObAccount, aeId: string) => {
    if (a.owner_id !== acting || a.company_id.startsWith("nocompany")) return;
    setAePending((p) => ({ ...p, [a.company_id]: aeId }));
    dropLater(a.company_id, true);
    aq.enqueue({ event_type: "ae_assign", company_id: a.company_id, ae_id: aeId });
  };

  const aeLabel = (a: ObAccount) => a.ae_id ? (aeName(a.ae_id) || a.hs_ae_name || `Owner ${a.ae_id}`) : "Unassigned";
  const scoped = accounts.filter((a) => showPost || !a.post_sqa);
  const counts = useMemo(() => { const m: Record<string, number> = { all: scoped.length }; for (const a of scoped) m[a.bucket] = (m[a.bucket] ?? 0) + 1; return m; }, [scoped]);
  const aeOpts = useMemo(() => Array.from(new Set(scoped.map((a) => a.ae_id).filter(Boolean))).map((id) => [id, aeName(id) || scoped.find((a) => a.ae_id === id)?.hs_ae_name || id] as [string, string]).sort((x, y) => x[1].localeCompare(y[1])), [scoped, pods]);
  const segOpts = useMemo(() => Array.from(new Set(scoped.map((a) => a.segment).filter(Boolean))).sort(), [scoped]);
  const playOpts = useMemo(() => Array.from(new Set(scoped.map((a) => a.play).filter(Boolean))).sort(), [scoped]);
  const needle = search.trim().toLowerCase();
  const rows = scoped.filter((a) => {
    if (bucket !== "all" && a.bucket !== bucket) return false;
    if (aeFilter === "unassigned" && a.ae_id) return false;
    if (aeFilter !== "any" && aeFilter !== "unassigned" && a.ae_id !== aeFilter) return false;
    if (segFilter !== "any" && a.segment !== segFilter) return false;
    if (playFilter !== "any" && a.play !== playFilter) return false;
    if (!needle) return true;
    return [a.company, a.domain, aeLabel(a), ...a.contacts.map((c) => `${c.contact_name} ${c.email} ${c.title}`)].some((v) => (v || "").toLowerCase().includes(needle));
  }).sort((x, y) => {
    switch (sortBy) {
      case "stale": return (x.last_touch ?? 0) - (y.last_touch ?? 0);
      case "recent": return (y.last_touch ?? 0) - (x.last_touch ?? 0);
      case "contacts": return y.contacts.length - x.contacts.length;
      case "company": return x.company.localeCompare(y.company);
      case "segment": { const rk: any = { ENT: 0, MM: 1, SMB: 2, Micro: 3 }; return (rk[x.segment] ?? 9) - (rk[y.segment] ?? 9); }
      default: return x.prio - y.prio;
    }
  });
  const cur = rows.find((a) => a.company_id === selected) ?? rows[0];
  const loading = !accounts.length && (q.isLoading || ovQ.isLoading);
  const [obShown, setObShown] = useState(50);

  const ObTag = ({ s }: { s: Sig }) => {
    const col = OB_SIG[s.sig]?.color ?? (s.sig === "Single-threaded" ? "#f783ac" : C.muted);
    return <span title={s.handled ? "Touched since" : ""} style={{ fontSize: fs(10.5), padding: UI.solid ? "2px 9px" : "1px 7px", borderRadius: UI.solid ? 999 : 3, border: `1px solid ${UI.game ? "#9a9a9a" : col + "55"}`, color: UI.game ? C.text : col, background: UI.game ? "#ffffff" : `${col}14`, fontWeight: 400, whiteSpace: "nowrap", opacity: s.handled ? 0.45 : 1, textDecoration: s.handled ? "line-through" : "none" }}>{UI.game && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: col, marginRight: 5 }} />}{s.sig}</span>;
  };

  return (
    <div style={{ background: UI.game ? "transparent" : C.page, color: C.text, padding: 18, fontFamily: UI.body }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: fs(10), letterSpacing: 2, color: C.accent }}>BDR TERMINAL // OUTBOUND</div>
          <h1 style={{ fontSize: UI.game ? fs(20) : 21, fontWeight: 800, margin: UI.game ? "8px 0 4px" : "2px 0 0", fontFamily: UI.pixel }}>Accounts</h1>
          <div style={{ fontSize: fs(11), color: C.muted, marginTop: 2 }}>
            {loading ? "loading…" : `${scoped.length} accounts · ${scoped.reduce((n, a) => n + a.contacts.length, 0)} Apollo contacts · ${counts.hot ?? 0} hot · ${counts.followup ?? 0} need follow-up`}
            {" · queues + acting-as follow the Signal Feed selectors"}
          </div>
        </div>
        {runMsg && <span style={{ fontSize: fs(10.5), color: runMsg.startsWith("✗") ? C.danger : C.accent }}>{runMsg}</span>}
      </div>

      {!loading && (
        <DialogBox>
          {counts.hot ?? 0} account{(counts.hot ?? 0) === 1 ? " is" : "s are"} heating up! {counts.followup ?? 0} need a follow-up{counts.retouch_due ? `, ${counts.retouch_due} retouch${counts.retouch_due > 1 ? "es" : ""} due` : ""}. Where will you go?
        </DialogBox>
      )}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 10, flexWrap: "wrap" }}>
        {OB_BUCKETS.map((b) => {
          const on = bucket === b.id;
          return (
            <button key={b.id} title={b.hint} onClick={() => { setBucket(b.id); setSelected(null); }} style={{ padding: "6px 12px", fontSize: fs(11.5), fontFamily: "inherit", cursor: "pointer", border: "none",
              borderBottom: `2px solid ${on ? C.accent : "transparent"}`, background: "transparent", color: on ? C.accent : C.muted, fontWeight: on ? 700 : 400 }}>
              {b.label} <span style={{ color: on ? C.text : C.faint }}>{counts[b.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ ...ctl, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
          <Search size={12} color={C.faint} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="company, domain, person, title, AE"
            style={{ background: "transparent", color: C.text, border: "none", outline: "none", fontSize: fs(11.5), fontFamily: "inherit", width: 190 }} />
        </div>
        <Select label="AE" value={aeFilter} onChange={setAeFilter} options={[["any", "any"], ["unassigned", "Unassigned"], ...aeOpts]} />
        <Select label="Segment" value={segFilter} onChange={setSegFilter} options={[["any", "any"], ...segOpts.map((s) => [s, s] as [string, string])]} />
        <Select label="Play" value={playFilter} onChange={setPlayFilter} options={[["any", "any"], ...playOpts.map((s) => [s, s] as [string, string])]} />
        <Select label="Sort" value={sortBy} onChange={setSortBy} options={[["priority", "priority"], ["stale", "longest since touch"], ["recent", "most recently touched"], ["contacts", "most contacts"], ["segment", "segment (ENT→Micro)"], ["company", "company A–Z"]]} />
        <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showPost} onChange={(e) => setShowPost(e.target.checked)} /> post-SQA
        </label>
        <span style={{ fontSize: fs(10.5), color: C.faint }}>{rows.length} shown</span>
      </div>

      {q.isError ? <div style={{ color: C.danger, fontSize: fs(12) }}>{String(q.error)}</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
          <div style={{ ...PANEL(), maxHeight: 660, overflowY: "auto" }}>
            {loading ? <div style={{ padding: 12 }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: 46, background: C.surfaceAlt, borderRadius: UI.radius2, marginBottom: 8 }} />)}</div>
              : rows.length === 0 ? <div style={{ padding: 16, fontSize: fs(12), color: C.muted }}>Nothing here.</div>
              : rows.slice(0, obShown).map((a) => {
                const on = cur?.company_id === a.company_id;
                const d = daysSince(a.last_touch);
                return (
                  <div key={a.company_id} onClick={() => { setSelected(a.company_id); setDraftFor(null); }} style={{ padding: "8px 11px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${on ? C.accent : "transparent"}`, background: on ? (UI.game ? C.accentDim : C.surfaceAlt) : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: fs(12.5), fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{UI.game && on ? "▶ " : ""}{a.company}</span>
                      <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                        {!a.company_id.startsWith("nocompany") && <a href={HS_COMPANY(a.company_id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="HubSpot company" style={miniLink("#ff7a59")}>HS</a>}
                        <span style={{ fontSize: fs(10), color: d == null ? C.faint : d > 7 ? C.danger : C.faint }}>{d == null ? "untouched" : `${d}d`}</span>
                      </span>
                    </div>
                    <div style={{ fontSize: fs(10.5), color: C.muted, margin: "2px 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.segment || "—"} · {a.worked}/{a.contacts.length} worked · AE {aeLabel(a)}{a.play ? ` · ${a.play}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {Array.from(new Map(a.signals.filter((s) => !s.handled).map((s) => [s.sig, s])).values()).slice(0, 3).map((s) => <ObTag key={s.sig} s={s} />)}
                      {a.retouch_on && <span style={{ fontSize: fs(10), color: C.warn }}>↻ {a.retouch_on}</span>}
                    </div>
                  </div>
                );
              })}
            {!loading && rows.length > obShown && (
              <button onClick={() => setObShown(obShown + 50)} style={{ ...btn(C.accent), margin: 10, width: "calc(100% - 20px)", justifyContent: "center" }}>
                Show 50 more ({rows.length - obShown} left)
              </button>
            )}
          </div>

          <div>
            {loading ? <div className="animate-pulse" style={{ height: 460, background: C.surface, borderRadius: UI.radius }} /> : !cur ? <div style={{ fontSize: fs(12), color: C.muted }}>Select an account.</div> : (
              <div style={{ ...PANEL(), padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: fs(17), fontWeight: 700 }}>{cur.company}</div>
                    <div style={{ fontSize: fs(11.5), color: C.muted, marginTop: 2 }}>
                      {[cur.domain, cur.segment, cur.play].filter(Boolean).join(" · ") || "—"}
                      {cur.post_sqa ? ` · post-SQA: ${cur.sqa_info || "qualified deal"}` : ""}
                    </div>
                    <div style={{ fontSize: fs(11), color: C.faint, marginTop: 2 }}>
                      {cur.worked}/{cur.contacts.length} contacts worked · last touch {fmtAgo(cur.last_touch)}{cur.last_by ? ` by ${cur.last_by}` : ""} · queue: {bdrName(cur.owner_id)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                    {!cur.company_id.startsWith("nocompany") && <a href={HS_COMPANY(cur.company_id)} target="_blank" rel="noopener noreferrer" style={{ ...btn("#ff7a59"), textDecoration: "none" }}>HubSpot company <ExternalLink size={11} /></a>}
                    {cur.domain && <a href={`https://${cur.domain}`} target="_blank" rel="noopener noreferrer" style={{ ...btn(C.muted), textDecoration: "none" }}>{cur.domain} <ExternalLink size={11} /></a>}
                  </div>
                </div>

                <Section title="AE">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontSize: fs(13) }}>{aeLabel(cur)}</b>
                    <span style={{ fontSize: fs(10.5), color: C.faint }}>{cur.ae_source === "override" ? "(set in terminal)" : cur.ae_source === "hubspot" ? "(from HubSpot)" : `(pod: ${podOf(cur.owner_id).map((p) => S(p.ae_name).split(" ")[0]).join(" / ") || "none"})`}</span>
                    {cur.owner_id === acting && !cur.company_id.startsWith("nocompany") ? (
                      <select disabled={busy} value="" onChange={(e) => e.target.value && assignAe(cur, e.target.value === "__clear" ? "" : e.target.value)} style={{ ...ctl, cursor: "pointer" }}>
                        <option value="">Assign AE…</option>
                        {podOf(acting).map((p) => <option key={S(p.ae_id)} value={S(p.ae_id)}>{S(p.ae_name)} (my pod)</option>)}
                        <optgroup label="Other pods">
                          {pods.filter((p) => S(p.bdr_id) !== acting).map((p) => <option key={S(p.ae_id)} value={S(p.ae_id)}>{S(p.ae_name)} · {S(p.territory) || "—"}</option>)}
                        </optgroup>
                        {cur.ae_source === "override" && <option value="__clear">Clear terminal override</option>}
                      </select>
                    ) : <span style={{ fontSize: fs(10.5), color: C.faint, display: "inline-flex", gap: 4, alignItems: "center" }}><Lock size={11} /> only {bdrName(cur.owner_id)} can change</span>}
                  </div>
                </Section>

                <Section title={`CONTACTS (${cur.contacts.length})`}>
                  {[...cur.contacts].sort((x, y) => Math.min(...x.signals.filter((s) => !s.handled).map((s) => s.rnk), 9) - Math.min(...y.signals.filter((s) => !s.handled).map((s) => s.rnk), 9)).map((c) => {
                    const mine = c.owner_id === acting;
                    const dis = !mine || busy;
                    const asRow: any = { ...c, company: cur.company, queue_owner_id: c.owner_id, unhandled: c.signals.filter((s) => !s.handled) };
                    return (
                      <div key={c.contact_id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: fs(12.5), fontWeight: 700 }}>{c.contact_name || c.email}</div>
                            <div style={{ fontSize: fs(10.5), color: C.muted }}>{c.title || "—"} · {c.email}</div>
                            <div style={{ fontSize: fs(10.5), color: C.faint, marginTop: 2 }}>
                              last touch {fmtAgo(c.last_touch)}{c.last_by ? ` · ${c.last_by} · ${c.last_channel}` : ""} · {c.touches_14d} touches/14d · {c.calls_total} calls ({c.calls_connected} conn){c.in_sequence ? " · in sequence" : ""}
                              {c.ov?.linkedin_status ? ` · LI: ${c.ov.linkedin_status.replace("linkedin_", "").replace("_", " ")}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 4, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <a href={HS_CONTACT(c.contact_id)} target="_blank" rel="noopener noreferrer" style={{ ...btn("#ff7a59"), textDecoration: "none", padding: "2px 7px" }}>HS</a>
                            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ ...btn("#5fb3ff"), textDecoration: "none", padding: "2px 7px" }}><Linkedin size={11} /></a>}
                            <button style={{ ...btn(C.accent), padding: "2px 7px" }} onClick={() => setDraftFor(draftFor === c.contact_id ? null : c.contact_id)}><Sparkles size={11} /> Draft</button>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                          {c.signals.map((s) => <ObTag key={s.sig} s={s} />)}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                          {[["linkedin_request_sent", "LI sent"], ["linkedin_accepted", "LI accepted"], ["linkedin_message", "LI msg"], ["linkedin_reply", "LI reply"]].map(([t, l]) => (
                            <button key={t} disabled={dis} onClick={() => actContact(c, t)} style={{ ...btn("#5fb3ff", dis), padding: "1px 7px", fontSize: fs(10.5) }}>{l}</button>
                          ))}
                          {[3, 7, 14].map((dd) => <button key={dd} disabled={dis} onClick={() => actContact(c, "retouch_set", { days: dd })} style={{ ...btn(C.warn, dis), padding: "1px 7px", fontSize: fs(10.5) }}>↻ {dd}d</button>)}
                          {c.ov?.retouch_on && <button disabled={dis} onClick={() => actContact(c, "retouch_clear")} style={{ ...btn(C.muted, dis), padding: "1px 7px", fontSize: fs(10.5) }}>clear ↻ {c.ov.retouch_on}</button>}
                          {!mine && <span style={{ fontSize: fs(10), color: C.faint, alignSelf: "center" }}><Lock size={10} /> {bdrName(c.owner_id)}'s contact</span>}
                        </div>
                        {draftFor === c.contact_id && (
                          <div style={{ marginTop: 8, padding: 10, background: C.surfaceAlt, borderRadius: UI.radius2 }}>
                            <DraftBox r={asRow} acting={acting} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Section>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ fontSize: fs(10), color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
        Outbound = contacts created via the Apollo integration. "Untouched" = no email/call/meeting in HubSpot and nothing logged here; if Apollo sequence activity isn't syncing to HubSpot, it won't show as a touch.
        AE overrides are saved in the terminal (not HubSpot yet). Changes from other viewers appear within ~1 min.
      </div>
    </div>
  );
}

function SignalFeed() {
  const [acting, setActing] = useDiveState<string>("acting", "89400804");
  const [owners, setOwners] = useDiveState<string[]>("owners", ["89400804"]);
  const [bucket, setBucket] = useDiveState<string>("bucket", "active");
  const [sigSel, setSigSel] = useDiveState<string[]>("sigs", []);
  const [stage, setStage] = useDiveState<string>("stage", "any");
  const [plan, setPlan] = useDiveState<string>("plan", "any");
  const [touchedBy, setTouchedBy] = useDiveState<string>("touchedBy", "any");
  const [fresh, setFresh] = useDiveState<string>("fresh", "any");
  const [createdWin, setCreatedWin] = useDiveState<string>("created", "any");
  const [hasLi, setHasLi] = useDiveState<boolean>("hasLi", false);
  const [opened, setOpened] = useDiveState<string>("opened", "any");
  const [pages, setPages] = useDiveState<string[]>("pages", []);
  const [showPost, setShowPost] = useDiveState<boolean>("showPost", false);
  const [sortBy, setSortBy] = useDiveState<string>("sort", "priority");
  const [sortDir, setSortDir] = useDiveState<string>("dir", "asc");
  const [selected, setSelected] = useDiveState<string | null>("sel", null);
  const [search, setSearch] = useState("");
  const [draftSel, setDraftSel] = useDiveState<DraftReq[]>("draftSel", []);
  const [, setTab] = useDiveState<string>("tab", "feed");
  const draftList: DraftReq[] = Array.isArray(draftSel) ? draftSel : [];
  const draftIds = new Set(draftList.map((d) => d.id));
  const mkDraft = (r: Row): DraftReq => {
    const pool = r.unhandled.length ? r.unhandled : r.signals;
    const sig = pool.map((s) => s.sig + (s.detail ? ` (${s.detail})` : "")).join("; ") + (r.ov?.last_note ? `; BDR note: ${r.ov.last_note}` : "");
    return { id: r.contact_id, name: r.contact_name || r.email, company: r.company, sig, tpl: SIG_TO_TPL[pool[0]?.sig ?? ""] ?? "custom", owner: r.queue_owner_id };
  };
  const toggleDraft = (r: Row) => {
    if (draftIds.has(r.contact_id)) setDraftSel(draftList.filter((d) => d.id !== r.contact_id));
    else if (draftList.length < 15) setDraftSel([...draftList, mkDraft(r)]);
  };

  const [pending, setPending] = useState<Record<string, Partial<Ov>>>({});

  const ownerIds = (Array.isArray(owners) ? owners : []).filter((o) => /^\d+$/.test(o));
  const scopeIds = ownerIds.length ? ownerIds : ["89400804"];

  // 1) overlay (personal DB). Failure is tolerated: the feed still works read-only.
  const ovQ = useSQLQuery(overlaySql);
  const ovRows: any[] = Array.isArray(ovQ.data) ? ovQ.data : [];
  const ovMap = useMemo(() => {
    const m: Record<string, Ov> = {};
    for (const r of ovRows) m[S(r.contact_id)] = toOv(r);
    for (const [k, p] of Object.entries(pending)) m[k] = { ...(m[k] ?? toOv({})), ...p } as Ov;
    return m;
  }, [ovQ.data, pending]);
  const extraIds = ovRows.filter((r) => r.retouch_on).map((r) => S(r.contact_id)).filter((x) => /^\d+$/.test(x)).slice(0, 500);
  // freeze the retouch id list after the first overlay load: saves must not change the main query (that caused full reloads + page jumps)
  const extraRef = useRef<string | null>(null);
  if (extraRef.current === null && !ovQ.isLoading) extraRef.current = extraIds.length ? extraIds.map((x) => `'${x}'`).join(",") : "'-1'";
  const extraSql = extraRef.current ?? "'-1'";
  const ownersSql = scopeIds.map((x) => `'${x}'`).join(",");

  // 2) main queue
  const sql = useMemo(() => queueSql(ownersSql, extraSql), [ownersSql, extraSql]);
  const q = useSQLQuery(sql, { enabled: extraRef.current !== null });
  // keep showing the last good list while anything refetches
  const lastRows = useRef<Row[]>([]);
  const rows: Row[] = useMemo(() => { if (Array.isArray(q.data)) lastRows.current = q.data.map(toRow); return lastRows.current; }, [q.data]);
  const firstLoad = rows.length === 0 && (q.isLoading || ovQ.isLoading || extraRef.current === null);
  const [shown, setShown] = useState(50);
  const [showRecipe, setShowRecipe] = useState(false);
  const [copyBox, setCopyBox] = useState("");
  const [copied, setCopied] = useState("");
  const copyText = (label: string, text: string) => {
    try { navigator.clipboard.writeText(text).then(() => { setCopied(label); setCopyBox(""); setTimeout(() => setCopied(""), 2500); }, () => setCopyBox(text)); }
    catch { setCopyBox(text); }
  };
  const derived = useMemo(
    () => rows.filter((r) => scopeIds.includes(r.queue_owner_id)).map((r) => derive(r, ovMap[r.contact_id])),
    [rows, ovMap, ownersSql],
  );

  // 3) write path: batched action queue. Clicks apply instantly; one Flight run saves the batch.
  const aq = useActionQueue(acting, () => { ovQ.refetch(); setTimeout(() => ovQ.refetch(), 30000); setTimeout(() => ovQ.refetch(), 75000); });
  const busy = false;

  const act = (r: Row, type: string, extra: any = {}) => {
    if (r.queue_owner_id !== acting) return;
    const now = new Date().toISOString().slice(0, 19);
    const patch: Partial<Ov> = {};
    if (type === "reviewed") patch.reviewed_ts = T(now);
    if (type === "retouch_set") {
      const d = new Date(); d.setUTCDate(d.getUTCDate() + Number(extra.days || 1));
      patch.retouch_on = d.toISOString().slice(0, 10); patch.retouch_event_ts = T(now);
    }
    if (type === "retouch_clear") { patch.retouch_on = null; patch.retouch_event_ts = T(now); }
    if (type.startsWith("linkedin_")) { patch.linkedin_status = type; patch.last_linkedin_ts = T(now); patch.last_linkedin_actor = acting; patch.linkedin_14d = (r.ov?.linkedin_14d ?? 0) + 1; }
    if (type === "note") { patch.last_note = extra.note; patch.last_note_ts = T(now); }
    setPending((p) => ({ ...p, [r.contact_id]: { ...(p[r.contact_id] ?? {}), ...patch } }));
    // optimistic state holds for 15 min so a slow share sync never flips the contact back
    setTimeout(() => setPending((p) => { const n = { ...p }; delete n[r.contact_id]; return n; }), 900000);
    aq.enqueue({
      event_type: type, contact_id: r.contact_id,
      retouch_days: type === "retouch_set" ? String(extra.days) : undefined, note: type === "note" ? String(extra.note).slice(0, 2000) : undefined,
    });
    if (type === "reviewed" || type === "retouch_set") {
      const idx = sorted.findIndex((x) => x.contact_id === r.contact_id);
      const nxt = sorted[idx + 1] ?? sorted[idx - 1];
      if (nxt) setSelected(nxt.contact_id);
    }
  };

  const scoped = derived.filter((r) => showPost || !r.post_sqa);
  const bucketCounts = useMemo(() => {
    const m: Record<string, number> = { all: scoped.length };
    for (const r of scoped) m[r.bucket] = (m[r.bucket] ?? 0) + 1;
    return m;
  }, [scoped]);
  const inBucket = scoped.filter((r) => bucket === "all" || r.bucket === bucket);
  const sigCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of inBucket) for (const k of new Set(r.signals.map((s) => chipKey(s.sig)))) m[k] = (m[k] ?? 0) + 1;
    return m;
  }, [inBucket]);
  const stages = useMemo(() => Array.from(new Set(scoped.map((r) => r.lifecycle).filter(Boolean))).sort(), [scoped]);
  const plans = useMemo(() => Array.from(new Set(scoped.map((r) => r.plan).filter(Boolean))).sort(), [scoped]);

  const needle = search.trim().toLowerCase();
  const filtered = inBucket.filter((r) => {
    if (sigSel.length && !r.signals.some((s) => sigSel.includes(chipKey(s.sig)))) return false;
    if (stage !== "any" && r.lifecycle !== stage) return false;
    if (plan !== "any" && r.plan !== plan) return false;
    if (hasLi && !r.linkedin_url) return false;
    if (opened !== "any") {
      const od = daysSince(r.last_opened);
      if (opened === "never" && r.last_opened != null) return false;
      if (opened === "since_touch" && !(r.last_opened != null && (r.last_touch == null || r.last_opened > r.last_touch))) return false;
      if (opened === "le1" && !(od != null && od <= 1)) return false;
      if (opened === "le3" && !(od != null && od <= 3)) return false;
      if (opened === "le7" && !(od != null && od <= 7)) return false;
      if (opened === "clicked" && !(r.last_clicked != null && (r.last_touch == null || r.last_clicked > r.last_touch))) return false;
    }
    if (pages.length && !pages.some((p) => r.page_cats.includes(p))) return false;
    if (touchedBy !== "any") {
      const id = r.last_by_id;
      if (touchedBy === "never" && r.last_touch != null) return false;
      if (touchedBy === "me" && id !== acting) return false;
      if (touchedBy === "owner" && id !== r.queue_owner_id) return false;
      if (touchedBy === "other_bdr" && !(id && ROSTER.has(id) && id !== r.queue_owner_id)) return false;
      if (touchedBy === "ae" && !(id && !ROSTER.has(id))) return false;
    }
    if (fresh !== "any") {
      const d = daysSince(r.last_touch);
      if (fresh === "never" && d != null) return false;
      if (fresh === "gt7" && !(d == null || d > 7)) return false;
      if (fresh === "gt3" && !(d == null || d > 3)) return false;
      if (fresh === "le7" && !(d != null && d <= 7)) return false;
    }
    if (createdWin !== "any") {
      const d = daysSince(r.created);
      if (d == null || d > Number(createdWin)) return false;
    }
    if (!needle) return true;
    return [r.contact_name, r.email, r.company, r.ae_name, r.last_by, r.org_name].some((v) => (v || "").toLowerCase().includes(needle));
  });

  const sortVal = (r: Row): number | string => {
    switch (sortBy) {
      case "signal_new": return -Math.max(...r.signals.map((s) => s.ts ?? 0), 0);
      case "stale": return -(daysSince(r.last_touch) ?? 9999);
      case "created_new": return -(r.created ?? 0);
      case "created_old": return r.created ?? 0;
      case "awr": return -r.awr;
      case "cpu": return -r.cpu_7d;
      case "trial_end": return r.trial_end_date || "9999";
      case "touches": return r.touches_14d + (r.ov?.linkedin_14d ?? 0);
      case "stl": return -(r.speed_to_lead_hrs ?? -1);
      case "owner": return bdrName(r.queue_owner_id);
      case "company": return (r.company || "~").toLowerCase();
      default: return r.prio;
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const current = sorted.find((r) => r.contact_id === selected) ?? sorted[0];
  useEffect(() => { setShown(50); }, [bucket, sortBy, sortDir, search, sigSel.join(","), opened, pages.join(","), createdWin, hasLi, ownersSql]);
  useEffect(() => { const i = sorted.findIndex((x) => x.contact_id === current?.contact_id); if (i >= shown) setShown(i + 25); }, [current?.contact_id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = sorted.findIndex((x) => x.contact_id === current?.contact_id);
      if (e.key === "j" || e.key === "ArrowDown") { const n = sorted[idx + 1]; if (n) { setSelected(n.contact_id); e.preventDefault(); } return; }
      if (e.key === "k" || e.key === "ArrowUp") { const n = sorted[idx - 1]; if (n) { setSelected(n.contact_id); e.preventDefault(); } return; }
      if (!current) return;
      if (e.key === "r") act(current, "reviewed");
      else if (e.key === "3" || e.key === "7") act(current, "retouch_set", { days: Number(e.key) });
      else if (e.key === "f") act(current, "retouch_set", { days: 14 });
      else if (e.key === "h") window.open(HS_CONTACT(current.contact_id), "_blank", "noopener");
      else if (e.key === "l" && current.linkedin_url) window.open(current.linkedin_url, "_blank", "noopener");
      else if (e.key === "x") toggleDraft(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const multiOwner = scopeIds.length > 1;
  const activeFilters = sigSel.length + (stage !== "any" ? 1 : 0) + (plan !== "any" ? 1 : 0) + (touchedBy !== "any" ? 1 : 0) +
    (fresh !== "any" ? 1 : 0) + (createdWin !== "any" ? 1 : 0) + (hasLi ? 1 : 0) + (search ? 1 : 0) + (opened !== "any" ? 1 : 0) + (pages.length ? 1 : 0);
  const resetFilters = () => { setSigSel([]); setStage("any"); setPlan("any"); setTouchedBy("any"); setFresh("any"); setCreatedWin("any"); setHasLi(false); setSearch(""); setOpened("any"); setPages([]); };

  // HubSpot bar: lives inside the dialog box in the Unova theme, in the header otherwise.
  const hsButtons = (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <a href={HS_INDEX} target="_blank" rel="noopener noreferrer" style={{ ...btn("#ff7a59"), textDecoration: "none" }}><ExternalLink size={12} /> Open in HubSpot</a>
      <button style={btn(C.accent)} onClick={() => copyText("filters", hubspotRecipe({ owners: scopeIds, bucket, sigs: sigSel, opened, pages, hasLi, createdWin }).join("\nAND "))}>Copy HubSpot filters</button>
      <button style={btn(C.accent)} onClick={() => copyText("emails", sorted.map((r) => r.email).filter(Boolean).join(", "))}>Copy {sorted.filter((r) => r.email).length} emails</button>
      <button style={btn(C.muted)} onClick={() => setShowRecipe(!showRecipe)}>{showRecipe ? "Hide" : "Show"} filter recipe</button>
      {copied && <span style={{ fontSize: fs(10.5), color: C.ok }}>✓ {copied} copied</span>}
    </div>
  );
  const hsPanels = (
    <>
      {showRecipe && (
        <div style={{ ...PANEL(), padding: 12, marginTop: 8, fontSize: fs(11.5), lineHeight: 1.6, maxWidth: 760 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>HubSpot filters for this view ({sorted.length} contacts here)</div>
          {hubspotRecipe({ owners: scopeIds, bucket, sigs: sigSel, opened, pages, hasLi, createdWin }).map((l, i) => (
            <div key={i} style={{ color: l.includes("NOT IN HUBSPOT") || l.startsWith("TERMINAL-ONLY") ? C.warn : C.text }}>{i ? "AND " : ""}{l}</div>
          ))}
          <div style={{ color: C.faint, marginTop: 6 }}>In HubSpot: Contacts → All contacts → Advanced filters, add each line, then save it as a view. Lines marked NOT IN HUBSPOT / TERMINAL-ONLY can't be filtered there; use Copy emails to compare lists exactly.</div>
        </div>
      )}
      {copyBox && (
        <div style={{ marginTop: 8, maxWidth: 760 }}>
          <div style={{ fontSize: fs(10.5), color: C.muted, marginBottom: 4 }}>Your browser blocked the clipboard here. Select all and copy:</div>
          <textarea readOnly value={copyBox} onFocus={(e) => e.currentTarget.select()} rows={4} style={{ ...ctl, width: "100%" }} />
        </div>
      )}
    </>
  );

  return (
    <div style={{ background: UI.game ? "transparent" : C.page, color: C.text, minHeight: "100%", padding: 18, fontFamily: UI.body }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: fs(10), letterSpacing: 2, color: C.accent }}>BDR TERMINAL // INBOUND</div>
          <h1 style={{ fontSize: UI.game ? fs(20) : 21, fontWeight: 800, margin: UI.game ? "8px 0 4px" : "2px 0 0", fontFamily: UI.pixel }}>Signal Feed</h1>
          <div style={{ fontSize: fs(11), color: C.muted, marginTop: 2 }}>
            {firstLoad ? "loading…" : `${scoped.length} contacts in scope · ${bucketCounts.active ?? 0} active · ${bucketCounts.retouch_due ?? 0} retouch due`}
            {ovQ.isError ? " · overlay unavailable (read-only)" : ""}
            {aq.msg ? <span style={{ color: aq.msg.startsWith("✗") ? C.danger : C.accent }}> · {aq.msg}</span> : null}
          </div>
          {!UI.game && hsButtons}
          {!UI.game && hsPanels}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: fs(10.5), color: C.faint }}>
            Acting as
            <select value={acting} onChange={(e) => setActing(e.target.value)} style={{ ...ctl, cursor: "pointer", color: C.accent }}>
              {BDRS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <BdrMultiSelect selected={scopeIds} onChange={(v) => { setOwners(v); setSelected(null); }} />
        </div>
      </div>

      {!firstLoad && (
        <DialogBox>
          {bucketCounts.active ?? 0} wild lead{(bucketCounts.active ?? 0) === 1 ? "" : "s"} appeared!{" "}
          {(() => { const hr = scoped.filter((r) => r.unhandled.some((s) => s.sig === "Hand-raiser")).length; return hr ? `${hr} hand-raiser${hr > 1 ? "s" : ""} want${hr > 1 ? "" : "s"} to talk. ` : ""; })()}
          {bucketCounts.retouch_due ? `${bucketCounts.retouch_due} retouch${bucketCounts.retouch_due > 1 ? "es" : ""} due. ` : ""}
          What will {bdrName(acting).split(" ")[0] || "you"} do?
          {hsButtons}
        </DialogBox>
      )}
      {UI.game && hsPanels}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 10, flexWrap: "wrap" }}>
        {BUCKETS.map((b) => {
          const on = bucket === b.id;
          return (
            <button key={b.id} title={b.hint} onClick={() => { setBucket(b.id); setSelected(null); }} style={{
              padding: "6px 12px", fontSize: fs(11.5), fontFamily: "inherit", cursor: "pointer", border: "none",
              borderBottom: `2px solid ${on ? C.accent : "transparent"}`, background: "transparent", color: on ? C.accent : C.muted, fontWeight: on ? 700 : 400,
            }}>
              {b.label} <span style={{ color: on ? C.text : C.faint }}>{bucketCounts[b.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {CHIPS.map(([k, col]) => (
          <Chip key={k} label={k} color={col} count={sigCounts[k] ?? 0} active={sigSel.includes(k)}
            onClick={() => setSigSel(sigSel.includes(k) ? sigSel.filter((x) => x !== k) : [...sigSel, k])} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <div style={{ ...ctl, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
          <Search size={12} color={C.faint} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="name, company, AE, toucher"
            style={{ background: "transparent", color: C.text, border: "none", outline: "none", fontSize: fs(11.5), fontFamily: "inherit", width: 170 }} />
        </div>
        <Select label="Last touch by" value={touchedBy} onChange={setTouchedBy} options={[["any", "anyone"], ["me", "me (acting)"], ["owner", "queue owner"], ["other_bdr", "another BDR"], ["ae", "AE / non-BDR"], ["never", "never touched"]]} />
        <Select label="Freshness" value={fresh} onChange={setFresh} options={[["any", "any"], ["never", "never touched"], ["gt3", "> 3d since touch"], ["gt7", "> 7d since touch"], ["le7", "touched ≤ 7d"]]} />
        <Select label="Email opened" value={opened} onChange={setOpened} options={[["any", "any"], ["since_touch", "since our last touch"], ["le1", "≤ 1d ago"], ["le3", "≤ 3d ago"], ["le7", "≤ 7d ago"], ["clicked", "clicked since last touch"], ["never", "never opened"]]} />
        <MultiPick label="Pages viewed" options={["Pricing", "Docs", "Product", "Blog", "Trial / ad landing", "Books / courses", "Events", "Contact / customers", "Homepage", "Careers"]} selected={Array.isArray(pages) ? pages : []} onChange={setPages} />
        <Select label="Created" value={createdWin} onChange={setCreatedWin} options={[["any", "any time"], ["1", "≤ 1d"], ["3", "≤ 3d"], ["7", "≤ 7d"], ["30", "≤ 30d"], ["90", "≤ 90d"]]} />
        <Select label="Stage" value={stage} onChange={setStage} options={[["any", "any"], ...stages.map((s) => [s, s] as [string, string])]} />
        <Select label="Plan" value={plan} onChange={setPlan} options={[["any", "any"], ...plans.map((s) => [s, s.replace("_", " ")] as [string, string])]} />
        <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={hasLi} onChange={(e) => setHasLi(e.target.checked)} /> has LinkedIn
        </label>
        <label style={{ fontSize: fs(10.5), color: C.muted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showPost} onChange={(e) => setShowPost(e.target.checked)} /> post-SQA
        </label>
        <Select label="Sort" value={sortBy} onChange={setSortBy} options={[
          ["priority", "priority"], ["signal_new", "newest signal"], ["stale", "longest since touch"], ["created_new", "created: newest"],
          ["created_old", "created: oldest"], ["stl", "slowest speed-to-lead"], ["touches", "fewest touches (14d)"], ["awr", "AWR"],
          ["cpu", "CPU 7d"], ["trial_end", "trial ending soonest"], ["owner", "queue owner"], ["company", "company A–Z"],
        ]} />
        <button style={{ ...ctl, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
          <ArrowUpDown size={12} /> {sortDir === "asc" ? "asc" : "desc"}
        </button>
        <button style={btn(C.accent, draftIds.size === 0)} disabled={draftIds.size === 0} onClick={() => setTab("drafts")}><Mail size={12} /> Draft {draftIds.size}</button>
        <button style={{ ...ctl, cursor: "pointer" }} title="Select the top contacts in the current view (max 15)"
          onClick={() => setDraftSel([...draftList, ...sorted.filter((r) => !draftIds.has(r.contact_id)).slice(0, Math.max(0, 15 - draftList.length)).map(mkDraft)])}>select top</button>
        {draftIds.size > 0 && <button style={{ ...ctl, cursor: "pointer", color: C.faint }} onClick={() => setDraftSel([])}>clear sel</button>}
        {activeFilters > 0 && <button style={{ ...ctl, cursor: "pointer", color: C.warn }} onClick={resetFilters}>reset {activeFilters} filter{activeFilters > 1 ? "s" : ""}</button>}
        <span style={{ fontSize: fs(10.5), color: C.faint }}>{sorted.length} shown</span>
      </div>

      {q.isError ? (
        <div role="alert" style={{ color: C.danger, fontSize: fs(12) }}>{String(q.error)}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 370px) 1fr", gap: 12 }}>
          <div style={{ ...PANEL(), maxHeight: 640, overflowY: "auto" }}>
            {firstLoad ? (
              <div style={{ padding: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse" style={{ height: 46, background: C.surfaceAlt, borderRadius: UI.radius2, marginBottom: 8 }} />)}
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 16, fontSize: fs(12), color: C.muted }}>Nothing here. {bucket === "active" ? "Queue clear — nice." : ""}</div>
            ) : sorted.slice(0, shown).map((r) => {
              const on = current?.contact_id === r.contact_id;
              const lead = r.unhandled[0]?.sig ?? r.signals[0]?.sig ?? "";
              const d = daysSince(r.last_touch);
              return (
                <div key={r.contact_id} onClick={() => setSelected(r.contact_id)} style={{
                  padding: "8px 11px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${on ? (UI.game ? C.accent : sigMeta(lead).color) : "transparent"}`, background: on ? (UI.game ? C.accentDim : C.surfaceAlt) : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: fs(12.5), fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={draftIds.has(r.contact_id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleDraft(r)} title="Select for AI draft" style={{ marginRight: 6, verticalAlign: "middle", cursor: "pointer" }} />{multiOwner && <span style={{ fontSize: fs(9.5), color: C.page, background: r.queue_owner_id === acting ? C.accent : C.muted, borderRadius: 3, padding: "0 4px", marginRight: 6 }}>{initials(bdrName(r.queue_owner_id))}</span>}
                      {UI.game && on ? "▶ " : ""}{r.contact_name || r.email}
                    </span>
                    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                      <a href={HS_CONTACT(r.contact_id)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open in HubSpot (h)" style={miniLink("#ff7a59")}>HS</a>
                      {r.linkedin_url
                        ? <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} title="Open LinkedIn (l)" style={miniLink("#5fb3ff")}><Linkedin size={10} /></a>
                        : <span title="No LinkedIn on file" style={{ ...miniLink(C.faint), opacity: 0.35, cursor: "default" }}><Linkedin size={10} /></span>}
                      <span style={{ fontSize: fs(10), color: d == null || d > 7 ? C.danger : C.faint }}>{d == null ? "untouched" : `${d}d`}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: fs(10.5), color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 5px" }}>
                    {r.company || "—"} · created {fmtAgo(r.created)}
                    {r.last_by && r.last_by_id !== r.queue_owner_id ? ` · last: ${r.last_by}` : ""}
                    {r.ov?.retouch_on ? ` · ↻ ${r.ov.retouch_on}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {r.signals.slice(0, 3).map((s) => <SignalTag key={s.sig} s={s} />)}
                    {r.signals.length > 3 && <span style={{ fontSize: fs(10), color: C.faint }}>+{r.signals.length - 3}</span>}
                  </div>
                </div>
              );
            })}
            {!firstLoad && sorted.length > shown && (
              <button onClick={() => setShown(shown + 50)} style={{ ...btn(C.accent), margin: 10, width: "calc(100% - 20px)", justifyContent: "center" }}>
                Show 50 more ({sorted.length - shown} left)
              </button>
            )}
          </div>
          <div style={{ position: "sticky", top: 8, alignSelf: "start" }}>
            {firstLoad ? <div className="animate-pulse" style={{ height: 460, background: C.surface, borderRadius: UI.radius }} />
              : current ? <Card key={current.contact_id} r={current} acting={acting} busy={busy} onAct={(t, x) => act(current, t, x)} runMsg={aq.msg} />
              : <div style={{ fontSize: fs(12), color: C.muted }}>Select a contact.</div>}
          </div>
        </div>
      )}

      <div style={{ fontSize: fs(10), color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
        <div>Signals look back 30 days; "Active" = signal ≤14d with no touch since.</div>
        <div>Last touch = latest email/call/meeting by anyone (BDR, AE, CE) + LinkedIn logged here.</div>
        <div>HubSpot syncs ~every 4h, usage/AWR nightly.</div>
        <div>Actions apply instantly and save in batches via the bdr_terminal_log_action Flight (MotherDuck only, never HubSpot); only the queue owner can write.</div>
        <div>Post-SQA = the contact or its company has an SQA (BDR Terminal rules) that is open, won, or lost in the last 180 days; older closed-lost SQAs recycle back into the queue.</div>
      </div>
    </div>
  );
}

function SettingsPanel({ theme, setTheme, size, setSize, onClose }: any) {
  const opt = (on: boolean): any => ({ ...ctl, cursor: "pointer", textAlign: "left", padding: "10px 12px", borderWidth: 2,
    borderColor: on ? C.accent : C.border, background: on ? C.accentDim : C.surface, color: C.text, display: "block", width: "100%" });
  return (
    <div style={{ position: "absolute", right: 18, top: "100%", marginTop: 6, zIndex: 50, width: 300, background: C.surface, color: C.text,
      border: `3px solid ${UI.game ? "#484848" : C.border}`, borderRadius: UI.radius, padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,.25)", fontFamily: UI.body }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: UI.pixel, fontSize: fs(9) }}>SETTINGS</span>
        <button onClick={onClose} style={{ ...ctl, cursor: "pointer", padding: "2px 8px" }}><X size={12} /></button>
      </div>
      <div style={{ fontSize: fs(10), color: C.faint, margin: "4px 0 6px", fontWeight: 700 }}>THEME</div>
      <div style={{ display: "grid", gap: 6 }}>
        <button style={opt(theme !== "terminal")} onClick={() => setTheme("unova")}>
          <b>Unova</b> <span style={{ color: C.faint }}>(default)</span><br />
          <span style={{ fontSize: fs(10.5), color: C.muted }}>DS-era battle UI: one pixel font, calm greys, colour only on actions</span>
        </button>
        <button style={opt(theme === "terminal")} onClick={() => setTheme("terminal")}>
          <b>Terminal</b><br />
          <span style={{ fontSize: fs(10.5), color: C.muted }}>The original dark green Game Boy terminal</span>
        </button>
      </div>
      <div style={{ fontSize: fs(10), color: C.faint, margin: "12px 0 6px", fontWeight: 700 }}>TEXT SIZE</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["s", "Small"], ["m", "Medium"], ["l", "Large"]].map(([id, l]) => (
          <button key={id} onClick={() => setSize(id)} style={{ ...opt(size === id), textAlign: "center", padding: "6px 8px" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

export default function BdrTerminal() {
  const [tab, setTab] = useDiveState<string>("tab", "feed");
  const [acting] = useDiveState<string>("acting", "89400804");
  const [theme, setTheme] = useDiveState<string>("theme", "unova");
  const [uiSize, setUiSize] = useDiveState<string>("uiSize", "m");
  const [showSettings, setShowSettings] = useState(false);
  applyTheme(theme === "terminal" ? "terminal" : "unova", uiSize);
  const game = UI.game;
  const me = bdrName(acting);
  const TABS: [string, string, string][] = [["feed", "▤ SIGNAL FEED", "INBOUND"], ["outbound", "◎ OUTBOUND", "OUTBOUND"], ["drafts", "✉ DRAFTS", "DRAFTS"], ["trainer", "◓ TRAINER", "TRAINER"], ["league", "♛ LEAGUE", "LEAGUE"]];
  const wrap: any = { padding: 18, background: game ? "transparent" : C.page, color: C.text };
  const rivet = (pos: any): any => ({ position: "absolute", width: 8, height: 8, borderRadius: 999, background: "#5fb3e6", boxShadow: "inset -1px -1px 0 #0a3550", ...pos });
  return (
    <div className="bdr-root" style={{ background: UI.bg, minHeight: "100%", color: C.text, fontFamily: UI.body }}>
      <style>{FONT_CSS}</style>
      {game && (tab === "feed" || tab === "outbound") && <TrainingShowcase bdr={acting} ob={tab === "outbound"} />}
      <div style={{ position: "relative", display: "flex", gap: game ? 8 : 2, padding: game ? "14px 18px 0" : "10px 18px 0", background: game ? "transparent" : C.page, alignItems: "center", flexWrap: "wrap" }}>
        {TABS.map(([id, label, short]) => {
          const on = tab === id;
          return game ? (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 16px", fontFamily: UI.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer", letterSpacing: 1,
              border: "2px solid #484848", borderRadius: 6, background: on ? "#3878c8" : "#ffffff", color: on ? "#ffffff" : "#303030",
              boxShadow: on ? "inset 0 -3px 0 #2858a0" : "inset 0 -3px 0 #d0d0d0" }}>{on ? "▶ " : ""}{short}</button>
          ) : (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "6px 14px", fontSize: fs(11.5), fontFamily: UI.body, cursor: "pointer", letterSpacing: 1,
              border: `1px solid ${on ? C.accent : C.border}`, borderBottom: "none", borderRadius: "6px 6px 0 0",
              background: on ? C.surface : C.page, color: on ? C.accent : C.muted, fontWeight: on ? 800 : 400,
            }}>{label}</button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button onClick={() => setShowSettings(!showSettings)} title="Settings" style={game
          ? { padding: "7px 14px", fontFamily: UI.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer", border: "2px solid #484848", borderRadius: 6, background: "#ffffff", color: "#303030", boxShadow: "inset 0 -3px 0 #d0d0d0" }
          : { ...ctl, cursor: "pointer", marginBottom: 4 }}>⚙ {game ? "SETTINGS" : "Settings"}</button>
        {showSettings && <SettingsPanel theme={theme} setTheme={setTheme} size={uiSize} setSize={setUiSize} onClose={() => setShowSettings(false)} />}
      </div>
      {tab === "trainer"
        ? <div style={wrap}><TrainerTab defaultTrainer={acting} /></div>
        : tab === "drafts"
        ? <div style={wrap}><DraftsTab /></div>
        : tab === "outbound"
        ? <OutboundFeed />
        : tab === "league"
        ? <div style={wrap}><LeagueTab /></div>
        : <SignalFeed />}
    </div>
  );
}
