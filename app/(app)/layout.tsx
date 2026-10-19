import type { ReactNode } from 'react';
import AppShell from '@/components/ui/AppShell';
import TorBanner from '@/components/TorBanner';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <TorBanner />
      {children}
    </AppShell>
  );
}
