import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons'
import { serverApi } from '../services/api'
import type { ColumnsType } from 'antd/es/table'

interface Server {
  id: string
  name: string
  hostname: string
  ipAddress: string
  status: string
  cpuCores: number
  totalMemory: number
  gpuCount: number
  gpus: any[]
  createdAt: string
  updatedAt: string
}

const Servers: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    setLoading(true)
    try {
      const response = await serverApi.getAll()
      setServers(response.data.data)
    } catch (error: any) {
      message.error('Failed to load servers')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingServer(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (server: Server) => {
    setEditingServer(server)
    form.setFieldsValue(server)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await serverApi.delete(id)
      message.success('Server deleted')
      loadServers()
    } catch (error: any) {
      message.error('Failed to delete server')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (editingServer) {
        await serverApi.update(editingServer.id, values)
        message.success('Server updated')
      } else {
        await serverApi.create(values)
        message.success('Server created')
      }

      setModalVisible(false)
      loadServers()
    } catch (error: any) {
      if (error.message !== 'Validation failed') {
        message.error(editingServer ? 'Failed to update server' : 'Failed to create server')
      }
    }
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      ONLINE: 'green',
      OFFLINE: 'red',
      MAINTENANCE: 'orange',
      ERROR: 'volcano',
    }
    return colorMap[status] || 'default'
  }

  const columns: ColumnsType<Server> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      key: 'hostname',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'CPU Cores',
      dataIndex: 'cpuCores',
      key: 'cpuCores',
    },
    {
      title: 'Memory (GB)',
      dataIndex: 'totalMemory',
      key: 'totalMemory',
    },
    {
      title: 'GPUs',
      dataIndex: 'gpuCount',
      key: 'gpuCount',
      render: (count: number, record: Server) => (
        <span>{count} ({record.gpus?.filter((g: any) => g.status === 'AVAILABLE').length} available)</span>
      ),
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
          />
          <Popconfirm
            title="Delete server?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Servers</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Server
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={servers}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingServer ? 'Edit Server' : 'Add Server'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input server name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="hostname"
            label="Hostname"
            rules={[{ required: true, message: 'Please input hostname' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="ipAddress"
            label="IP Address"
            rules={[
              { required: true, message: 'Please input IP address' },
              { pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, message: 'Invalid IP address' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="cpuCores"
            label="CPU Cores"
            rules={[{ required: true, message: 'Please input CPU cores' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="totalMemory"
            label="Total Memory (GB)"
            rules={[{ required: true, message: 'Please input total memory' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="gpuCount"
            label="GPU Count"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Servers
