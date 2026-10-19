import { beforeEach } from 'vitest';
import { deskIpWindow, relayIpWindow } from '@/lib/rate-limit';

beforeEach(() => {
  relayIpWindow.reset();
  deskIpWindow.reset();
});
