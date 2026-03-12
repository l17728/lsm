import { Menu } from 'antd'
import {
  DashboardOutlined,
  ServerOutlined,
  GpuOutlined,
  TaskOutlined,
  MonitorOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { MenuProps } from 'antd'

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
      icon: <ServerOutlined />,
      label: 'Servers',
    },
    {
      key: '/gpus',
      icon: <GpuOutlined />,
      label: 'GPUs',
    },
    {
      key: '/tasks',
      icon: <TaskOutlined />,
      label: 'Tasks',
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: 'Monitoring',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Users',
    },
  ]

  const handleClick: MenuProps['onClick'] = (e) => {
    navigate(e.key)
  }

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={handleClick}
      inlineCollapsed={collapsed}
      style={{ height: '100%' }}
    />
  )
}

export default Sidebar
