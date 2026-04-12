import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Compose from './pages/Compose'
import Calendar from './pages/Calendar'
import MediaLibrary from './pages/MediaLibrary'
import Analytics from './pages/Analytics'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="compose" element={<Compose />} />
            <Route path="compose/:id" element={<Compose />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
