import type { Hex } from 'viem';
import { DEFAULT_DESK } from './constants';
import { deadDropCopy, deadDropStatus, type DeadDropStatus } from './dead-drop';

/** Synthetic demo hold only. No real documents and no real recipient keys. */
export type DemoDeadDrop = {
  title: string;
  text: string;
  recipients: { label: string; hint: string }[];
  dropKey: Hex;
  releaseKey: Hex;
  holdKey: Hex;
  deskCreator: Hex;
  status: DeadDropStatus;
  note: string;
};

const DEMO_DROP_KEY = `0x${'d1'.repeat(32)}` as Hex;
const DEMO_RELEASE_KEY = `0x${'e2'.repeat(32)}` as Hex;
const DEMO_HOLD_KEY = `0x${'f3'.repeat(32)}` as Hex;

export function demoDeadDrop(canaryAlive: boolean | null): DemoDeadDrop {
  const held = canaryAlive !== false;
  const status = deadDropStatus(held, held);
  return {
    title: 'Synthetic hold statement',
    text: 'This is fake sample text for the demo desk. It is not a real disclosure and it names no one.',
    recipients: [
      { label: 'Editor one', hint: 'demo recipient A' },
      { label: 'Counsel two', hint: 'demo recipient B' },
    ],
    dropKey: DEMO_DROP_KEY,
    releaseKey: DEMO_RELEASE_KEY,
    holdKey: DEMO_HOLD_KEY,
    deskCreator: DEFAULT_DESK,
    status,
    note: deadDropCopy(status),
  };
}

export function isDemoDropKey(key: string): boolean {
  return key.toLowerCase() === DEMO_DROP_KEY.toLowerCase();
}
