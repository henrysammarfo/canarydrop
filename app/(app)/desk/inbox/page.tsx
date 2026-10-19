'use client';

import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ExperimentalLabel from '@/components/ui/ExperimentalLabel';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import StaleNote from '@/components/ui/StaleNote';
import { shortHex } from '@/lib/chain';
import Link from 'next/link';

export default function InboxPage() {
  const d = useDesk();
  const waiting = d.loadingDesk || d.loadingInbox || (d.demo && !d.demoKey && !d.demoKeyError);
  const emptyTitle = waiting
    ? 'Loading tips from Arkiv…'
    : d.demo && d.demoKeyError
      ? 'Tips cannot be opened here'
      : !d.priv
        ? 'Load a desk key to open tips'
        : 'No tips yet';
  const emptyBody = waiting
    ? 'Older tips load first. New tips arrive live.'
    : d.demo && d.demoKeyError
      ? d.demoKeyError
      : !d.priv
        ? 'Generate or import a desk key in Desk settings, or turn on Demo mode.'
        : 'This view updates live when a source sends one.';

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Inbox"
        description="Older tips load from Arkiv. New tips arrive live."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <StaleNote text={d.staleNote} />
      <Card>
        {d.skippedTips > 0 && (
          <p className="muted" style={{ marginBottom: 12 }}>
            {d.skippedTips} sealed tips could not be opened with this key.
          </p>
        )}
        {d.tips.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          <ul className="tip-list">
            {d.tips.map((t) => (
              <li key={t.key}>
                <article className="card tip-card">
                  <header className="tip-head">
                    <span className="live-pill">Open</span>
                    <code className="key-mono" title={t.key}>
                      {shortHex(t.key, 8, 6)}
                    </code>
                  </header>
                  <div className="body">{t.text}</div>
                  <div className="reply-row">
                    <input
                      value={t.replyText ?? ''}
                      onChange={(e) =>
                        d.setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: e.target.value } : x)))
                      }
                      placeholder="Write a reply"
                      aria-label={`Reply to tip ${shortHex(t.key, 4, 4)}`}
                    />
                    <button type="button" className="btn primary" onClick={() => void d.sendReply(t)} disabled={!t.replyText?.trim()}>
                      Send reply
                    </button>
                  </div>
                  <p className="muted stealth-reply-note">
                    Replies use a one time address. <ExperimentalLabel />
                  </p>
                  {t.sentReplyKey !== undefined && (
                    <p className="page-note compact reply-sent" role="status">
                      Reply sent.{' '}
                      <Link href={t.sentReplyKey ? `/desk/replies#reply-${t.sentReplyKey}` : '/desk/replies'}>
                        Open it on Replies
                      </Link>
                      {t.sentStealth ? ` One time address ${shortHex(t.sentStealth)}.` : ''}{' '}
                      <ExperimentalLabel />
                    </p>
                  )}
                </article>
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
