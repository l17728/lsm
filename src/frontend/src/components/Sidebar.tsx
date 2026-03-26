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
  ClusterOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../store/authStore'

const { Sider } = Layout

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { user } = useAuthStore()
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const baseMenuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('navigation.dashboard'),
    },
    {
      key: '/servers',
      icon: <ApiOutlined />,
      label: t('navigation.servers'),
    },
    {
      key: '/clusters',
      icon: <ClusterOutlined />,
      label: t('navigation.clusters'),
    },
    {
      key: '/gpus',
      icon: <RocketOutlined />,
      label: t('navigation.gpus'),
    },
    {
      key: '/tasks',
      icon: <ClockCircleOutlined />,
      label: t('navigation.tasks'),
    },
    {
      key: '/reservations',
      icon: <CalendarOutlined />,
      label: t('navigation.reservations'),
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: t('navigation.monitoring'),
    },
    {
      key: '/analytics',
      icon: <LineChartOutlined />,
      label: t('navigation.analytics'),
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: t('navigation.chat'),
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: t('navigation.users'),
    },
  ]
  
  // Add SUPER_ADMIN only menu items
  const adminMenuItems: MenuProps['items'] = isSuperAdmin ? [
    {
      key: '/clusters/approval',
      icon: <CheckCircleOutlined />,
      label: '预约审批',
    },
  ] : []
  
  const bottomMenuItems: MenuProps['items'] = [
    {
      key: '/docs',
      icon: <BookOutlined />,
      label: t('navigation.docs'),
    },
    {
      key: '/feedback',
      icon: <BugOutlined />,
      label: t('navigation.feedback'),
    },
    {
      key: '/requirements',
      icon: <FileTextOutlined />,
      label: t('navigation.requirements'),
    },
  ]
  
  const menuItems: MenuProps['items'] = [...baseMenuItems, ...adminMenuItems, ...bottomMenuItems]

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
