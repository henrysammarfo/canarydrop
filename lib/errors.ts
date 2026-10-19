import { EntityMutationError } from '@arkiv-network/sdk';
import type { Hex } from 'viem';

export type ErrorCode =
  | 'bad_origin'
  | 'bad_csrf'
  | 'rate_limited'
  | 'try_later'
  | 'bad_request'
  | 'too_large'
  | 'no_desk'
  | 'demo_disabled'
  | 'spend_cap'
  | 'unfunded'
  | 'server_error';

const STATUS: Record<ErrorCode, number> = {
  bad_origin: 403,
  bad_csrf: 403,
  rate_limited: 429,
  try_later: 429,
  bad_request: 400,
  too_large: 400,
  no_desk: 400,
  demo_disabled: 403,
  spend_cap: 429,
  unfunded: 503,
  server_error: 500,
};

const FRIENDLY: Record<ErrorCode, string> = {
  bad_origin: 'Please use the site to send this request.',
  bad_csrf: 'Please reload the page and try again.',
  rate_limited: 'Please wait a minute and try again.',
  try_later: 'Please try again later.',
  bad_request: 'That request was not valid.',
  too_large: 'That tip is too large.',
  no_desk: 'That desk does not exist.',
  demo_disabled: 'Demo mode is off.',
  spend_cap: 'The tip line is at its daily limit. Please try again tomorrow.',
  unfunded: 'The sponsor wallet is out of test tokens. Please try again later. Nothing was sent.',
  server_error: 'Something went wrong. Please try again.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string, status?: number) {
    super(message ?? FRIENDLY[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? STATUS[code];
  }
}

export function publicMessage(code: ErrorCode): string {
  return FRIENDLY[code];
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function causeMessage(err: unknown): string {
  if (err instanceof Error && err.cause instanceof Error) return err.cause.message;
  return '';
}

/** Hash from a write that landed but whose receipt wait timed out. */
export function receiptTimeoutHash(err: unknown): Hex | undefined {
  if (!(err instanceof EntityMutationError) || !err.txHash) return undefined;
  const msg = `${err.message} ${causeMessage(err)}`.toLowerCase();
  if (/timeout|timed out|waiting for transaction/.test(msg)) return err.txHash as Hex;
  return undefined;
}

/** Map a chain or runtime failure to a public error. Never returns raw RPC text. */
export function mapUnknownError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof EntityMutationError && err.txHash) {
    return new AppError(
      'server_error',
      'The network accepted a write but the app could not confirm it. Please check the explorer before sending again.',
    );
  }
  const msg = messageOf(err).toLowerCase();
  if (/insufficient funds|unfunded|exceeds the balance/.test(msg)) return new AppError('unfunded');
  if (/anon_cost_limited|429|too many requests|rate limit/.test(msg)) return new AppError('rate_limited');
  if (/nonce/.test(msg)) return new AppError('try_later', 'The network was busy. Please try again.');
  if (/timeout|econnreset|network|fetch failed|503/.test(msg)) return new AppError('try_later');
  return new AppError('server_error');
}

export function errorBody(err: unknown): { error: ErrorCode; message: string; status: number } {
  const mapped = mapUnknownError(err);
  return { error: mapped.code, message: mapped.message, status: mapped.status };
}

/** Alias kept so tests and logs can say "code" without leaking a second public field. */
export function publicError(err: unknown): { error: ErrorCode; message: string; status: number } {
  return errorBody(err);
}
