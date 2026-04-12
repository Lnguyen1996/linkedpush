export default function Login() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-linkedin flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-xl">P</span>
        </div>
        <h1 className="text-2xl font-semibold text-dark mb-2">Postiz</h1>
        <p className="text-gray-500 mb-6">Sign in to manage your LinkedIn posts</p>
        <button className="w-full bg-linkedin hover:bg-linkedin-dark text-white font-medium py-3 px-4 rounded-lg transition-colors">
          Sign in with LinkedIn
        </button>
      </div>
    </div>
  )
}
