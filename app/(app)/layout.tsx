import type { ReactNode } from 'react';

/** Server-only. Client chrome lives on desk, explorer, how, and verify layouts. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
