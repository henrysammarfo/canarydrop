export default function ExperimentalLabel({ className }: { className?: string }) {
  return (
    <span className={['pill', 'pill-wait', 'experimental-label', className].filter(Boolean).join(' ')}>
      Experimental
    </span>
  );
}
