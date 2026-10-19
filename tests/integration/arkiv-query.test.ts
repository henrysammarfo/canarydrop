import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK, DEFAULT_RELAY, PROJECT } from '@/lib/constants';
import { countBySlot, explorerPage, getDesk, inboxPage, pub, requireLiveDesk } from '@/lib/arkiv';
import { utcDaySlot } from '@/lib/day';
import { AppError } from '@/lib/errors';
import { HEX_KEY } from '../helpers/request';
import type { Hex } from 'viem';

describe('arkiv query helpers against Tiramisu', () => {
  it('explorer page returns a block and a cursor field', async () => {
    const page = await explorerPage();
    expect(page.blockNumber).toBeGreaterThan(0n);
    expect(Array.isArray(page.entities)).toBe(true);
    expect(page.cursor === undefined || typeof page.cursor === 'string').toBe(true);
    expect(typeof page.hasNextPage).toBe('function');
  });

  it('requireLiveDesk maps a missing key to no_desk', async () => {
    await expect(requireLiveDesk(HEX_KEY as Hex)).rejects.toBeInstanceOf(AppError);
    try {
      await requireLiveDesk(HEX_KEY as Hex);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('no_desk');
      expect((err as AppError).message).not.toMatch(/Ident32|stack/i);
    }
  });

  it('inboxPage for the demo desk does not throw', async () => {
    const desk = await getDesk(DEFAULT_DESK);
    if (!desk) {
      expect(desk).toBeUndefined();
      return;
    }
    const page = await inboxPage(desk.key);
    expect(page.blockNumber).toBeGreaterThan(0n);
    expect(Array.isArray(page.entities)).toBe(true);
  });

  it('countBySlot for today is a finite number', async () => {
    const used = await countBySlot('tip', DEFAULT_RELAY, utcDaySlot());
    expect(used).toBeGreaterThanOrEqual(0);
    expect(used).toBeLessThanOrEqual(200);
  });

  it('project attribute is present on a live desk when one exists', async () => {
    const desk = await getDesk(DEFAULT_DESK);
    if (!desk) return;
    const full = await pub().getEntity(desk.key);
    const cell = full.attributes.project;
    if (cell && cell.type === 'str') expect(cell.value).toBe(PROJECT);
  });
});
