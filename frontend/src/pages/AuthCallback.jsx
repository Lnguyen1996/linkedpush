import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { fetchUser } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      fetch(`/api/auth/callback?code=${code}`, { credentials: 'include', redirect: 'follow' })
        .then(() => fetchUser())
        .then(() => navigate('/'))
        .catch(() => navigate('/login'))
    } else {
      navigate('/login')
    }
  }, [])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-gray-500">Signing in...</div>
    </div>
  )
}
