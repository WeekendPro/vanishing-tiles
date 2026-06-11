export function FlashDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="ov db-flash" style={{ left: 40, top: 0, width: 34, height: 34, borderRadius: 5, border: '2px dashed #22d3ee', boxShadow: '0 0 14px #22d3ee inset, 0 0 14px #22d3ee' }} />
      <span className="ov db-flash" style={{ left: 80, top: 40, width: 34, height: 34, borderRadius: 5, border: '2px dashed #22d3ee', boxShadow: '0 0 14px #22d3ee inset, 0 0 14px #22d3ee' }} />
      <span className="ov db-blind" style={{ left: '50%', top: 46, transform: 'translateX(-50%)', fontSize: 30 }}>🙈</span>
      <span className="piece db-a" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece db-b" style={{ left: 80, top: 40, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="check db-chk">✓</span>
    </>
  )
}
