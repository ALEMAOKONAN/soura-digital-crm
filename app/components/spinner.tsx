export default function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-mid)', padding: '24px 0' }}>
      <div className="spinner" />
      {label && <span style={{ fontSize: '0.9rem' }}>{label}</span>}
    </div>
  );
}
