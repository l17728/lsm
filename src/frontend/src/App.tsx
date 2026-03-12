import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import GPUs from './pages/GPUs'
import Tasks from './pages/Tasks'
import Monitoring from './pages/Monitoring'
import Users from './pages/Users'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { useAuthStore } from './store/authStore'

const { Content } = Layout

function App() {
  const { isAuthenticated } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Layout>
        <Header collapsed={collapsed} setCollapsed={setCollapsed} />
        <Content style={{ margin: '16px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/gpus" element={<GPUs />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
