import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme as antTheme } from 'antd'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import GPUs from './pages/GPUs'
import Tasks from './pages/Tasks'
import Monitoring from './pages/Monitoring'
import Analytics from './pages/Analytics'
import Users from './pages/Users'
import Reservations from './pages/Reservations'
import ReservationForm from './pages/ReservationForm'
import MyReservations from './pages/MyReservations'
import ChatPage from './pages/ChatPage'
import DocsPage from './pages/DocsPage'
import FeedbackPage from './pages/FeedbackPage'
import RequirementsPage from './pages/RequirementsPage'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { useAuthStore } from './store/authStore'

const { Content } = Layout

function App() {
  const { isAuthenticated } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setIsDark(detail.theme === 'dark')
    }
    window.addEventListener('theme-change', handleThemeChange)
    return () => window.removeEventListener('theme-change', handleThemeChange)
  }, [])

  return (
    <ConfigProvider theme={{ algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm }}>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout style={{ minHeight: '100vh' }}>
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
          <Layout>
            <Header collapsed={collapsed} setCollapsed={setCollapsed} />
            <Content style={{ margin: '16px', padding: 24, borderRadius: 8 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/servers" element={<Servers />} />
                <Route path="/gpus" element={<GPUs />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/users" element={<Users />} />
                <Route path="/reservations" element={<Reservations />} />
                <Route path="/reservations/new" element={<ReservationForm />} />
                <Route path="/reservations/mine" element={<MyReservations />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/requirements" element={<RequirementsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  )
}

export default App
