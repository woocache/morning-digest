import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));

const NORMAL = '2026-02-01';
const EMPTY = '2026-02-02';
const BAD = '2026-02-03';
const MISSING = '2026-02-04';

const line = (at: string, job: string, status: string, owner?: string, error?: string) =>
  JSON.stringify({ at, job, status, ...(owner ? { owner } : {}), ...(error ? { error } : {}) });

beforeAll(() => {
  // Jobs are written out of order on purpose: the page must sort them by job.
  writeFileSync(
    join(runsDir, `${NORMAL}.jsonl`),
    [
      line('2026-02-01T02:00:00+01:00', 'zeta/sync', 'ok', 'rook'),
      line('2026-02-01T02:05:00+01:00', 'alpha/refresh', 'retry', 'rook'),
      line('2026-02-01T02:06:00+01:00', 'alpha/refresh', 'retry', 'rook'),
      line('2026-02-01T02:07:00+01:00', 'alpha/refresh', 'ok', 'rook'),
      line('2026-02-01T03:00:00+01:00', 'mid/render', 'fail', undefined, 'boom'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [line('2026-02-03T01:00:00+01:00', 'alpha/refresh', 'ok', 'rook'), 'this is not json'].join('\n') + '\n',
  );
});

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

describe('GET /digest/:night', () => {
  it('renders a night with a file, rows sorted by job', async () => {
    const res = await app().request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    const at = ['alpha/refresh', 'mid/render', 'zeta/sync'].map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('404s with a text body for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe(`no digest for ${MISSING}`);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and notes the count', async () => {
    const res = await app().request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha/refresh');
    expect(html).toContain('1 line did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app().request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe(NORMAL);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/refresh', 'mid/render', 'zeta/sync']);
    expect(body.rows[0]).toMatchObject({ runs: 3, retries: 2, lastStatus: 'ok', owner: 'rook' });
    expect(body.rows[1]).toMatchObject({ owner: null, lastStatus: 'fail', lastError: 'boom' });
  });

  it('counts the bad line', async () => {
    const body = (await (await app().request(`/api/digest/${BAD}`)).json()) as Night;
    expect(body.badLines).toBe(1);
  });

  it('404s with a JSON error for a missing night', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no digest for ${MISSING}` });
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const body = (await (await app().request(`/api/digest/${NORMAL}`)).json()) as Night;
    const html = await (await app().request(`/digest/${NORMAL}`)).text();
    const jobs = body.rows.map((r) => r.job);
    const inPage = jobs
      .map((job) => ({ job, i: html.indexOf(job) }))
      .sort((a, b) => a.i - b.i)
      .map((x) => x.job);
    expect(jobs.every((j) => html.includes(j))).toBe(true);
    expect(inPage).toEqual(jobs);
  });
});
