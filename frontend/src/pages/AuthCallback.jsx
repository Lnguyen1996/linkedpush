import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-xs border-0 bg-transparent shadow-none ring-0">
        <CardContent className="flex flex-col items-center gap-4 px-0">
          <Skeleton className="h-10 w-10 rounded-full border-2 border-purple border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium animate-fade-in-up">Signing you in...</p>
        </CardContent>
      </Card>
    </div>
  )
}
