import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd'
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { ExportButton } from '../components/ExportButton'
import type { ColumnsType } from 'antd/es/table'

interface User {
  id: string
  username: string
  email: string
  role: string
  createdAt: string
  updatedAt: string
}

const Users: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await authApi.getUsers()
      setUsers(response.data.data)
      console.log(`[Users] Loaded ${response.data.data?.length ?? 0} users`)
    } catch (error: any) {
      console.error('[Users] Failed to load users:', error)
      message.error('用户列表加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({ role: user.role })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      message.error('Cannot delete yourself')
      return
    }

    try {
      await authApi.deleteUser(id)
      message.success('User deleted')
      loadUsers()
    } catch (error: any) {
      message.error('Failed to delete user')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (editingUser) {
        await authApi.updateUserRole(editingUser.id, values.role)
        message.success('User role updated')
      }

      setModalVisible(false)
      loadUsers()
    } catch (error: any) {
      if (error.message !== 'Validation failed') {
        message.error('Failed to update user')
      }
    }
  }

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      ADMIN: 'red',
      MANAGER: 'blue',
      USER: 'green',
    }
    return colorMap[role] || 'default'
  }

  const columns: ColumnsType<User> = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={getRoleColor(role)}>{role}</Tag>,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: 'Updated At',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.id === currentUser?.id}
          >
            Edit Role
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="Delete user?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const isAdmin = currentUser?.role === 'ADMIN'

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <h2>Access Denied</h2>
        <p>Only administrators can access user management.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>User Management</h1>
        <ExportButton endpoint="/api/export/users" filename="users" formats={[{ key: 'excel', label: 'Excel', extension: 'xlsx' }]} />
      </div>

      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="Edit User Role"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select>
              <Select.Option value="USER">User</Select.Option>
              <Select.Option value="MANAGER">Manager</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
