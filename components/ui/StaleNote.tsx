export default function StaleNote({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p className="muted stale-note" role="status">
      {text}
    </p>
  );
}
