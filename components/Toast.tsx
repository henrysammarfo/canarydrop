'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: number; kind: 'success' | 'info' | 'error'; text: string };

const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((arr) => [...arr, { id, ...t }]);
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 50, display: 'grid', gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card"
            style={{
              borderColor:
                t.kind === 'success'
                  ? 'rgba(120,220,160,.6)'
                  : t.kind === 'error'
                  ? 'rgba(255,160,120,.7)'
                  : 'rgba(180,210,235,.5)',
              background:
                t.kind === 'success'
                  ? 'linear-gradient(180deg, rgba(70,130,90,.25), rgba(50,80,66,.18))'
                  : t.kind === 'error'
                  ? 'linear-gradient(180deg, rgba(160,70,50,.25), rgba(90,40,30,.18))'
                  : undefined,
              minWidth: 280,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.push;
}

