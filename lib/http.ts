import { NextResponse } from 'next/server';
import { errorBody, receiptTimeoutHash } from './errors';

export function jsonOk(data: object, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Strip key-like and URL-like values before a 500 is written to logs. */
export function sanitizeLogText(value: string): string {
  return value
    .replace(/0x[0-9a-fA-F]{40,}/g, '0x…')
    .replace(/[0-9a-fA-F]{64}/g, '…')
    .replace(/wss?:\/\/\S+/gi, '[url]')
    .replace(/https?:\/\/\S+/gi, '[url]');
}

function loggableError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? ` cause=${err.cause.name}: ${err.cause.message}` : '';
    return `${err.name}: ${err.message}${cause}`;
  }
  return String(err);
}

export function jsonFail(err: unknown): NextResponse {
  const pending = receiptTimeoutHash(err);
  if (pending) {
    return NextResponse.json(
      { ok: true, txHash: pending, confirming: true, message: 'still confirming' },
      { status: 202 },
    );
  }
  const body = errorBody(err);
  if (body.status >= 500) {
    console.error('server error', sanitizeLogText(loggableError(err)));
  }
  return NextResponse.json({ error: body.error, message: body.message }, { status: body.status });
}
