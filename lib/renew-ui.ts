export type RenewApiBody = {
  ok?: boolean;
  dryRun?: boolean;
  confirming?: boolean;
  txHash?: string;
  message?: string;
  error?: string;
};

export type RenewNotice = {
  kind: 'dry' | 'ok' | 'confirming' | 'error';
  text: string;
  txHash?: string | undefined;
};

/** Map a renew HTTP response to the toast the desk should show. */
export function renewNotice(status: number, body: RenewApiBody): RenewNotice {
  const txHash = typeof body.txHash === 'string' && body.txHash.startsWith('0x') ? body.txHash : undefined;
  if (status === 202 || body.confirming) {
    return { kind: 'confirming', text: 'The renew was sent and is still confirming.', txHash };
  }
  if (status < 200 || status >= 300) {
    return { kind: 'error', text: body.message ?? body.error ?? 'failed', txHash };
  }
  if (body.dryRun) {
    return { kind: 'dry', text: 'Dry run ok. Lifetime extension was not sent.', txHash };
  }
  return { kind: 'ok', text: 'Canary renewed.', txHash };
}
