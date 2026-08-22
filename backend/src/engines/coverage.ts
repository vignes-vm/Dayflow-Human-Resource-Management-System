/**
 * Pure team-coverage level computation — no DB. See CLAUDE.md rule 7 and
 * Dayflow-Blueprint-v2.md §3.1 / §14 (Coverage Radar).
 */

export type CoverageLevel = "ok" | "watch" | "risk";

/** `away` includes both already-approved leave and the request under review. */
export function computeCoveragePercent(headcount: number, away: number): number {
  if (headcount <= 0) return 100;
  const present = Math.max(0, headcount - away);
  return Math.round((present / headcount) * 100);
}

/** Thresholds come from company Settings — configurable so the Radar is demoable. */
export function computeCoverageLevel(
  coveragePercent: number,
  okThreshold: number,
  riskThreshold: number,
): CoverageLevel {
  if (coveragePercent >= okThreshold) return "ok";
  if (coveragePercent >= riskThreshold) return "watch";
  return "risk";
}
