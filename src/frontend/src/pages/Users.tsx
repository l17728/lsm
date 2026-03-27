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
  displayName?: string   // Person name
  welink?: string        // WeLink account
  phone?: string         // Phone
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
      message.error('Failed to load user list, please refresh and try again')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({ 
      displayName: user.displayName,
      welink: user.welink,
      phone: user.phone,
      role: user.role 
    })
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
        await authApi.updateUser(editingUser.id, values)
        message.success('User information updated')
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
      title: 'Name',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (name: string) => name || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'WeLink',
      dataIndex: 'welink',
      key: 'welink',
      render: (welink: string) => welink || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
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
            Edit
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="Confirm user deletion?"
              onConfirm={() => handleDelete(record.id)}
              okText="Confirm"
              cancelText="Cancel"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // SUPER_ADMIN and ADMIN can access user management
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN'

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
        title="Edit User Information"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="displayName"
            label="Name"
          >
            <Input placeholder="Please enter name" />
          </Form.Item>
          <Form.Item
            name="welink"
            label="WeLink Account"
          >
            <Input placeholder="E.g., l00123456" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone"
          >
            <Input placeholder="Please enter phone number" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select role' }]}
          >
            <Select>
              <Select.Option value="USER">Regular User</Select.Option>
              <Select.Option value="MANAGER">Manager</Select.Option>
              <Select.Option value="ADMIN">Super Admin</Select.Option>
              <Select.Option value="SUPER_ADMIN">System Admin</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
