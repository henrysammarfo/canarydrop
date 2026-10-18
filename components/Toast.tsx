'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'info' | 'error';
type Toast = { id: number; kind: Kind; text: string };

const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((arr) => [...arr, { id, ...t }]);
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 5200);
  }, []);

  const polite = toasts.filter((t) => t.kind !== 'error');
  const assertive = toasts.filter((t) => t.kind === 'error');

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-label="Notifications">
        <div aria-live="assertive" aria-relevant="additions" role="alert">
          {assertive.map((t) => (
            <ToastCard key={t.id} t={t} />
          ))}
        </div>
        <div aria-live="polite" aria-relevant="additions" role="status">
          {polite.map((t) => (
            <ToastCard key={t.id} t={t} />
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ t }: { t: Toast }) {
  return (
    <div className={`toast card toast-${t.kind}`} data-kind={t.kind}>
      {t.text}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.push;
}
