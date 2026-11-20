/**
 * Sample rows for mock mode (no token), so layouts, filters and game visuals have something to draw.
 * Everything here is fictional. Only queries matched below return rows; everything else returns zero rows.
 */
const ROSTER_IDS = ["89400804", "89400805", "88175764", "95288851", "95672339", "96069408", "83119213", "102299028"];
// deterministic per-BDR spread so the League has a real leaderboard
const seed = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) / 997;
const gameRow = (ob: boolean, id = "89400804") => {
  const k = 0.35 + seed(id) * 1.1;
  const r = (n: number) => Math.round(n * k);
  return {
    sqas: ob ? r(4) : r(14), sqas_today: ob ? 0 : Math.round(seed(id) * 2),
    meetings: ob ? r(6) : r(20), meetings_today: ob ? Math.round(seed(id + "m") * 1.4) : Math.round(seed(id + "x") * 1.6),
    emails: r(900), emails_capped: r(850), emails_today: r(ob ? 18 : 24),
    calls: r(700), calls_capped: r(650), connects: r(40), calls_today: r(ob ? 20 : 35), connects_today: ob ? 1 : 2,
    linkedin: r(120), linkedin_capped: r(120), linkedin_today: r(ob ? 8 : 3),
    hygiene: r(300), hygiene_capped: r(280), hygiene_today: r(ob ? 4 : 12),
    accts_opened: r(30), accts_opened_today: ob ? 2 : 0, accts_multi: r(5), accts_multi_today: 0,
    active_days: 9,
  };
};
// Test switches in the preview URL:
//   ?mockXp=<n>  -> the acting BDR's XP total is exactly n (e.g. 17572 sits 4 EXP below Lv 26, to test level-up)
//   ?mockCap=1   -> today's LinkedIn (30) and queue hygiene (40) counts are at their daily caps
const qp = () => new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const tweak = (row: Record<string, number>) => {
  const xp = qp().get("mockXp");
  if (xp != null) Object.keys(row).forEach((k) => { if (k !== "active_days") row[k] = 0; }), (row.emails_capped = Number(xp));
  if (qp().has("mockCap")) { row.linkedin_today = 30; row.hygiene_today = 40; }
  return row;
};
const idIn = (sql: string) => /'(\d+)' AS bdr/.exec(sql)?.[1] ?? "89400804";

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 19);
const sigs = (...s: [string, number, number, string?][]) => JSON.stringify(s.map(([sig, rnk, h, detail]) => ({ sig, rnk, ts: ago(h), detail: detail ?? "" })));
const me = "89400804";

// inbound contacts: varied signals, buckets (touch after signal = handled), engagement and LinkedIn stages
type In = [id: string, name: string, title: string, company: string, signals: string, extra?: Record<string, unknown>];
const inbound: In[] = [
  ["9001", "Dana Whitfield", "Head of Data", "Acme", sigs(["Business offer request", 0, 5, "June 2026 Biz Offer Request Form"]), { page_views: 14, pricing_visits: 3, page_cats: "pricing|docs", last_opened_ts: ago(8) }],
  ["9002", "Sam Ortega", "Analytics Engineer", "Globex", sigs(["Hand-raiser", 0, 30, "Contact an Expert"]), { hs_li: "LinkedIn: Connection Requested", owner_id: "86070356", contact_owner_name: "Alex Mazur" }],
  ["9003", "Priya Natarajan", "VP Engineering", "Initech", sigs(["Trial spike", 3, 50, "4.1 CPU-h last 7d vs 0.8 prior"]), { cpu_7d: 4.1, cpu_prev7d: 0.8, plan: "Trial" }],
  ["9004", "Marcus Bell", "Data Platform Lead", "Umbrella Labs", sigs(["New lead", 1, 3, "Signed up via Google"]), { page_views: 6, page_cats: "docs" }],
  ["9005", "Lena Fischer", "Staff Data Engineer", "Hooli", sigs(["Email reply", 1, 9, "Re: quick question on DuckDB"]), { last_reply_ts: ago(9), last_opened_ts: ago(10) }],
  ["9006", "Tomás Rivera", "CTO", "Pied Piper", sigs(["Hand-raiser", 0, 70, "Pricing form"], ["Trial extension", 4, 90]), { pricing_visits: 2, page_views: 9, page_cats: "pricing|case-studies" }],
  ["9007", "Aisha Karim", "BI Manager", "Vandelay Industries", sigs(["Converted to Business", 2, 20, "Lite → Business"]), { plan: "Business" }],
  ["9008", "Owen Park", "Senior Analyst", "Stark Analytics", sigs(["Onboarding booked", 2, 40, "Onboarding call Thu"]) ],
  ["9009", "Grace Liu", "Data Scientist", "Wayne Data", sigs(["High AWR", 3, 60, "AWR $14k"]), { awr: 14000 }],
  ["9010", "Henry Adeyemi", "Eng Manager", "Tyrell Systems", sigs(["Event attended", 4, 100, "Small Data SF"]), { last_touch_ts: ago(30) }],
  ["9011", "Sofia Rossi", "Analytics Lead", "Cyberdyne", sigs(["Content download", 5, 26, "Lakehouse guide"]), { last_opened_ts: ago(4) }],
  ["9012", "Noah Grant", "Data Engineer", "Soylent Co", sigs(["Reactivation engaged", 4, 300, "Opened 3 emails"]) ],
  ["9013", "Mia Johansson", "Head of Analytics", "Oscorp", sigs(["Trial spike", 3, 400, "2.2 CPU-h"]) ],
  ["9014", "Ethan Brooks", "Founder", "Massive Dynamic", sigs(["New lead", 1, 200]), { last_touch_ts: ago(150) }],
  ["9015", "Chloe Martin", "VP Data", "Gringotts Analytics", sigs(["Business offer request", 0, 120, "Offer request: Business annual"]), { last_touch_ts: ago(100) }],
  ["9016", "Ravi Shah", "Platform Engineer", "Monarch Data", sigs(["Email reply", 1, 15, "Re: trial limits"]), { owner_id: "86070356", contact_owner_name: "Alex Mazur" }],
];
const queueRows = inbound.map(([contact_id, contact_name, jobtitle, company, signals_json, x = {}]) => {
  const top = JSON.parse(signals_json)[0];
  return {
    contact_id, owner_id: me, queue_owner_id: me, contact_owner_name: "Rebecca Polak", contact_name,
    email: `${contact_name.split(" ")[0].toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
    jobtitle, company, linkedin_url: "https://www.linkedin.com/in/example", signals_json, top_rank: top.rnk, latest_sig_ts: top.ts,
    created_ts: ago(300 + Number(contact_id.slice(-2)) * 40), first_touch_ts: null, touches_14d: 0, hs_li: "", ...x,
  };
});
const overlayRows = [
  { contact_id: "9001", linkedin_status: "linkedin_message", last_linkedin_ts: ago(20), last_linkedin_actor: me, linkedin_14d: 3,
    li_hist: JSON.stringify([{ t: "linkedin_request_sent", ts: ago(120), by: me }, { t: "linkedin_accepted", ts: ago(70), by: me }, { t: "linkedin_message", ts: ago(20), by: me }]) },
  { contact_id: "9012", reviewed_ts: ago(20), li_hist: "[]" },
  { contact_id: "9013", retouch_on: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10), retouch_event_ts: ago(30), li_hist: "[]" },
];

// outbound: Apollo-sourced contacts grouped into accounts
type Ob = [contact: string, title: string, company: string, coId: string, signals: string, extra?: Record<string, unknown>];
const outbound: Ob[] = [
  ["Jordan Lee", "Director of Data", "Northwind Traders", "501", sigs(["Replied", 1, 6, "Re: DuckDB for your BI stack"]), { segment: "MM", outbound_play: "Snowflake cost" }],
  ["Priyanka Rao", "Data Engineer", "Northwind Traders", "501", sigs(["Pricing page", 4, 20])],
  ["Felix Wagner", "Head of Platform", "Contoso Cloud", "502", sigs(["Signed up", 3, 30, "Free tier"]), { segment: "ENT", outbound_play: "Postgres analytics" }],
  ["Hana Sato", "Analytics Manager", "Fabrikam", "503", sigs(["Sequence ended, no reply", 5, 200]), { segment: "SMB", last_touch_ts: ago(220), touches_180d: 6 }],
  ["Diego Alvarez", "VP Engineering", "Adventure Works", "504", sigs(["Never touched", 6, 48])],
  ["Ines Costa", "Data Lead", "Adventure Works", "504", sigs(["Never touched", 6, 48])],
  ["Ben Carter", "CTO", "Litware", "505", sigs(["Site visit", 4, 12]), { segment: "MM" }],
  ["Yara Haddad", "Senior Data Engineer", "Proseware", "506", sigs(["Never touched", 6, 72]), { last_touch_ts: ago(40), touches_14d: 2 }],
  ["Liam O'Neill", "Analytics Engineer", "Tailspin Toys", "507", sigs(["Never touched", 6, 90])],
  ["Zoe Kim", "Head of BI", "Wingtip Data", "508", sigs(["Sequence ended, no reply", 5, 400]), { last_touch_ts: ago(300), touches_180d: 5 }],
];
const obRows = outbound.map(([contact_name, title, company, company_id, signals_json, x = {}], i) => ({
  contact_id: String(9100 + i), owner_id: me, hs_li: "", contact_name, title, company_id, company, domain: company.toLowerCase().replace(/[^a-z]/g, "") + ".example",
  email: `${contact_name.split(" ")[0].toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.example`, segment: "MM", outbound_play: "",
  hs_ae_id: "", hs_ae_name: "", linkedin_url: "https://www.linkedin.com/in/example", created_ts: ago(500), touches_14d: 0, touches_180d: 0,
  calls_total: 0, calls_connected: 0, in_sequence: false, signals_json, post_sqa: false, ...x,
}));

// lead workability (fictional): facts per contact; the dive derives the reason from them
type WkFix = Partial<Record<string, unknown>>;
const wkBase = (id: string, dom: string, x: WkFix = {}) => ({
  contact_id: id, wk_scored: true, role_label: "icp", role_confidence: 0.88, role_override: null, is_relay: false, has_md_user: true, is_org_creator: true,
  sibling_paying: false, sibling_org_name: null, sibling_awr: 0, email_domain: dom, li_found: true, agent_harness: false, batch_signup: false, batch_size: 1,
  company_on_md: false, company_on_md_org: null, org_name: "Personal org", org_users: 1, org_awr: 0, facts_at: ago(0.4), ...x,
});
const wkFor: Record<string, WkFix> = {
  "9002": { role_label: "tech_at_company", role_confidence: 0.61 },
  "9004": { is_org_creator: false, org_name: "Umbrella Labs", org_users: 42, org_awr: 38400 },
  "9006": { role_label: "non_technical", role_confidence: 0.83 },
  "9008": { role_label: "unknown", role_confidence: 0.93, li_found: false },
  "9010": { sibling_paying: true, sibling_org_name: "Tyrell Analytics", sibling_awr: 14700 },
  "9011": { role_label: "tech_no_company", role_confidence: 0.7 },
  "9012": { has_md_user: false, org_name: null, org_users: null },
  "9013": { agent_harness: true, company_on_md: true, company_on_md_org: "Oscorp Sandbox" },
};
const wkRows = inbound.filter(([id]) => id !== "9016").map(([id, , , company]) => wkBase(id, company.toLowerCase().replace(/[^a-z]/g, "") + ".example", wkFor[id]));
// All Leads tab: a wider fictional set across ~4 weeks, mixing every reason
const FIRST = ["Avery", "Blake", "Casey", "Devon", "Emery", "Finley", "Harper", "Jordan", "Kai", "Logan", "Morgan", "Quinn", "Reese", "Rowan", "Sage", "Taylor"];
const LAST = ["Stone", "Rivers", "Hart", "Lane", "Brooks", "Frost", "Wells", "Reyes", "Vance", "Ng", "Okafor", "Silva"];
const COS = ["Acme", "Globex", "Initech", "Hooli", "Pied Piper", "Vandelay", "Wayne Data", "Stark Analytics", ""];
const TITLES = ["Data Engineer", "Analytics Lead", "", "Marketing Manager", "Software Engineer", "", "Student", "Account Executive", "Head of Data", ""];
const allLeadRows = Array.from({ length: 140 }, (_, i) => {
  const co = COS[i % COS.length], title = TITLES[(i * 7) % TITLES.length];
  const personal = !co || i % 5 === 0;
  const dom = i % 23 === 0 ? "agentmail.to" : personal ? "gmail.com" : co.toLowerCase().replace(/[^a-z]/g, "") + ".example";
  const role = !title ? "unknown" : /Marketing|Account/.test(title) ? "non_technical" : title === "Student" ? "tech_no_company" : "icp";
  const x: WkFix = { role_label: role, role_confidence: 0.55 + ((i * 13) % 45) / 100, li_found: i % 3 !== 0 };
  if (dom === "agentmail.to") x.is_relay = true;
  if (i % 11 === 0) Object.assign(x, { is_org_creator: false, org_name: "Contoso Demo", org_users: 120, org_awr: 48300, batch_signup: true, batch_size: 9 });
  if (i % 17 === 0) Object.assign(x, { sibling_paying: true, sibling_org_name: "Globex Prod", sibling_awr: 22100 });
  if (i % 13 === 0) x.has_md_user = false;
  if (i % 9 === 0) x.agent_harness = true;
  if (i % 29 === 0) x.wk_scored = false;
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
  return {
    ...wkBase(String(9300 + i), dom, x), contact_name: name, email: `${name.split(" ")[0].toLowerCase()}@${dom}`, jobtitle: title || null, company: co || null,
    lead_source: i % 4 ? "MotherDuck New User" : "Event Registration", linkedin_url: i % 3 ? "https://www.linkedin.com/in/example" : null,
    queue_owner_id: i % 2 ? me : "89400805", owner_name: i % 2 ? "Rebecca Polak" : "Andrew Otterman", created_ts: ago(2 + i * 4.3),
  };
});

(globalThis as any).__MOCK_ROWS__ = (sql: string) => {
  if (sql.includes("AS lead_source") && sql.includes("lead_workability")) return allLeadRows;
  if (sql.includes('"lead_workability" w') && sql.includes("role_override")) return wkRows;
  if (sql.includes("AS sqas_today")) return [tweak(gameRow(sql.includes("accts_opened"), idIn(sql)))];
  if (sql.includes("AS queue_owner_id")) return queueRows;
  if (sql.includes("outbound_play") && sql.includes("AS hs_ae_id")) return obRows;
  if (sql.includes("li_hist")) return overlayRows;
  return [];
};
export {};
