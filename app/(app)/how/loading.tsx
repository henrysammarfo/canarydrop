import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function HowLoading() {
  return (
    <>
      <PageHeader kicker="For judges" title="How CanaryDrop uses Arkiv" />
      <EmptyState title="Loading live proofs from Tiramisu…" />
    </>
  );
}
