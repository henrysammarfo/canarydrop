'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_DESK } from '@/lib/constants';
import { parseDeskQuery } from '@/lib/desk-href';

export default function PublicDeskQueryPage() {
  return (
    <Suspense fallback={<section className="section"><div className="wrap"><p className="lead">Opening the tip form…</p></div></section>}>
      <PublicDeskQueryForm />
    </Suspense>
  );
}

function PublicDeskQueryForm() {
  const params = useSearchParams();
  const router = useRouter();
  const creator = parseDeskQuery(params.get('desk'), DEFAULT_DESK);

  useEffect(() => {
    router.replace(`/submit?desk=${creator}`);
  }, [creator, router]);

  return (
    <section className="section">
      <div className="wrap">
        <p className="lead">Opening the tip form for this desk…</p>
      </div>
    </section>
  );
}
