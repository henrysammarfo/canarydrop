import type { ReactNode } from 'react';
import AppFrame from '@/components/ui/AppFrame';

export default function HowLayout({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
