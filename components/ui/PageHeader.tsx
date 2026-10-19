import type { ReactNode } from 'react';

export default function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div style={{ minWidth: 0 }}>
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ctaRow">{actions}</div> : null}
    </header>
  );
}
