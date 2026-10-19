export default function HowLoading() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 920 }}>
        <p className="kicker">For judges</p>
        <h1 className="h2">How CanaryDrop uses Arkiv</h1>
        <p className="muted empty-state" role="status" style={{ marginTop: 12 }}>
          Loading live proofs from Tiramisu…
        </p>
      </div>
    </section>
  );
}
