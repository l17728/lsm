import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Card, Row, Col, Statistic, message, Modal } from 'antd'
import { RocketOutlined, PlusOutlined, LogoutOutlined } from '@ant-design/icons'

// Icon aliases for compatibility
const GpuOutlined = RocketOutlined;
const ReleaseOutlined = LogoutOutlined;
import { gpuApi } from '../services/api'
import { wsService } from '../services/websocket'
import { ExportButton } from '../components/ExportButton'
import type { ColumnsType } from 'antd/es/table'

interface GpuAllocation {
  id: string
  gpu: {
    id: string
    model: string
    memory: number
    deviceId: number
    server: {
      name: string
    }
  }
  startTime: string
  status: string
}

const GPUs: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [allocations, setAllocations] = useState<GpuAllocation[]>([])
  const [allocateModalVisible, setAllocateModalVisible] = useState(false)

  useEffect(() => {
    loadData()

    const onGpusUpdate = () => { loadData() }
    wsService.on('gpus:update', onGpusUpdate)

    return () => {
      wsService.off('gpus:update', onGpusUpdate)
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, allocationsRes] = await Promise.allSettled([
        gpuApi.getStats(),
        gpuApi.getMyAllocations(),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.data)
      } else {
        console.error('[GPUs] Failed to load GPU stats:', statsRes.reason)
        message.error('GPU 统计数据加载失败，请刷新重试')
      }

      if (allocationsRes.status === 'fulfilled') {
        setAllocations(allocationsRes.value.data.data)
      } else {
        console.error('[GPUs] Failed to load GPU allocations:', allocationsRes.reason)
        message.error('GPU 分配列表加载失败，请刷新重试')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAllocate = async () => {
    try {
      await gpuApi.allocate()
      message.success('GPU allocated successfully')
      setAllocateModalVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to allocate GPU')
    }
  }

  const handleRelease = async (allocationId: string) => {
    try {
      await gpuApi.release(allocationId)
      message.success('GPU released')
      loadData()
    } catch (error: any) {
      message.error('Failed to release GPU')
    }
  }

  const columns: ColumnsType<GpuAllocation> = [
    {
      title: 'GPU Model',
      dataIndex: ['gpu', 'model'],
      key: 'model',
    },
    {
      title: 'Memory',
      dataIndex: ['gpu', 'memory'],
      key: 'memory',
      render: (memory: number) => `${memory} GB`,
    },
    {
      title: 'Server',
      dataIndex: ['gpu', 'server', 'name'],
      key: 'server',
    },
    {
      title: 'Device ID',
      dataIndex: ['gpu', 'deviceId'],
      key: 'deviceId',
    },
    {
      title: 'Allocated At',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="processing">{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<ReleaseOutlined />}
          onClick={() => handleRelease(record.id)}
        >
          Release
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>GPU Resources</h1>
        <Space>
          <ExportButton endpoint="/api/export/gpus" filename="gpus" formats={[{ key: 'excel', label: 'Excel', extension: 'xlsx' }]} />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAllocateModalVisible(true)}
          >
            Allocate GPU
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total GPUs"
              value={stats?.total || 0}
              prefix={<GpuOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Available"
              value={stats?.available || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Allocated"
              value={stats?.allocated || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="My Allocations"
              value={allocations.length}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <h3>My GPU Allocations</h3>
      <Table
        columns={columns}
        dataSource={allocations}
        loading={loading}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title="Allocate GPU"
        open={allocateModalVisible}
        onOk={handleAllocate}
        onCancel={() => setAllocateModalVisible(false)}
      >
        <p>Allocate a GPU for your tasks. The system will assign an available GPU based on your requirements.</p>
      </Modal>
    </div>
  )
}

export default GPUs
