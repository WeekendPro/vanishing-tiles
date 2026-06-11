export function ClassicDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell bgap" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell bgap" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece cl-a" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece cl-b" style={{ left: 80, top: 40, background: '#ff2d95', boxShadow: '0 0 10px #ff2d95' }} />
      <span className="ov cl-eye" style={{ top: -6, right: -6, fontSize: 24 }}>👀</span>
      <span className="check cl-chk">✓</span>
    </>
  )
}
