import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  ApiOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  MonitorOutlined,
  TeamOutlined,
  LineChartOutlined,
  CalendarOutlined,
  MessageOutlined,
  BookOutlined,
  BugOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { MenuProps } from 'antd'

const { Sider } = Layout

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/servers',
      icon: <ApiOutlined />,
      label: 'Servers',
    },
    {
      key: '/gpus',
      icon: <RocketOutlined />,
      label: 'GPUs',
    },
    {
      key: '/tasks',
      icon: <ClockCircleOutlined />,
      label: 'Tasks',
    },
    {
      key: '/reservations',
      icon: <CalendarOutlined />,
      label: 'Reservations',
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: 'Monitoring',
    },
    {
      key: '/analytics',
      icon: <LineChartOutlined />,
      label: 'Analytics',
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: 'Chat',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Users',
    },
    {
      key: '/docs',
      icon: <BookOutlined />,
      label: 'Docs',
    },
    {
      key: '/feedback',
      icon: <BugOutlined />,
      label: 'Feedback',
    },
    {
      key: '/requirements',
      icon: <FileTextOutlined />,
      label: 'Requirements',
    },
  ]

  const handleClick: MenuProps['onClick'] = (e) => {
    navigate(e.key)
  }

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: collapsed ? 16 : 20,
        fontWeight: 'bold',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {collapsed ? 'LSM' : 'LSM System'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleClick}
        style={{ height: 'calc(100% - 64px)' }}
      />
    </Sider>
  )
}

export default Sidebar
