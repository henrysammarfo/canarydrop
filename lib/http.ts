import { NextResponse } from 'next/server';
import { errorBody } from './errors';

export function jsonOk(data: object, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonFail(err: unknown): NextResponse {
  const body = errorBody(err);
  return NextResponse.json({ error: body.error, message: body.message }, { status: body.status });
}
