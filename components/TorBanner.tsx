'use client';

import { useEffect, useState } from 'react';
import { readBrowserTorSignals, shouldShowTorBanner, TOR_BANNER } from '@/lib/tor';

export default function TorBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(shouldShowTorBanner(readBrowserTorSignals()));
  }, []);

  if (!show) return null;

  return (
    <div className="tor-banner" role="status">
      <p>{TOR_BANNER}</p>
      <a className="btn sm" href="/threat">
        Threat model
      </a>
    </div>
  );
}
