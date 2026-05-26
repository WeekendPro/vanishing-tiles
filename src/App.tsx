import { PieceShape } from './components/PieceShape'
import { PIECE_DEFINITIONS } from './engine/pieces'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Piece Shapes</h1>
      <div className="flex gap-4 flex-wrap">
        {PIECE_DEFINITIONS.map(p => (
          <div key={p.type} className="flex flex-col items-center gap-2">
            <PieceShape pieceType={p.type} cellSize={20} />
            <span className="text-xs text-gray-400">{p.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

