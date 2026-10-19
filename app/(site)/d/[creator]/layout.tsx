import type { ReactNode } from 'react';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';

export function generateStaticParams() {
  return [{ creator: DEFAULT_DESK }, { creator: DEFAULT_IMPOSTOR }];
}

export default function DeskPublicLayout({ children }: { children: ReactNode }) {
  return children;
}
