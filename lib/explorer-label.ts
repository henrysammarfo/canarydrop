import type { Hex } from 'viem';

/** Older live demo desk replaced on 19 Oct 2026. Still on chain, not the one Demo mode uses. */
export const REPLACED_DEMO_DESK_KEYS = [
  '0x874e543a36fd673980ca4f2cd992ef9ac1aca38218f1232452bb5d7a7fac6231',
] as const;

/** Canary that still points at the replaced demo desk. */
export const REPLACED_DEMO_CANARY_KEYS = [
  '0x5a9cc9685585f462cc85dfdc2884f06309aa2cda9cc10acfeaa1a260e5a7cc70',
] as const;

export type ExplorerRowFlags = {
  impostor: boolean;
  canonicalDemo: boolean;
  olderDemoDesk: boolean;
  olderDemoCanary: boolean;
  verifiedDomain: boolean;
  unlistedDesk: boolean;
};

function listed(list: readonly string[], value: string): boolean {
  return list.some((item) => item.toLowerCase() === value);
}

export function explorerRowFlags(input: {
  type: string;
  key: Hex;
  creator: Hex;
  deskAttr?: Hex | undefined;
  canonicalDeskKey?: Hex | undefined;
  demoCreator: Hex;
  impostorCreator: Hex;
  listedDesk?: Hex | undefined;
}): ExplorerRowFlags {
  const creator = input.creator.toLowerCase();
  const key = input.key.toLowerCase();
  const demo = input.demoCreator.toLowerCase();
  const impostorWallet = input.impostorCreator.toLowerCase();
  const canonical = input.canonicalDeskKey?.toLowerCase();
  const deskAttr = input.deskAttr?.toLowerCase();

  const impostor =
    creator === impostorWallet || (input.type === 'desk' && creator !== demo);
  const canonicalDemo = input.type === 'desk' && !!canonical && key === canonical;
  const olderDemoDesk =
    !canonicalDemo &&
    !impostor &&
    input.type === 'desk' &&
    (listed(REPLACED_DEMO_DESK_KEYS, key) ||
      (creator === demo && !!canonical && key !== canonical));
  const olderDemoCanary =
    !impostor &&
    input.type === 'canary' &&
    (listed(REPLACED_DEMO_CANARY_KEYS, key) ||
      (creator === demo && !!canonical && !!deskAttr && deskAttr !== canonical));

  const listedAddr = input.listedDesk?.toLowerCase();
  const verifiedDomain = input.type === 'desk' && !!listedAddr && creator === listedAddr && !impostor;
  const unlistedDesk = input.type === 'desk' && !!listedAddr && creator !== listedAddr;

  return { impostor, canonicalDemo, olderDemoDesk, olderDemoCanary, verifiedDomain, unlistedDesk };
}

export function olderDemoLabel(flags: ExplorerRowFlags): string | null {
  if (flags.olderDemoDesk) return 'Older demo desk, replaced';
  if (flags.olderDemoCanary) return 'Older demo canary, replaced';
  return null;
}

export type ExplorerBadge = { short: string; full: string };

export const SEALED_BADGE: ExplorerBadge = {
  short: 'Sealed',
  full: 'Sealed: nobody can change it',
};

export function explorerTypeBadges(flags: ExplorerRowFlags): ExplorerBadge[] {
  const out: ExplorerBadge[] = [];
  if (flags.impostor) out.push({ short: 'Impostor', full: 'Ignored impostor' });
  if (flags.verifiedDomain) out.push({ short: 'Verified', full: 'Verified domain' });
  if (flags.unlistedDesk && !flags.impostor) out.push({ short: 'Unlisted', full: 'Not the desk this site lists' });
  if (flags.canonicalDemo) out.push({ short: 'Canonical', full: 'Canonical demo desk' });
  const older = olderDemoLabel(flags);
  if (older) out.push({ short: 'Replaced', full: older });
  return out;
}
