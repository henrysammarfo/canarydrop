'use client';

import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import { useDesk } from '@/components/desk/DeskProvider';
import { useToast } from '@/components/Toast';
import { parseSiweMessage } from '@/lib/siwe';
import { uiError } from '@/lib/ui-error';

export default function SiweCard() {
  const d = useDesk();
  const push = useToast();

  async function signIn() {
    try {
      await d.signSiwe();
    } catch (err: unknown) {
      push({ kind: 'error', text: uiError(err) });
    }
  }

  return (
    <Card>
      <h2 className="h3">Newsroom sign in</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        Desk writes need a sign in from the desk creator. Demo mode uses the shared testnet desk instead.
      </p>
      <div className="ctaRow" style={{ marginTop: 14 }}>
        <button type="button" className="btn primary" onClick={() => void signIn()} disabled={d.busy}>
          Sign in with Ethereum
        </button>
      </div>
      {d.siweAddress ? (
        <div style={{ marginTop: 12 }}>
          <CopyField label="Signed in" value={d.siweAddress} />
          <p className="muted" style={{ marginTop: 8 }}>
            {d.canDeskWrite
              ? 'This signer can write for the open desk.'
              : 'This signer is not the desk creator, so writes stay blocked.'}
          </p>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          {d.demo ? 'Demo mode is on. Server writes do not need this sign in.' : 'No signed session in this browser yet.'}
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
