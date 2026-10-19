'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import EmptyState from '@/components/ui/EmptyState';
import ExperimentalLabel from '@/components/ui/ExperimentalLabel';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import { repliesForCreator } from '@/lib/arkiv';
import { attrKey } from '@/lib/attr';
import StaleNote from '@/components/ui/StaleNote';

type Row = { key: Hex; tipKey: Hex; tipPreview: string; createdAt: string };

export default function RepliesPage() {
  const d = useDesk();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!d.creator) {
      setRows([]);
      return;
    }
    const creator = d.creator;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const listed = await repliesForCreator(creator);
        const byTip = new Map(d.tips.map((tip) => [tip.key.toLowerCase(), tip]));
        const next: Row[] = [];
        for (const r of listed) {
          if (!r.key) continue;
          const tipKey = attrKey(r.attributes, 'tip');
          if (!tipKey) continue;
          const tip = byTip.get(tipKey.toLowerCase());
          next.push({
            key: r.key,
            tipKey,
            tipPreview: tip?.text.slice(0, 80) ?? '',
            createdAt: r.createdAt?.toString() ?? 'n/a',
          });
        }
        if (!cancelled) setRows(next);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [d.creator, d.tips]);

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Replies"
        description={
          <>
            Replies you send from the inbox use a one time address and are stored on Arkiv.{' '}
            <ExperimentalLabel />
          </>
        }
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <StaleNote text={d.staleNote} />
      <Card>
        {loading ? (
          <EmptyState title="Loading replies from Arkiv…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No replies yet"
            body="Open a tip in Inbox and send a reply. The source can read it with their receipt."
          />
        ) : (
          <Table caption="Replies sent from this desk">
            <thead>
              <tr>
                <th scope="col">Reply</th>
                <th scope="col">Tip</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} id={`reply-${row.key}`}>
                  <td>
                    <CopyField value={row.key} />
                  </td>
                  <td>
                    <CopyField value={row.tipKey} />
                    <p className="muted" style={{ marginTop: 6 }}>
                      {row.tipPreview}
                    </p>
                  </td>
                  <td>{row.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
