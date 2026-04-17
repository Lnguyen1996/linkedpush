import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Compose from './pages/Compose'

import MediaLibrary from './pages/MediaLibrary'

import PostReview from './pages/PostReview'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Privacy from './pages/Privacy'

function LegacyComposeRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/app/compose/${id}` : '/app/compose'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/app" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="compose" element={<Compose />} />
              <Route path="compose/:id" element={<Compose />} />
              <Route path="post/:id" element={<PostReview />} />

              <Route path="media" element={<MediaLibrary />} />
              {/* Analytics hidden until posts have engagement data */}
            </Route>
            <Route path="/compose" element={<LegacyComposeRedirect />} />
            <Route path="/compose/:id" element={<LegacyComposeRedirect />} />
            <Route path="/media" element={<Navigate to="/app/media" replace />} />
            {/* <Route path="/analytics" element={<Navigate to="/app/analytics" replace />} /> */}
          </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
