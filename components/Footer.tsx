export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ opacity: 0.9 }}>
          MIT · Built for Arkiv Global Tour · Tiramisu testnet
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <a className="btn" href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="btn" href="https://hub.arkiv.network/tiramisu" target="_blank" rel="noreferrer">
            Arkiv Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}

