import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Checkbox, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, StopOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { taskApi } from '../services/api'
import { wsService } from '../services/websocket'
import { ExportButton } from '../components/ExportButton'
import type { ColumnsType } from 'antd/es/table'

interface Task {
  id: string
  name: string
  description?: string
  status: string
  priority: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

const Tasks: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadTasks()

    wsService.on('tasks:update', () => {
      loadTasks()
    })

    wsService.on('task:update', () => {
      loadTasks()
    })

    return () => {
      wsService.off('tasks:update', () => {})
      wsService.off('task:update', () => {})
    }
  }, [])

  // Batch operation handlers (Day 7)
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to delete')
      return
    }

    setBatchActionLoading(true)
    try {
      await taskApi.batchDelete(selectedRowKeys as string[])
      message.success(`Successfully deleted ${selectedRowKeys.length} tasks`)
      setSelectedRowKeys([])
      loadTasks()
    } catch (error: any) {
      message.error('Failed to batch delete tasks')
    } finally {
      setBatchActionLoading(false)
    }
  }

  const handleBatchCancel = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to cancel')
      return
    }

    setBatchActionLoading(true)
    try {
      await taskApi.batchCancel(selectedRowKeys as string[])
      message.success(`Successfully cancelled ${selectedRowKeys.length} tasks`)
      setSelectedRowKeys([])
      loadTasks()
    } catch (error: any) {
      message.error('Failed to batch cancel tasks')
    } finally {
      setBatchActionLoading(false)
    }
  }

  const handleBatchStatusChange = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to update')
      return
    }

    setBatchActionLoading(true)
    try {
      await taskApi.batchUpdateStatus(selectedRowKeys as string[], status)
      message.success(`Successfully updated status for ${selectedRowKeys.length} tasks`)
      setSelectedRowKeys([])
      loadTasks()
    } catch (error: any) {
      message.error('Failed to batch update status')
    } finally {
      setBatchActionLoading(false)
    }
  }

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(tasks.map(t => t.id))
    } else {
      setSelectedRowKeys([])
    }
  }

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await taskApi.getAll()
      setTasks(response.data.data)
    } catch (error: any) {
      message.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleCancel = async (id: string) => {
    try {
      await taskApi.cancel(id)
      message.success('Task cancelled')
      loadTasks()
    } catch (error: any) {
      message.error('Failed to cancel task')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await taskApi.delete(id)
      message.success('Task deleted')
      loadTasks()
    } catch (error: any) {
      message.error('Failed to delete task')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await taskApi.create(values)
      message.success('Task created')
      setModalVisible(false)
      loadTasks()
    } catch (error: any) {
      if (error.message !== 'Validation failed') {
        message.error('Failed to create task')
      }
    }
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      PENDING: 'default',
      RUNNING: 'processing',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'warning',
    }
    return colorMap[status] || 'default'
  }

  // Batch selection column (Day 7)
  const batchColumns = {
    title: (
      <Checkbox
        checked={selectedRowKeys.length === tasks.length && tasks.length > 0}
        onChange={(e) => onSelectAll(e.target.checked)}
        indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < tasks.length}
      />
    ),
    dataIndex: 'id',
    key: 'selection',
    width: 50,
    render: (_: any, record: Task) => (
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

  const columns: ColumnsType<Task> = [
    batchColumns,
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Tag color={priority > 5 ? 'red' : priority > 2 ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      ),
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
          {record.status === 'PENDING' && (
            <Popconfirm
              title="Cancel task?"
              onConfirm={() => handleCancel(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger icon={<StopOutlined />}>
                Cancel
              </Button>
            </Popconfirm>
          )}
          {(record.status === 'COMPLETED' || record.status === 'CANCELLED' || record.status === 'FAILED') && (
            <Popconfirm
              title="Delete task?"
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Tasks</h1>
        <Space>
          <ExportButton endpoint="/api/export/tasks" filename="tasks" />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Task
          </Button>
        </Space>
      </div>

      {/* Batch Operations Toolbar (Day 7) */}
      {selectedRowKeys.length > 0 && (
        <Alert
          message={`${selectedRowKeys.length} task(s) selected`}
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
                danger
                loading={batchActionLoading}
                onClick={handleBatchCancel}
              >
                Cancel Selected
              </Button>
              <Button
                size="small"
                loading={batchActionLoading}
                onClick={() => handleBatchStatusChange('COMPLETED')}
              >
                Mark Complete
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
        dataSource={tasks}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Create Task"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Task Name"
            rules={[
              { required: true, message: 'Please input task name' },
              { max: 100, message: 'Task name must be less than 100 characters' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority (0-10)"
            initialValue={0}
            rules={[{ type: 'number', min: 0, max: 10 }]}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Tasks
