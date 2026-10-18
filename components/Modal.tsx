'use client';

import { useEffect, useId, useRef } from 'react';

type ModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onClose,
  onConfirm,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const getItems = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    getItems()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <div className="modal-body">{children}</div>
        <div className="ctaRow" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          {onConfirm && (
            <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>
              {busy ? 'Working' : confirmLabel} <span className="arrow" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
