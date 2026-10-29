import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

// Counts are null when the night cannot be read.
export type NightCounts =
  | { night: string; ok: number; retry: number; fail: number }
  | { night: string; ok: null; retry: null; fail: null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCounts[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// ok/fail = jobs by last status, retry = retries summed over all jobs.
export function nightCounts(runsDir: string): NightCounts[] {
  return nightsOnDisk(runsDir).map((night): NightCounts => {
    const n = readNight(runsDir, night);
    if (!n) return { night, ok: null, retry: null, fail: null };
    return {
      night,
      ok: n.rows.filter((r) => r.lastStatus === 'ok').length,
      fail: n.rows.filter((r) => r.lastStatus === 'fail').length,
      retry: n.rows.reduce((sum, r) => sum + r.retries, 0),
    };
  });
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightCounts(config.runsDir),
  };
}
