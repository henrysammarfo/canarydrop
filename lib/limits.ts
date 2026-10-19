import { MAX_WIRE_B64_CHARS, MAX_WIRE_BYTES } from './constants';
import { AppError } from './errors';

export function decodedB64Length(b64: string): number {
  const trimmed = b64.trim();
  if (trimmed.length === 0) return 0;
  const padding = trimmed.endsWith('==') ? 2 : trimmed.endsWith('=') ? 1 : 0;
  return Math.floor((trimmed.length * 3) / 4) - padding;
}

export function isOversizedWireB64(b64: string): boolean {
  return b64.length > MAX_WIRE_B64_CHARS || decodedB64Length(b64) > MAX_WIRE_BYTES;
}

export function throwIfOversizedWire(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const wire = (raw as { wireB64?: unknown }).wireB64;
  if (typeof wire === 'string' && isOversizedWireB64(wire)) throw new AppError('too_large');
}

export function assertWireB64(b64: string): void {
  if (isOversizedWireB64(b64)) throw new AppError('too_large');
}

export function assertWireBytes(wire: Uint8Array): void {
  if (wire.byteLength > MAX_WIRE_BYTES) throw new AppError('too_large');
  if (wire.byteLength < 78) throw new AppError('bad_request', 'That tip is not a valid sealed message.');
}
