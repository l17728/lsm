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
        { id: '1', title: '服务器连接超时', description: '在高峰期连接服务器经常超时', type: 'bug', status: 'open', priority: 'high', reporter: 'user1', createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' },
        { id: '2', title: '新增GPU监控面板', description: '希望增加GPU使用率的实时监控', type: 'feature', status: 'in_progress', priority: 'medium', reporter: 'user2', assignee: 'dev1', createdAt: '2024-01-14T09:00:00Z', updatedAt: '2024-01-15T11:00:00Z' },
        { id: '3', title: '优化任务调度算法', description: '任务调度效率可以进一步提升', type: 'improvement', status: 'resolved', priority: 'low', reporter: 'user3', createdAt: '2024-01-13T08:00:00Z', updatedAt: '2024-01-14T16:00:00Z' },
      ]
      setFeedbacks(mockData)
    } catch (error) {
      message.error('加载问题列表失败')
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
      message.success('问题已创建')
      setModalVisible(false)
      loadFeedbacks()
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      // API call would go here
      message.success('状态已更新')
      loadFeedbacks()
    } catch (error) {
      message.error('更新失败')
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
      open: '待处理',
      in_progress: '处理中',
      resolved: '已解决',
      closed: '已关闭',
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
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => <Tag color={getPriorityColor(priority)}>{priority.toUpperCase()}</Tag>,
    },
    {
      title: '报告人',
      dataIndex: 'reporter',
      key: 'reporter',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
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
            <Select.Option value="open">待处理</Select.Option>
            <Select.Option value="in_progress">处理中</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
            <Select.Option value="closed">已关闭</Select.Option>
          </Select>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>问题反馈管理</h1>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待处理" value={feedbacks.filter(f => f.status === 'open').length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="处理中" value={feedbacks.filter(f => f.status === 'in_progress').length} prefix={<WarningOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已解决" value={feedbacks.filter(f => f.status === 'resolved').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总计" value={feedbacks.length} prefix={<BugOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input.Search
              placeholder="搜索问题"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="open">待处理</Select.Option>
              <Select.Option value="in_progress">处理中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterPriority} onChange={setFilterPriority}>
              <Select.Option value="all">全部优先级</Select.Option>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="critical">紧急</Select.Option>
            </Select>
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              提交问题
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
        title="提交问题"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select>
              <Select.Option value="bug">Bug</Select.Option>
              <Select.Option value="feature">新功能</Select.Option>
              <Select.Option value="improvement">改进建议</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="critical">紧急</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FeedbackPage