import { z } from 'zod';
import { ENTITY_KEY_RE, LIFETIME_KEYS, MAX_DESK_NAME, MAX_PUB_B64, MAX_WIRE_B64_CHARS } from './constants';

export const hexKey = z.string().regex(ENTITY_KEY_RE, 'deskKey must be 0x and 64 hex characters');

export const tipBody = z
  .object({
    deskKey: hexKey,
    wireB64: z.string().min(8).max(MAX_WIRE_B64_CHARS),
    lifetime: z.enum(LIFETIME_KEYS),
  })
  .strict();

export const replyBody = z
  .object({
    tipKey: hexKey,
    wireB64: z.string().min(8).max(MAX_WIRE_B64_CHARS),
    stealthAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    ephemeralPub: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
    viewTag: z.string().regex(/^0x[0-9a-fA-F]+$/).optional(),
  })
  .strict();

export const createDeskBody = z
  .object({
    name: z.string().min(1).max(MAX_DESK_NAME),
    deskPubRawB64: z.string().min(8).max(MAX_PUB_B64),
    domain: z.string().max(80).optional(),
  })
  .strict();

export const renewBody = z
  .object({
    deskKey: hexKey,
    canaryKey: hexKey,
  })
  .strict();

export const dropBody = z
  .object({
    deskKey: hexKey,
    dropPayloadB64: z.string().min(8).max(MAX_WIRE_B64_CHARS),
    releasePayloadB64: z.string().min(8).max(MAX_WIRE_B64_CHARS),
  })
  .strict();

export type TipBody = z.infer<typeof tipBody>;
export type ReplyBody = z.infer<typeof replyBody>;
export type CreateDeskBody = z.infer<typeof createDeskBody>;
export type RenewBody = z.infer<typeof renewBody>;
export type DropBody = z.infer<typeof dropBody>;
