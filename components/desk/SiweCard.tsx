'use client';

import { useState } from 'react';
import type { Hex } from 'viem';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import { useToast } from '@/components/Toast';
import { getInjectedProvider } from '@/lib/injected';
import { buildSiweMessage, newsroomSiweFields, parseSiweMessage, verifySiwe } from '@/lib/siwe';
import { uiError } from '@/lib/ui-error';
import { existingAccount } from '@/lib/wallet';

export default function SiweCard() {
  const push = useToast();
  const [session, setSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const eth = getInjectedProvider();
      if (!eth) throw new Error('No wallet found. Connect a wallet first.');
      const address = (await existingAccount()) as Hex | null;
      if (!address) throw new Error('Connect a wallet first.');
      const fields = newsroomSiweFields({
        domain: window.location.host,
        address,
        uri: window.location.origin,
      });
      const message = buildSiweMessage(fields);
      const signature = (await eth.request({
        method: 'personal_sign',
        params: [message, address],
      })) as Hex;
      const checked = await verifySiwe(message, signature);
      if (!checked.ok) throw new Error('That sign in could not be verified.');
      setSession(checked.address);
      push({ kind: 'success', text: 'Signed in with Ethereum.' });
    } catch (err: unknown) {
      push({ kind: 'error', text: uiError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="h3">Newsroom sign in</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        Sign a standard Ethereum login message. The site checks it here. You can also check the same message offline.
      </p>
      <div className="ctaRow" style={{ marginTop: 14 }}>
        <button type="button" className="btn primary" onClick={() => void signIn()} disabled={busy}>
          {busy ? 'Working' : 'Sign in with Ethereum'}
        </button>
      </div>
      {session ? (
        <div style={{ marginTop: 12 }}>
          <CopyField label="Signed in" value={session} />
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          No signed session in this browser yet.
        </p>
      )}
      <details className="advanced">
        <summary>Message shape</summary>
        <p className="muted">
          {parseSiweMessage(
            'example.com wants you to sign in with your Ethereum account:\n0x0000000000000000000000000000000000000001\n\nURI: https://example.com\nVersion: 1\nChain ID: 7738577\nNonce: abcd\nIssued At: 2026-10-19T00:00:00.000Z',
          )
            ? 'The parser accepts EIP 4361 fields: domain, address, URI, version, chain id, nonce, issued at.'
            : 'Parser ready.'}
        </p>
      </details>
    </Card>
  );
}
