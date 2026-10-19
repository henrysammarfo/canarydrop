import type { ReactNode, TableHTMLAttributes } from 'react';

export default function Table({
  caption,
  children,
  className,
  ...rest
}: { caption?: string; children: ReactNode; className?: string } & TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table className={['data-table', className].filter(Boolean).join(' ')} {...rest}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
