'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { DEFAULT_CANARY_STATEMENT, verifyCanarySignature } from '@/lib/eip712';
import { isAddress } from '@/lib/hex';

export default function CanaryAutoVerify({
  desk,
  statement,
  issuedAt,
  signature,
}: {
  desk: string;
  statement?: string | null;
  issuedAt?: string | null;
  signature?: string | null;
}) {
  const [result, setResult] = useState('Looking for a signed statement…');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isAddress(desk) || !signature || !issuedAt) {
        if (!cancelled) setResult('No signed canary statement is stored on this canary yet.');
        return;
      }
      if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 132) {
        if (!cancelled) setResult('The stored signature is not valid hex.');
        return;
      }
      let issued: bigint;
      try {
        issued = BigInt(issuedAt);
      } catch {
        if (!cancelled) setResult('The stored issued time is not valid.');
        return;
      }
      const ok = await verifyCanarySignature(
        desk,
        { desk, statement: statement || DEFAULT_CANARY_STATEMENT, issuedAt: issued },
        signature as Hex,
      );
      if (!cancelled) {
        setResult(
          ok
            ? 'This page checked the stored signature automatically. It matches this desk.'
            : 'This page checked the stored signature automatically. It does not match this desk.',
        );
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [desk, statement, issuedAt, signature]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <strong>Automatic signature check</strong>
      <p className="muted" role="status" style={{ marginTop: 8 }}>
        {result}
      </p>
    </div>
  );
}
