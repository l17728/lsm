import React, { useEffect, useState } from 'react'
import {
  Card,
  Form,
  Radio,
  Select,
  DatePicker,
  TimePicker,
  Input,
  Button,
  Space,
  message,
  Typography,
  Alert,
  Row,
  Col,
  Spin,
  Tag,
  Grid,
} from 'antd'
import {
  DesktopOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import { useReservationStore } from '../store/reservationStore'
import { useAuthStore } from '../store/authStore'
import type { Server, ReservationFormValues } from '../services/reservation.service'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

const ReservationForm: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [selectedGpus, setSelectedGpus] = useState<string[]>([])
  const [duration, setDuration] = useState<number>(0)
  const [conflicts, setConflicts] = useState<string[]>([])

  const {
    availableServers,
    userQuota,
    loading,
    fetchAvailableServers,
    fetchUserQuota,
    createReservation,
    error,
    clearError,
  } = useReservationStore()

  const { user } = useAuthStore()

  // 初始化数据
  useEffect(() => {
    fetchAvailableServers()
    fetchUserQuota()
    
    // 处理从日历跳转带来的预填数据
    const state = location.state as any
    if (state) {
      form.setFieldsValue({
        serverId: state.serverId,
        dateRange: [
          state.startTime ? dayjs(state.startTime) : undefined,
          state.endTime ? dayjs(state.endTime) : undefined,
        ],
      })
    }
  }, [])

  // 计算剩余配额
  const remainingQuota = userQuota
    ? userQuota.maxHoursPerWeek - userQuota.usedHoursThisWeek
    : 0

  // 计算预计时长
  const calculateDuration = () => {
    const values = form.getFieldsValue()
    if (values.startTime && values.endTime) {
      const start = dayjs(values.startTime)
      const end = dayjs(values.endTime)
      const hours = end.diff(start, 'hour', true)
      setDuration(Math.round(hours * 10) / 10)
    }
  }

  // 处理服务器选择
  const handleServerChange = (serverId: string) => {
    const server = availableServers.find((s) => s.id === serverId)
    setSelectedServer(server || null)
    setSelectedGpus([])
    form.setFieldValue('gpuIds', [])
  }

  // 处理 GPU 选择
  const handleGpuToggle = (gpuId: string) => {
    const mode = form.getFieldValue('mode')
    let newSelection: string[]

    if (mode === 'single-gpu') {
      newSelection = [gpuId]
    } else {
      if (selectedGpus.includes(gpuId)) {
        newSelection = selectedGpus.filter((id) => id !== gpuId)
      } else {
        newSelection = [...selectedGpus, gpuId]
      }
    }

    setSelectedGpus(newSelection)
    form.setFieldValue('gpuIds', newSelection)
  }

  // 处理模式变更
  const handleModeChange = (mode: string) => {
    if (mode === 'whole-server' && selectedServer) {
      // 整服务器模式，选择所有 GPU
      const allGpuIds = selectedServer.gpus.map((g) => g.id)
      setSelectedGpus(allGpuIds)
      form.setFieldValue('gpuIds', allGpuIds)
    } else {
      setSelectedGpus([])
      form.setFieldValue('gpuIds', [])
    }
  }

  // 提交表单
  const handleSubmit = async (values: any) => {
    setSubmitting(true)
    setConflicts([])

    try {
      const data: ReservationFormValues = {
        mode: values.mode,
        serverId: values.serverId,
        gpuIds: values.gpuIds || [],
        startTime: values.startTime,
        endTime: values.endTime,
        purpose: values.purpose,
      }

      await createReservation(data)
      message.success('预约创建成功')
      navigate('/reservations/mine')
    } catch (error: any) {
      if (error.response?.data?.conflicts) {
        setConflicts(error.response.data.conflicts)
      }
      message.error(error.response?.data?.message || '创建预约失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 取消
  const handleCancel = () => {
    navigate(-1)
  }

  // 渲染 GPU 选择器
  const renderGpuSelector = () => {
    if (!selectedServer) return null

    const mode = form.getFieldValue('mode')
    const isWholeServer = mode === 'whole-server'

    return (
      <Form.Item label="选择 GPU">
        <div className="gpu-grid">
          {selectedServer.gpus.map((gpu) => {
            const isSelected = selectedGpus.includes(gpu.id)
            const isDisabled = gpu.status === 'occupied' || gpu.status === 'maintenance'

            return (
              <div
                key={gpu.id}
                className={`gpu-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && !isWholeServer && handleGpuToggle(gpu.id)}
              >
                <div className="gpu-name">{gpu.name}</div>
                <div className="gpu-status">
                  <Tag color={getStatusColor(gpu.status)}>
                    {getStatusText(gpu.status)}
                  </Tag>
                </div>
                {isSelected && <div className="gpu-check">✓</div>}
              </div>
            )
          })}
        </div>
        <Text type="secondary">
          已选择 {selectedGpus.length} 个 GPU
        </Text>
      </Form.Item>
    )
  }

  // 渲染服务器选择卡片
  const renderServerCards = () => {
    return (
      <div className="server-cards">
        {availableServers.map((server) => {
          const isSelected = form.getFieldValue('serverId') === server.id
          const isOffline = server.status === 'offline'

          return (
            <Card
              key={server.id}
              className={`server-card ${isSelected ? 'selected' : ''} ${isOffline ? 'disabled' : ''}`}
              hoverable={!isOffline}
              onClick={() => !isOffline && handleServerChange(server.id)}
              size="small"
            >
              <div className="server-info">
                <DesktopOutlined className="server-icon" />
                <div className="server-details">
                  <div className="server-name">{server.name}</div>
                  <div className="server-gpus">
                    {server.gpus.length} GPUs
                  </div>
                </div>
              </div>
              <div className="server-availability">
                <Tag color={server.availableGpuCount > 0 ? 'success' : 'error'}>
                  可用: {server.availableGpuCount} GPU
                </Tag>
              </div>
            </Card>
          )
        })}
      </div>
    )
  }

  if (loading && availableServers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="reservation-form-page">
      <Card>
        <Title level={4}>新建预约</Title>

        {/* 配额提示 */}
        {userQuota && (
          <Alert
            type={remainingQuota > 20 ? 'info' : remainingQuota > 0 ? 'warning' : 'error'}
            message={
              <span>
                <WarningOutlined /> 您本周已使用 {userQuota.usedHoursThisWeek} 小时，
                剩余配额 {remainingQuota} 小时
              </span>
            }
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 冲突提示 */}
        {conflicts.length > 0 && (
          <Alert
            type="error"
            message="检测到时间冲突"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            }
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            mode: 'multi-gpu',
            gpuIds: [],
          }}
          onFinish={handleSubmit}
          onValuesChange={(changedValues) => {
            if (changedValues.mode) {
              handleModeChange(changedValues.mode)
            }
            if (changedValues.startTime || changedValues.endTime) {
              calculateDuration()
            }
          }}
        >
          {/* 申请模式 */}
          <Form.Item
            name="mode"
            label="申请模式"
            rules={[{ required: true, message: '请选择申请模式' }]}
          >
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="single-gpu">单 GPU</Radio.Button>
              <Radio.Button value="multi-gpu">多 GPU</Radio.Button>
              <Radio.Button value="whole-server">整服务器</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* 选择服务器 */}
          <Form.Item
            name="serverId"
            label="选择服务器"
            rules={[{ required: true, message: '请选择服务器' }]}
          >
            {renderServerCards()}
          </Form.Item>

          {/* 选择 GPU */}
          {selectedServer && (
            <Form.Item
              name="gpuIds"
              rules={[
                { required: true, message: '请选择至少一个 GPU' },
              ]}
            >
              {renderGpuSelector()}
            </Form.Item>
          )}

          {/* 时间设置 */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="startTime"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="endTime"
                label="结束时间"
                rules={[
                  { required: true, message: '请选择结束时间' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || !getFieldValue('startTime')) {
                        return Promise.resolve()
                      }
                      if (dayjs(value).isAfter(dayjs(getFieldValue('startTime')))) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('结束时间必须晚于开始时间'))
                    },
                  }),
                ]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 预计时长 */}
          {duration > 0 && (
            <Form.Item>
              <Text>
                <ClockCircleOutlined /> 预计时长: {duration} 小时
              </Text>
              {userQuota && duration > remainingQuota && (
                <Text type="danger" style={{ marginLeft: 16 }}>
                  超出剩余配额!
                </Text>
              )}
            </Form.Item>
          )}

          {/* 备注说明 */}
          <Form.Item
            name="purpose"
            label={<><FileTextOutlined /> 用途说明</>}
            rules={[
              { required: true, message: '请输入预约用途' },
              { min: 10, message: '用途说明至少 10 个字符' },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细描述预约用途，便于审批和资源调度..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* 操作按钮 */}
          <Form.Item>
            <Space>
              <Button onClick={handleCancel}>取消</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={!!userQuota && duration > remainingQuota}
              >
                提交预约
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

// Helper functions
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'success',
    occupied: 'processing',
    reserved: 'warning',
    maintenance: 'default',
  }
  return colors[status] || 'default'
}

function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    available: '可用',
    occupied: '占用',
    reserved: '已预约',
    maintenance: '维护中',
  }
  return texts[status] || status
}

export default ReservationForm