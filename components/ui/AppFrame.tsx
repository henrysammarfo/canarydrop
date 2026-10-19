'use client';

import type { ReactNode } from 'react';
import TorBanner from '@/components/TorBanner';
import AppShell from '@/components/ui/AppShell';

export default function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <TorBanner />
      {children}
    </AppShell>
  );
}
