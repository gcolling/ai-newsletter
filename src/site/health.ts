import type { Issue } from "../types.ts";

export type HealthState = "ok" | "flaky" | "failing";

export interface SourceHealth {
  /** Stories this source led with in the window. */
  stories: number;
  /** Runs in the last week where the source could not be fetched. */
  failedRuns: number;
  state: HealthState;
}

/** How many past issues the health view looks at. */
export const HEALTH_DAYS = 14;

/**
 * Health per source from the issues themselves: no extra state. "Failing" means the last three runs
 * all missed it (likely blocked or moved); "flaky" means it missed at least one run this week.
 */
export function sourceHealth(issues: Issue[], ids: string[]): Map<string, SourceHealth> {
  const recent = issues.slice(0, HEALTH_DAYS);
  const week = recent.slice(0, 7);
  const lastThree = recent.slice(0, 3);
  const health = new Map<string, SourceHealth>();
  for (const id of ids) {
    const stories = recent.reduce(
      (n, issue) => n + issue.stories.filter((s) => s.source.id === id).length,
      0,
    );
    const failedRuns = week.filter((issue) => issue.sources.failed.includes(id)).length;
    const failing =
      lastThree.length === 3 && lastThree.every((issue) => issue.sources.failed.includes(id));
    health.set(id, {
      stories,
      failedRuns,
      state: failing ? "failing" : failedRuns ? "flaky" : "ok",
    });
  }
  return health;
}
