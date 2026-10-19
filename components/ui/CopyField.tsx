'use client';

import { useState } from 'react';
import { shortHex } from '@/lib/chain';

export default function CopyField({
  value,
  label,
  head = 8,
  tail = 6,
}: {
  value: string;
  label?: string;
  head?: number;
  tail?: number;
}) {
  const [copied, setCopied] = useState(false);
  const hex = value.startsWith('0x') && value.length > 4;
  const shown = hex && value.length > head + tail + 2 ? shortHex(value, head, tail) : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-field">
      {label ? <b>{label}</b> : null}
      <code title={value}>{shown}</code>
      {hex ? (
        <button type="button" className="btn sm ghost" onClick={() => void copy()} aria-label={copied ? 'Copied' : `Copy ${label ?? 'value'}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </div>
  );
}
