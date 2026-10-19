import type { ReactNode } from 'react';

export default function Badge({
  children,
  tone = 'gold',
  className,
}: {
  children: ReactNode;
  tone?: 'gold' | 'ok' | 'wait' | 'muted';
  className?: string;
}) {
  const extra = tone === 'ok' ? 'pill-ok' : tone === 'wait' ? 'pill-wait' : tone === 'muted' ? 'pill-muted' : '';
  return <span className={['pill', extra, className].filter(Boolean).join(' ')}>{children}</span>;
}
