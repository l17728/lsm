import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col, Statistic } from 'antd'
import { PlusOutlined, BugOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Feedback {
  id: string
  title: string
  description: string
  type: 'bug' | 'feature' | 'improvement'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reporter: string
  assignee?: string
  createdAt: string
  updatedAt: string
}

const FeedbackPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()

  useEffect(() => {
    loadFeedbacks()
  }, [])

  const loadFeedbacks = async () => {
    setLoading(true)
    try {
      // Mock data - replace with actual API call
      const mockData: Feedback[] = [
        { id: '1', title: 'Server Connection Timeout', description: 'Server connection often times out during peak hours', type: 'bug', status: 'open', priority: 'high', reporter: 'user1', createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' },
        { id: '2', title: 'Add GPU Monitoring Dashboard', description: 'Hope to add real-time GPU usage monitoring', type: 'feature', status: 'in_progress', priority: 'medium', reporter: 'user2', assignee: 'dev1', createdAt: '2024-01-14T09:00:00Z', updatedAt: '2024-01-15T11:00:00Z' },
        { id: '3', title: 'Optimize Task Scheduling Algorithm', description: 'Task scheduling efficiency can be further improved', type: 'improvement', status: 'resolved', priority: 'low', reporter: 'user3', createdAt: '2024-01-13T08:00:00Z', updatedAt: '2024-01-14T16:00:00Z' },
      ]
      setFeedbacks(mockData)
    } catch (error) {
      message.error('Failed to load feedback list')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      // API call would go here
      message.success('Feedback created successfully')
      setModalVisible(false)
      loadFeedbacks()
    } catch (error) {
      message.error('Creation failed')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      // API call would go here
      message.success('Status updated successfully')
      loadFeedbacks()
    } catch (error) {
      message.error('Update failed')
    }
  }

  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      bug: 'red',
      feature: 'blue',
      improvement: 'green',
    }
    return colorMap[type] || 'default'
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      open: 'default',
      in_progress: 'processing',
      resolved: 'success',
      closed: 'warning',
    }
    return colorMap[status] || 'default'
  }

  const getPriorityColor = (priority: string) => {
    const colorMap: Record<string, string> = {
      low: 'default',
      medium: 'orange',
      high: 'red',
      critical: 'magenta',
    }
    return colorMap[priority] || 'default'
  }

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      open: 'Pending',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed',
    }
    return textMap[status] || status
  }

  const filteredData = feedbacks.filter(item => {
    const matchStatus = filterStatus === 'all' || item.status === filterStatus
    const matchPriority = filterPriority === 'all' || item.priority === filterPriority
    const matchSearch = !searchText || 
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description.toLowerCase().includes(searchText.toLowerCase())
    return matchStatus && matchPriority && matchSearch
  })

  const columns: ColumnsType<Feedback> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => <Tag color={getPriorityColor(priority)}>{priority.toUpperCase()}</Tag>,
    },
    {
      title: 'Reporter',
      dataIndex: 'reporter',
      key: 'reporter',
      width: 100,
    },
    {
      title: 'Created Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Select
            size="small"
            value={record.status}
            style={{ width: 100 }}
            onChange={(value) => handleStatusChange(record.id, value)}
          >
            <Select.Option value="open">Pending</Select.Option>
            <Select.Option value="in_progress">In Progress</Select.Option>
            <Select.Option value="resolved">Resolved</Select.Option>
            <Select.Option value="closed">Closed</Select.Option>
          </Select>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Feedback Management</h1>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Pending" value={feedbacks.filter(f => f.status === 'open').length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="In Progress" value={feedbacks.filter(f => f.status === 'in_progress').length} prefix={<WarningOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Resolved" value={feedbacks.filter(f => f.status === 'resolved').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Total" value={feedbacks.length} prefix={<BugOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input.Search
              placeholder="Search feedback"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="open">Pending</Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="resolved">Resolved</Select.Option>
              <Select.Option value="closed">Closed</Select.Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterPriority} onChange={setFilterPriority}>
              <Select.Option value="all">All Priority</Select.Option>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Submit Feedback
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Submit Feedback"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter title' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please enter description' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Please select type' }]}>
            <Select>
              <Select.Option value="bug">Bug</Select.Option>
              <Select.Option value="feature">New Feature</Select.Option>
              <Select.Option value="improvement">Improvement Suggestion</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true, message: 'Please select priority' }]}>
            <Select>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FeedbackPage