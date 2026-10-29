import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n?.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(n?.badLines).toBe(1);
  });

  it('counts retries and keeps the last status and error', () => {
    const row = readNight('runs', '2026-10-28')?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });
  });

  it('keeps a row with a null owner', () => {
    const row = readNight('runs', '2026-10-28')?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
  });

  it('returns null for a night with no file or a bad night', () => {
    expect(readNight('runs', '2001-01-01')).toBeNull();
    expect(readNight('runs', '../x')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });
});
