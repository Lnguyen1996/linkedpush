import { PenSquare } from 'lucide-react'

export default function Compose() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <PenSquare size={24} className="text-linkedin" />
        <h1 className="text-2xl font-semibold text-dark">Compose</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        <p>Post composer will be implemented here.</p>
      </div>
    </div>
  )
}
