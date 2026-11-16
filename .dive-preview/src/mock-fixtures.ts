/**
 * Sample rows for mock mode (no token), so game/XP visuals have something to draw.
 * Only queries matched here return rows; everything else returns zero rows.
 */
const gameRow = (ob: boolean) => ({
  sqas: ob ? 4 : 14, sqas_today: ob ? 0 : 1,
  meetings: ob ? 6 : 20, meetings_today: ob ? 1 : 0,
  emails: 900, emails_capped: 850, emails_today: ob ? 18 : 24,
  calls: 700, calls_capped: 650, connects: 40, calls_today: ob ? 20 : 35, connects_today: ob ? 1 : 2,
  linkedin: 120, linkedin_capped: 120, linkedin_today: ob ? 8 : 3,
  hygiene: 300, hygiene_capped: 280, hygiene_today: ob ? 4 : 12,
  accts_opened: 30, accts_opened_today: ob ? 2 : 0, accts_multi: 5, accts_multi_today: 0,
  active_days: 9,
});

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString().slice(0, 19);
const sig = (s: string, rnk: number, h: number, detail = "") => JSON.stringify([{ sig: s, rnk, ts: ago(h), detail }]);
// a few inbound contacts at different LinkedIn stages (ledger history + HubSpot field)
const queueRows = [
  { contact_id: "9001", owner_id: "89400804", queue_owner_id: "89400804", contact_owner_name: "Rebecca Polak", contact_name: "Dana Whitfield", email: "dana@acme.io",
    jobtitle: "Head of Data", company: "Acme", linkedin_url: "https://www.linkedin.com/in/example", signals_json: sig("Business offer request", 0, 5, "June 2026 Biz Offer Request Form"), top_rank: 0, latest_sig_ts: ago(5), created_ts: ago(400), hs_li: "" },
  { contact_id: "9002", owner_id: "86070356", queue_owner_id: "89400804", contact_owner_name: "Alex Mazur", contact_name: "Sam Ortega", email: "sam@globex.com",
    jobtitle: "Analytics Engineer", company: "Globex", linkedin_url: "https://www.linkedin.com/in/example2", signals_json: sig("Hand-raiser", 0, 30, "Contact an Expert"), top_rank: 0, latest_sig_ts: ago(30), created_ts: ago(900), hs_li: "LinkedIn: Connection Requested" },
  { contact_id: "9003", owner_id: "89400804", queue_owner_id: "89400804", contact_owner_name: "Rebecca Polak", contact_name: "Priya Natarajan", email: "priya@initech.dev",
    jobtitle: "VP Engineering", company: "Initech", linkedin_url: "", signals_json: sig("Trial spike", 3, 50, "4.1 CPU-h last 7d vs 0.8 prior"), top_rank: 3, latest_sig_ts: ago(50), created_ts: ago(300), hs_li: "" },
];
const overlayRows = [
  { contact_id: "9001", linkedin_status: "linkedin_message", last_linkedin_ts: ago(20), last_linkedin_actor: "89400804", linkedin_14d: 3,
    li_hist: JSON.stringify([{ t: "linkedin_request_sent", ts: ago(120), by: "89400804" }, { t: "linkedin_accepted", ts: ago(70), by: "89400804" }, { t: "linkedin_message", ts: ago(20), by: "89400804" }]) },
];

(globalThis as any).__MOCK_ROWS__ = (sql: string) => {
  if (sql.includes("AS sqas_today")) return [gameRow(sql.includes("accts_opened"))];
  if (sql.includes("AS queue_owner_id")) return queueRows;
  if (sql.includes("li_hist")) return overlayRows;
  return [];
};
export {};
