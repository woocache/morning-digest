export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // ISO times with the offset kept from the log, never converted.
  first: string;
  last: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// null: no file for that night, or `night` is not YYYY-MM-DD.
export type ReadNight = (runsDir: string, night: string) => Night | null;
