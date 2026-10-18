'use client';

import { useEffect } from 'react';

/** Marks .reveal sections as in view. Content stays visible even if this never runs. */
export default function Reveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('is-in');
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return null;
}
