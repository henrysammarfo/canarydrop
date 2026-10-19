'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { DEFAULT_CANARY_STATEMENT, issuedAtNow, verifyCanarySignature } from '@/lib/eip712';
import { isAddress } from '@/lib/hex';
import { useToast } from '@/components/Toast';

export default function CanarySig({ desk }: { desk: string }) {
  const push = useToast();
  const [statement, setStatement] = useState(DEFAULT_CANARY_STATEMENT);
  const [issuedAt, setIssuedAt] = useState('');
  const [signature, setSignature] = useState('');
  const [address, setAddress] = useState(desk);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setIssuedAt(issuedAtNow().toString());
  }, []);

  async function check() {
    if (!isAddress(address)) {
      setResult('That desk address is not valid.');
      return;
    }
    if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 132) {
      setResult('That signature is not valid hex.');
      return;
    }
    let issued: bigint;
    try {
      issued = BigInt(issuedAt);
    } catch {
      setResult('Issued at must be a unix time in seconds.');
      return;
    }
    const ok = await verifyCanarySignature(address, { desk: address, statement, issuedAt: issued }, signature as Hex);
    setResult(ok ? 'Signature matches this desk and statement.' : 'Signature does not match.');
    push({ kind: ok ? 'success' : 'error', text: ok ? 'Statement checks out.' : 'Statement does not match.' });
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <strong>Check a signed canary statement</strong>
      <p className="muted" style={{ marginTop: 8 }}>
        Paste a signature. This check runs in your browser. It does not need our server.
      </p>
      <label className="small" htmlFor="sig-desk">Desk</label>
      <input id="sig-desk" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label className="small" htmlFor="sig-statement">Statement</label>
      <input id="sig-statement" value={statement} onChange={(e) => setStatement(e.target.value)} />
      <label className="small" htmlFor="sig-issued">Issued at (unix seconds)</label>
      <input id="sig-issued" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
      <label className="small" htmlFor="sig-hex">Signature</label>
      <textarea id="sig-hex" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="0x…" style={{ height: 90 }} />
      <div className="ctaRow" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
        <button type="button" className="btn" onClick={() => void check()}>
          Check signature
        </button>
      </div>
      {result && (
        <p className="muted" role="status" style={{ marginTop: 10 }}>
          {result}
        </p>
      )}
    </div>
  );
}
