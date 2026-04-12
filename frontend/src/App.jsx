import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Compose from './pages/Compose'
import Calendar from './pages/Calendar'
import MediaLibrary from './pages/MediaLibrary'
import Analytics from './pages/Analytics'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="compose" element={<Compose />} />
          <Route path="compose/:id" element={<Compose />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
