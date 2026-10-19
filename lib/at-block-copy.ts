export type AtBlockAbsence = {
  ok: boolean;
  detail: string;
};

/** Plain English for a pinned-block canary read. A young canary is not GONE. */
export function atBlockAbsenceDetail(opts: {
  hourAgo: bigint;
  pastAlive: boolean;
  createdAt?: bigint | null | undefined;
}): AtBlockAbsence {
  const hourAgo = opts.hourAgo.toString();
  if (opts.pastAlive) {
    return { ok: true, detail: `ALIVE at block ${hourAgo}.` };
  }
  if (opts.createdAt != null && opts.createdAt > opts.hourAgo) {
    return {
      ok: true,
      detail: `This canary did not exist yet about an hour ago. It was created at block ${opts.createdAt.toString()}.`,
    };
  }
  return { ok: false, detail: `GONE at block ${hourAgo}.` };
}
