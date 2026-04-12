import { LayoutDashboard } from 'lucide-react'

export default function Dashboard() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard size={24} className="text-linkedin" />
        <h1 className="text-2xl font-semibold text-dark">Dashboard</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        <p className="text-lg">Welcome to Postiz</p>
        <p className="mt-2 text-sm">Your LinkedIn post scheduler. Get started by composing a post.</p>
      </div>
    </div>
  )
}
