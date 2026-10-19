import { beforeEach } from 'vitest';
import { resetRateLimitForTests } from '@/lib/rate-limit';
import { resetStoreForTests } from '@/lib/store';

beforeEach(() => {
  resetStoreForTests();
  resetRateLimitForTests();
});
