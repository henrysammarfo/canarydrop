import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  pill?: boolean;
  loading?: boolean;
  href?: string;
  external?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function classes(opts: { variant: Variant; size: Size; pill: boolean; className?: string | undefined }) {
  const v = opts.variant === 'primary' ? 'primary' : opts.variant === 'ghost' ? 'ghost' : opts.variant === 'danger' ? 'danger' : '';
  const s = opts.size === 'sm' ? 'sm' : opts.size === 'lg' ? 'lg' : '';
  return ['btn', v, s, opts.pill ? 'pill' : '', opts.className ?? ''].filter(Boolean).join(' ');
}

export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  pill = false,
  loading = false,
  href,
  external,
  className,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  const cls = classes({ variant, size, pill, className });
  const inner = (
    <>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </>
  );
  if (href) {
    if (external) {
      return (
        <a className={cls} href={href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      );
    }
    return (
      <Link className={cls} href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} type={type} disabled={disabled || loading} {...rest}>
      {inner}
    </button>
  );
}
