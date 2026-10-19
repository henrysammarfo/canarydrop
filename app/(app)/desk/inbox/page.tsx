'use client';

import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';

export default function InboxPage() {
  const d = useDesk();
  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Inbox"
        description="Older tips load from Arkiv. New tips arrive live."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <Card>
        {d.skippedTips > 0 && (
          <p className="muted" style={{ marginBottom: 12 }}>
            {d.skippedTips} sealed tips could not be opened with this key.
          </p>
        )}
        {d.tips.length === 0 ? (
          <EmptyState
            title={d.loadingInbox ? 'Loading tips from Arkiv…' : 'No tips yet'}
            body="This view updates live when a source sends one."
          />
        ) : (
          <ul style={{ padding: 0, margin: 0, display: 'grid', gap: 12 }}>
            {d.tips.map((t) => (
              <li key={t.key} style={{ listStyle: 'none' }}>
                <div className="card tip-card" style={{ padding: 14 }}>
                  <CopyField label="Tip" value={t.key} />
                  <div className="body">{t.text}</div>
                  <div className="reply-row">
                    <input
                      value={t.replyText ?? ''}
                      onChange={(e) =>
                        d.setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: e.target.value } : x)))
                      }
                      placeholder="Write a reply"
                    />
                    <button type="button" className="btn primary sm" onClick={() => void d.sendReply(t)}>
                      Send reply
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="ctaRow" style={{ marginTop: 16 }}>
          <button
            className="btn"
            type="button"
            disabled={!d.inboxCursor || !d.deskKey || !d.priv || d.loadingInbox}
            onClick={() => d.deskKey && d.priv && void d.loadHistory(d.deskKey, d.priv, d.inboxCursor, d.inboxBlock)}
          >
            {d.loadingInbox ? 'Loading' : 'Load older tips'}
          </button>
        </div>
      </Card>
    </>
  );
}
