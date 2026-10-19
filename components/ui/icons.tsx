export function IcoOverview() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" />
    </svg>
  );
}
export function IcoInbox() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4.5h12v8.2A1.3 1.3 0 0 1 12.7 14H3.3A1.3 1.3 0 0 1 2 12.7V4.5Z" stroke="currentColor" />
      <path d="M2 6.5h3.2l.9 1.6h3.8l.9-1.6H14" stroke="currentColor" />
    </svg>
  );
}
export function IcoCanary() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}
export function IcoReplies() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10v6.5H6.2L3 13.2V4.5Z" stroke="currentColor" />
    </svg>
  );
}
export function IcoSettings() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" />
      <path d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4 4l1.1 1.1M10.9 10.9 12 12M12 4l-1.1 1.1M5.1 10.9 4 12" stroke="currentColor" />
    </svg>
  );
}
export function IcoExplorer() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.4" stroke="currentColor" />
      <path d="M2 6.2h12M5.2 3v10" stroke="currentColor" />
    </svg>
  );
}
export function IcoHow() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" />
      <path d="M6.4 6.2a1.6 1.6 0 1 1 2.4 1.4c-.5.3-.8.6-.8 1.2V9.4" stroke="currentColor" />
      <circle cx="8" cy="11.2" r="0.6" fill="currentColor" />
    </svg>
  );
}
export function IcoDrop() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 3.5h8v9.2L8 10.6 4 12.7V3.5Z" stroke="currentColor" />
    </svg>
  );
}
export function IcoVerify() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.2 6.4 11l6.1-6.4" stroke="currentColor" />
    </svg>
  );
}
export function IcoMenu() {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
export function IcoCollapse({ flipped }: { flipped?: boolean }) {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" />
      <path d={flipped ? 'M9.5 3v10' : 'M6.5 3v10'} stroke="currentColor" />
    </svg>
  );
}
