import { describe, it, expect } from 'vitest';
import { pub } from '@/lib/arkiv';

describe('arkiv read-only', () => {
  it('reads block timing', async () => {
    const t = await pub.getBlockTiming();
    expect(typeof t.currentBlock).toBe('bigint');
  });
});

