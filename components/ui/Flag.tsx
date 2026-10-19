export default function Flag({
  short,
  full,
  tone = 'muted',
}: {
  short: string;
  full: string;
  tone?: 'gold' | 'ok' | 'wait' | 'muted';
}) {
  const extra = tone === 'ok' ? 'flag-ok' : tone === 'wait' ? 'flag-wait' : tone === 'gold' ? 'flag-gold' : '';
  return (
    <span className={['flag', extra].filter(Boolean).join(' ')} title={full}>
      {short}
      <span className="sr-only">{full}</span>
    </span>
  );
}
