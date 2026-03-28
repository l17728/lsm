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

  // Status text mappings
  const statusTextMap: Record<string, string> = {
    draft: 'Draft',
    reviewing: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
    implemented: 'Implemented',
  }

  // Priority label mappings
  const priorityTextMap: Record<string, string> = {
    p0: 'P0 - Highest',
    p1: 'P1 - High',
    p2: 'P2 - Medium',
    p3: 'P3 - Low',
  }

  // Category label mappings
  const categoryTextMap: Record<string, string> = {
    performance: 'Performance',
    feature: 'Feature',
    security: 'Security',
    usability: 'Usability',
    other: 'Other',
  }

  const loadRequirements = async () => {
    setLoading(true)
    try {
      // Mock data - replace with actual API call
      const mockData: Requirement[] = [
        {
          id: '1',
          title: 'Support multi-GPU parallel training',
          description: 'Allow users to use multiple GPUs simultaneously for model training to improve training efficiency',
          category: 'feature',
          status: 'approved',
          priority: 'p0',
          requester: 'ml_team',
          reviewer: 'arch_team',
          estimatedEffort: '2 weeks',
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-12T15:00:00Z',
          analysisReport: {
            feasibility: 'high',
            impact: 'high',
            recommendedPriority: 'P0',
            estimatedTime: '2-3 weeks',
            risks: ['Increased resource scheduling complexity', 'Need to improve fault tolerance mechanism'],
            suggestions: ['Implement in phases', 'First support homogeneous GPUs', 'Later extend to heterogeneous support'],
          },
        },
        {
          id: '2',
          title: 'Optimize task queue scheduling',
          description: 'Improve task scheduling algorithm to enhance resource utilization and task response speed',
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
            estimatedTime: '1-2 weeks',
            risks: ['May affect existing scheduling logic', 'Requires thorough testing'],
            suggestions: ['First conduct performance benchmark testing', 'Design rollback mechanism'],
          },
        },
        {
          id: '3',
          title: 'Enhance user permission management',
          description: 'Support more fine-grained user permission control and resource quota management',
          category: 'security',
          status: 'implemented',
          priority: 'p1',
          requester: 'security_team',
          reviewer: 'arch_team',
          estimatedEffort: '3 weeks',
          createdAt: '2024-01-01T08:00:00Z',
          updatedAt: '2024-01-15T16:00:00Z',
        },
      ]
      setRequirements(mockData)
    } catch (error) {
      message.error('Failed to load requirements list')
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
      message.success('Requirement submitted')
      setModalVisible(false)
      loadRequirements()
    } catch (error) {
      message.error('Submission failed')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      // API call would go here
      message.success('Status updated')
      loadRequirements()
    } catch (error) {
      message.error('Update failed')
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
    return statusTextMap[status] || status
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
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => <Tag color={getCategoryColor(category)}>{categoryTextMap[category] || category}</Tag>,
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
      render: (priority: string) => <Tag color={getPriorityColor(priority)}>{priorityTextMap[priority] || priority.toUpperCase()}</Tag>,
    },
    {
      title: 'Requester',
      dataIndex: 'requester',
      key: 'requester',
      width: 100,
    },
    {
      title: 'Estimated Effort',
      dataIndex: 'estimatedEffort',
      key: 'estimatedEffort',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            Details
          </Button>
          <Select
            size="small"
            value={record.status}
            style={{ width: 100 }}
            onChange={(value) => handleStatusChange(record.id, value)}
          >
            <Select.Option value="draft">Draft</Select.Option>
            <Select.Option value="reviewing">In Review</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
            <Select.Option value="implemented">Implemented</Select.Option>
          </Select>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>Requirements Management</h1>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Pending Review" value={requirements.filter(r => r.status === 'reviewing').length} prefix={<SyncOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Approved" value={requirements.filter(r => r.status === 'approved').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Implemented" value={requirements.filter(r => r.status === 'implemented').length} prefix={<FileTextOutlined />} valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Total" value={requirements.length} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input.Search
              placeholder="Search requirements"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="draft">Draft</Select.Option>
              <Select.Option value="reviewing">In Review</Select.Option>
              <Select.Option value="approved">Approved</Select.Option>
              <Select.Option value="rejected">Rejected</Select.Option>
              <Select.Option value="implemented">Implemented</Select.Option>
            </Select>
          </Col>
          <Col span={14} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Submit Requirement
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
        title="Submit Requirement"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Requirement Title" rules={[{ required: true, message: 'Please enter requirement title' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Requirement Description" rules={[{ required: true, message: 'Please enter requirement description' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select category' }]}>
                <Select>
                  <Select.Option value="performance">Performance</Select.Option>
                  <Select.Option value="feature">Feature</Select.Option>
                  <Select.Option value="security">Security</Select.Option>
                  <Select.Option value="usability">Usability</Select.Option>
                  <Select.Option value="other">Other</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" rules={[{ required: true, message: 'Please select priority' }]}>
                <Select>
                  <Select.Option value="p0">P0 - Highest</Select.Option>
                  <Select.Option value="p1">P1 - High</Select.Option>
                  <Select.Option value="p2">P2 - Medium</Select.Option>
                  <Select.Option value="p3">P3 - Low</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="estimatedEffort" label="Estimated Effort">
            <Input placeholder="e.g., 2 weeks" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Requirement Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedRequirement && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Requirement Title" span={2}>{selectedRequirement.title}</Descriptions.Item>
              <Descriptions.Item label="Category">{selectedRequirement.category}</Descriptions.Item>
              <Descriptions.Item label="Priority">{selectedRequirement.priority.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>{getStatusText(selectedRequirement.status)}</Descriptions.Item>
              <Descriptions.Item label="Requester">{selectedRequirement.requester}</Descriptions.Item>
              <Descriptions.Item label="Reviewer">{selectedRequirement.reviewer || '-'}</Descriptions.Item>
              <Descriptions.Item label="Estimated Effort" span={2}>{selectedRequirement.estimatedEffort || '-'}</Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>{selectedRequirement.description}</Descriptions.Item>
            </Descriptions>
            {selectedRequirement.analysisReport && (
              <Card title="Analysis Report" size="small">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>Feasibility</div>
                    <Progress percent={(selectedRequirement.analysisReport?.feasibility || 'low') === 'high' ? 90 : (selectedRequirement.analysisReport?.feasibility || 'low') === 'medium' ? 60 : 30} status={(selectedRequirement.analysisReport?.feasibility || 'low') === 'high' ? 'success' : 'normal'} />
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>Impact</div>
                    <Progress percent={selectedRequirement.analysisReport.impact === 'high' ? 90 : selectedRequirement.analysisReport.impact === 'medium' ? 60 : 30} status={selectedRequirement.analysisReport.impact === 'high' ? 'exception' : 'normal'} />
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 8 }}>Estimated Time</div>
                    <div style={{ fontWeight: 'bold' }}>{selectedRequirement.analysisReport.estimatedTime}</div>
                  </Col>
                </Row>
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Risks:</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(selectedRequirement.analysisReport.risks || []).map((risk, i) => <li key={i}>{risk}</li>)}
                  </ul>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Suggestions:</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(selectedRequirement.analysisReport.suggestions || []).map((s, i) => <li key={i}>{s}</li>)}
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
