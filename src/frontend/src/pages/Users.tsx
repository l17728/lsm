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
  displayName?: string   // 人名
  welink?: string        // WeLink账号
  phone?: string         // 电话
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
      message.error('不能删除自己')
      return
    }

    try {
      await authApi.deleteUser(id)
      message.success('用户已删除')
      loadUsers()
    } catch (error: any) {
      message.error('删除用户失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (editingUser) {
        await authApi.updateUser(editingUser.id, values)
        message.success('用户信息已更新')
      }

      setModalVisible(false)
      loadUsers()
    } catch (error: any) {
      if (error.message !== 'Validation failed') {
        message.error('更新用户失败')
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (name: string) => name || '-',
    },
    {
      title: '邮箱',
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
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={getRoleColor(role)}>{role}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.id === currentUser?.id}
          >
            编辑
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="确定删除该用户?"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
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
        title="编辑用户信息"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="displayName"
            label="姓名"
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="welink"
            label="WeLink账号"
          >
            <Input placeholder="例如: l00123456" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
          >
            <Input placeholder="请输入电话号码" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Select.Option value="USER">普通用户</Select.Option>
              <Select.Option value="MANAGER">管理员</Select.Option>
              <Select.Option value="ADMIN">超级管理员</Select.Option>
              <Select.Option value="SUPER_ADMIN">系统管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
