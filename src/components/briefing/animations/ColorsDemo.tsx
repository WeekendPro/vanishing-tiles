export function ColorsDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell gapcyan" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell gapamber" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece tc-cyan" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece tc-wrong" style={{ left: 80, top: 80, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="ov tc-x" style={{ left: 84, top: 78, fontSize: 24, color: '#ff4d4d', fontWeight: 900 }}>✕</span>
      <span className="piece tc-amber" style={{ left: 80, top: 80, background: '#facc15', boxShadow: '0 0 10px #facc15' }} />
      <span className="check tc-chk">✓</span>
    </>
  )
}
