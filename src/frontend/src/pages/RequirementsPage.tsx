import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col, Statistic, Progress, Descriptions } from 'antd'
import { PlusOutlined, FileTextOutlined, CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, BarChartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Requirement {
  id: string
  title: string
  description: string
  category: 'performance' | 'feature' | 'security' | 'usability' | 'other'
  status: 'draft' | 'reviewing' | 'approved' | 'rejected' | 'implemented'
  priority: 'p0' | 'p1' | 'p2' | 'p3'
  requester: string
  reviewer?: string
  estimatedEffort?: string
  createdAt: string
  updatedAt: string
  analysisReport?: {
    feasibility: 'high' | 'medium' | 'low'
    impact: 'high' | 'medium' | 'low'
    recommendedPriority: string
    estimatedTime: string
    risks: string[]
    suggestions: string[]
  }
}

const RequirementsPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()

  useEffect(() => {
    loadRequirements()
  }, [])

  const loadRequirements = async () => {
    setLoading(true)
    try {
      // Mock data - replace with actual API call
      const mockData: Requirement[] = [
        {
          id: '1',
          title: '支持多GPU并行训练',
          description: '允许用户同时使用多个GPU进行模型训练，提升训练效率',
          category: 'feature',
          status: 'approved',
          priority: 'p0',
          requester: 'ml_team',
          reviewer: 'arch_team',
          estimatedEffort: '2周',
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-12T15:00:00Z',
          analysisReport: {
            feasibility: 'high',
            impact: 'high',
            recommendedPriority: 'P0',
            estimatedTime: '2-3周',
            risks: ['资源调度复杂度增加', '需要完善容错机制'],
            suggestions: ['分阶段实施', '先支持同构GPU', '后续扩展异构支持'],
          },
        },
        {
          id: '2',
          title: '优化任务队列调度',
          description: '改进任务调度算法，提升资源利用率和任务响应速度',
          category: 'performance',
          status: 'reviewing',
          priority: 'p1',
          requester: 'ops_team',
          createdAt: '2024-01-08T09:00:00Z',
          updatedAt: '2024-01-09T11:00:00Z',
          analysisReport: {
            feasibility: 'medium',
            impact: 'high',
            recommendedPriority: 'P1',
            estimatedTime: '1-2周',
            risks: ['可能影响现有调度逻辑', '需要充分测试'],
            suggestions: ['先进行性能基准测试', '设计回滚机制'],
          },
        },
        {
          id: '3',
          title: '增强用户权限管理',
          description: '支持更细粒度的用户权限控制和资源配额管理',
          category: 'security',
          status: 'implemented',
          priority: 'p1',
          requester: 'security_team',
          reviewer: 'arch_team',
          estimatedEffort: '3周',
          createdAt: '2024-01-01T08:00:00Z',
          updatedAt: '2024-01-15T16:00:00Z',
        },
      ]
      setRequirements(mockData)
    } catch (error) {
      message.error('加载需求列表失败')
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
      message.success('需求已提交')
      setModalVisible(false)
      loadRequirements()
    } catch (error) {
      message.error('提交失败')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      // API call would go here
      message.success('状态已更新')
      loadRequirements()
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleViewDetail = (record: Requirement) => {
    setSelectedRequirement(record)
    setDetailModalVisible(true)
  }

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      performance: 'blue',
      feature: 'green',
      security: 'red',
      usability: 'orange',
      other: 'default',
    }
    return colorMap[category] || 'default'
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      draft: 'default',
      reviewing: 'processing',
      approved: 'success',
      rejected: 'error',
      implemented: 'cyan',
    }
    return colorMap[status] || 'default'
  }

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      draft: '草稿',
      reviewing: '评审中',
      approved: '已批准',
      rejected: '已拒绝',
      implemented: '已实现',
    }
    return textMap[status] || status
  }

  const getPriorityColor = (priority: string) => {
    const colorMap: Record<string, string> = {
      p0: 'magenta',
      p1: 'red',
      p2: 'orange',
      p3: 'default',
    }
    return colorMap[priority] || 'default'
  }

  const filteredData = requirements.filter(item => {
    const matchStatus = filterStatus === 'all' || item.status === filterStatus
    const matchSearch = !searchText ||
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description.toLowerCase().includes(searchText.toLowerCase())
    return matchStatus && matchSearch
  })

  const columns: ColumnsType<Requirement> = [
    {
      title: '需求标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => <Tag color={getCategoryColor(category)}>{category}</Tag>,
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
      title: '提出人',
      dataIndex: 'requester',
      key: 'requester',
      width: 100,
    },
    {
      title: '预估工时',
      dataIndex: 'estimatedEffort',
      key: 'estimatedEffort',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Select
            size="small"
            value={record.status}
            style={{ width: 100 }}
            onChange={(value) => handleStatusChange(record.id, value)}
          >
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="reviewing">评审中</Select.Option>
            <Select.Option value="approved">已批准</Select.Option>
            <Select.Option value="rejected">已拒绝</Select.Option>
            <Select.Option value="implemented">已实现</Select.Option>
          </Select>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>需求管理</h1>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待评审" value={requirements.filter(r => r.status === 'reviewing').length} prefix={<SyncOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已批准" value={requirements.filter(r => r.status === 'approved').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已实现" value={requirements.filter(r => r.status === 'implemented').length} prefix={<FileTextOutlined />} valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总计" value={requirements.length} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input.Search
              placeholder="搜索需求"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="reviewing">评审中</Select.Option>
              <Select.Option value="approved">已批准</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
              <Select.Option value="implemented">已实现</Select.Option>
            </Select>
          </Col>
          <Col span={14} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              提交需求
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
        title="提交需求"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="需求标题" rules={[{ required: true, message: '请输入需求标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="需求描述" rules={[{ required: true, message: '请输入需求描述' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
                <Select>
                  <Select.Option value="performance">性能优化</Select.Option>
                  <Select.Option value="feature">新功能</Select.Option>
                  <Select.Option value="security">安全</Select.Option>
                  <Select.Option value="usability">易用性</Select.Option>
                  <Select.Option value="other">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
                <Select>
                  <Select.Option value="p0">P0 - 最高</Select.Option>
                  <Select.Option value="p1">P1 - 高</Select.Option>
                  <Select.Option value="p2">P2 - 中</Select.Option>
                  <Select.Option value="p3">P3 - 低</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="estimatedEffort" label="预估工时">
            <Input placeholder="例如：2周" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="需求详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedRequirement && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="需求标题" span={2}>{selectedRequirement.title}</Descriptions.Item>
              <Descriptions.Item label="类别">{selectedRequirement.category}</Descriptions.Item>
              <Descriptions.Item label="优先级">{selectedRequirement.priority.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>{getStatusText(selectedRequirement.status)}</Descriptions.Item>
              <Descriptions.Item label="提出人">{selectedRequirement.requester}</Descriptions.Item>
              <Descriptions.Item label="评审人">{selectedRequirement.reviewer || '-'}</Descriptions.Item>
              <Descriptions.Item label="预估工时" span={2}>{selectedRequirement.estimatedEffort || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedRequirement.description}</Descriptions.Item>
            </Descriptions>
            {selectedRequirement.analysisReport && (
              <Card title="分析报告" size="small">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>可行性</div>
                    <Progress percent={selectedRequirement.analysisReport.feasibility === 'high' ? 90 : selectedRequirement.analysisReport.feasibility === 'medium' ? 60 : 30} status={selectedRequirement.analysisReport.feasibility === 'high' ? 'success' : 'normal'} />
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>影响力</div>
                    <Progress percent={selectedRequirement.analysisReport.impact === 'high' ? 90 : selectedRequirement.analysisReport.impact === 'medium' ? 60 : 30} status={selectedRequirement.analysisReport.impact === 'high' ? 'exception' : 'normal'} />
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>预估时间</div>
                    <div style={{ fontWeight: 'bold' }}>{selectedRequirement.analysisReport.estimatedTime}</div>
                  </Col>
                </Row>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>风险项：</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {selectedRequirement.analysisReport.risks.map((risk, i) => <li key={i}>{risk}</li>)}
                  </ul>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>建议：</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {selectedRequirement.analysisReport.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default RequirementsPage