export function OrderDemo() {
  return (
    <>
      <div className="grid4">
        <span className="bcell" /><span className="bcell bgap num">1</span><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell bgap num">2</span><span className="bcell" />
        <span className="bcell" /><span className="bcell bgap num">3</span><span className="bcell" /><span className="bcell" />
        <span className="bcell" /><span className="bcell" /><span className="bcell" /><span className="bcell" />
      </div>
      <span className="piece io-1" style={{ left: 40, top: 0, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece io-2" style={{ left: 80, top: 40, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="piece io-3" style={{ left: 40, top: 80, background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="check io-chk">✓</span>
    </>
  )
}
