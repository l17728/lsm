import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Checkbox, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, CheckSquareOutlined, SquareOutlined } from '@ant-design/icons'
import { serverApi } from '../services/api'
import ExportButton from '../components/ExportButton'
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadServers()
  }, [])

  // Batch operation handlers (Day 7)
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select servers to delete')
      return
    }

    setBatchActionLoading(true)
    try {
      await serverApi.batchDelete(selectedRowKeys as string[])
      message.success(`Successfully deleted ${selectedRowKeys.length} servers`)
      setSelectedRowKeys([])
      loadServers()
    } catch (error: any) {
      message.error('Failed to batch delete servers')
    } finally {
      setBatchActionLoading(false)
    }
  }

  const handleBatchStatusChange = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select servers to update')
      return
    }

    setBatchActionLoading(true)
    try {
      await serverApi.batchUpdateStatus(selectedRowKeys as string[], status)
      message.success(`Successfully updated status for ${selectedRowKeys.length} servers`)
      setSelectedRowKeys([])
      loadServers()
    } catch (error: any) {
      message.error('Failed to batch update status')
    } finally {
      setBatchActionLoading(false)
    }
  }

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(servers.map(s => s.id))
    } else {
      setSelectedRowKeys([])
    }
  }

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

  // Batch selection column (Day 7)
  const batchColumns = {
    title: (
      <Checkbox
        checked={selectedRowKeys.length === servers.length && servers.length > 0}
        onChange={(e) => onSelectAll(e.target.checked)}
        indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < servers.length}
      />
    ),
    dataIndex: 'id',
    key: 'selection',
    width: 50,
    render: (_: any, record: Server) => (
      <Checkbox
        checked={selectedRowKeys.includes(record.id)}
        onChange={() => {
          const newSelected = selectedRowKeys.includes(record.id)
            ? selectedRowKeys.filter(key => key !== record.id)
            : [...selectedRowKeys, record.id]
          setSelectedRowKeys(newSelected)
        }}
      />
    ),
  }

  const columns: ColumnsType<Server> = [
    batchColumns,
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
        <Space>
          <ExportButton
            endpoint="/export/servers"
            filename="servers"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add Server
          </Button>
        </Space>
      </div>

      {/* Batch Operations Toolbar (Day 7) */}
      {selectedRowKeys.length > 0 && (
        <Alert
          message={`${selectedRowKeys.length} server(s) selected`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Space>
              <Button
                size="small"
                danger
                loading={batchActionLoading}
                onClick={handleBatchDelete}
              >
                Delete Selected
              </Button>
              <Button
                size="small"
                loading={batchActionLoading}
                onClick={() => handleBatchStatusChange('ONLINE')}
              >
                Set Online
              </Button>
              <Button
                size="small"
                loading={batchActionLoading}
                onClick={() => handleBatchStatusChange('OFFLINE')}
              >
                Set Offline
              </Button>
              <Button
                size="small"
                loading={batchActionLoading}
                onClick={() => handleBatchStatusChange('MAINTENANCE')}
              >
                Set Maintenance
              </Button>
              <Button
                size="small"
                onClick={() => setSelectedRowKeys([])}
              >
                Clear Selection
              </Button>
            </Space>
          }
        />
      )}

      <Table
        columns={columns}
        dataSource={servers}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
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
