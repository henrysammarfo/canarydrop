'use client';

import type { ReactNode } from 'react';
import DeskProvider, { useDesk } from '@/components/desk/DeskProvider';
import Modal from '@/components/Modal';
import AppFrame from '@/components/ui/AppFrame';

function DeskModals() {
  const d = useDesk();
  return (
    <>
      <Modal
        open={d.confirm === 'renew'}
        title="Renew this canary?"
        confirmLabel="Renew canary"
        busy={d.busy}
        onClose={() => d.setConfirm(null)}
        onConfirm={() => void d.renewFlow(false)}
      >
        This extends the canary lifetime by 26 hours and the desk lease by 30 days.
      </Modal>
      <Modal
        open={d.confirm === 'clear'}
        title="Clear desk keys?"
        confirmLabel="Clear keys"
        onClose={() => d.setConfirm(null)}
        onConfirm={d.clearKeys}
      >
        This removes the desk key from this browser. Download a backup first if you still need it.
      </Modal>
    </>
  );
}

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <AppFrame>
      <DeskProvider>
        {children}
        <DeskModals />
      </DeskProvider>
    </AppFrame>
  );
}
