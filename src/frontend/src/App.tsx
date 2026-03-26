import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme as antTheme, Spin } from 'antd'
import { useAuthStore } from './store/authStore'

// Fix: All page components now use React.lazy() for code-splitting.
// Previously all pages were statically imported, causing every page's code to be
// bundled together and downloaded on first load, making the initial page load very slow.
// With lazy loading, each page's code is only downloaded when the user navigates to it.
const Login           = lazy(() => import('./pages/Login'))
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const Servers         = lazy(() => import('./pages/Servers'))
const Clusters        = lazy(() => import('./pages/Clusters'))
const ClusterApproval = lazy(() => import('./pages/ClusterApproval'))
const GPUs            = lazy(() => import('./pages/GPUs'))
const Tasks           = lazy(() => import('./pages/Tasks'))
const Monitoring      = lazy(() => import('./pages/Monitoring'))
const Analytics       = lazy(() => import('./pages/Analytics'))
const Users           = lazy(() => import('./pages/Users'))
const Reservations    = lazy(() => import('./pages/Reservations'))
const ReservationForm = lazy(() => import('./pages/ReservationForm'))
const MyReservations  = lazy(() => import('./pages/MyReservations'))
const ChatPage        = lazy(() => import('./pages/ChatPage'))
const DocsPage        = lazy(() => import('./pages/DocsPage'))
const FeedbackPage    = lazy(() => import('./pages/FeedbackPage'))
const RequirementsPage = lazy(() => import('./pages/RequirementsPage'))

// Non-lazy: Sidebar and Header are always shown when authenticated, no benefit in splitting
import Sidebar from './components/Sidebar'
import Header from './components/Header'

const { Content } = Layout

/** Fallback shown while a lazy page chunk is being downloaded */
const PageLoading = (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <Spin size="large" tip="页面加载中..." />
  </div>
)

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
        <Suspense fallback={PageLoading}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      ) : (
        <Layout style={{ minHeight: '100vh' }}>
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
          <Layout>
            <Header collapsed={collapsed} setCollapsed={setCollapsed} />
            <Content style={{ margin: '16px', padding: 24, borderRadius: 8 }}>
              <Suspense fallback={PageLoading}>
                <Routes>
<Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/servers" element={<Servers />} />
                  <Route path="/clusters" element={<Clusters />} />
                  <Route path="/clusters/approval" element={<ClusterApproval />} />
                  <Route path="/gpus" element={<GPUs />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/reservations" element={<Reservations />} />
                  <Route path="/reservations/new" element={<ReservationForm />} />
                  <Route path="/reservations/mine" element={<MyReservations />} />
                  <Route path="/monitoring" element={<Monitoring />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/requirements" element={<RequirementsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  )
}

export default App
