import type { ReactNode } from 'react';
import AppFrame from '@/components/ui/AppFrame';

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
