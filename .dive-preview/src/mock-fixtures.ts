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

(globalThis as any).__MOCK_ROWS__ = (sql: string) => {
  if (sql.includes("AS sqas_today")) return [gameRow(sql.includes("accts_opened"))];
  return [];
};
export {};
