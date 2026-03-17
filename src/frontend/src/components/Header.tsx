import { Layout, Button, Avatar, Dropdown, Space } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'

const { Header: AntHeader } = Layout

interface HeaderProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const Header: React.FC<HeaderProps> = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      navigate('/login')
    }
  }

  const menuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('navigation.logout'),
      onClick: handleLogout,
    },
  ]

  return (
    <AntHeader
      style={{
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{ fontSize: '16px', width: 64, height: 64 }}
      />

      <Space size="middle">
        {/* Theme Toggle */}
        <ThemeToggle />
        
        {/* Language Switcher */}
        <LanguageSwitcher />
        
        {/* User Info & Avatar */}
        <Space>
          <span>{user?.username}</span>
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', cursor: 'pointer' }} />
          </Dropdown>
        </Space>
      </Space>
    </AntHeader>
  )
}

export default Header
