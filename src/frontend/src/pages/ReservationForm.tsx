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

  // Initialize data
  useEffect(() => {
    fetchAvailableServers()
    fetchUserQuota()
    
    // Handle pre-filled data from calendar navigation
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

  // Calculate remaining quota
  const remainingQuota = userQuota
    ? userQuota.maxHoursPerWeek - userQuota.usedHoursThisWeek
    : 0

  // Calculate estimated duration
  const calculateDuration = () => {
    const values = form.getFieldsValue()
    if (values.startTime && values.endTime) {
      const start = dayjs(values.startTime)
      const end = dayjs(values.endTime)
      const hours = end.diff(start, 'hour', true)
      setDuration(Math.round(hours * 10) / 10)
    }
  }

  // Handle server selection
  const handleServerChange = (serverId: string) => {
    const server = availableServers.find((s) => s.id === serverId)
    setSelectedServer(server || null)
    setSelectedGpus([])
    form.setFieldValue('gpuIds', [])
  }

  // Handle GPU selection
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

  // Handle mode change
  const handleModeChange = (mode: string) => {
    if (mode === 'whole-server' && selectedServer) {
      // Whole server mode, select all GPUs
      const allGpuIds = (selectedServer.gpus || selectedServer.availableGpus || []).map((g) => g.id)
      setSelectedGpus(allGpuIds)
      form.setFieldValue('gpuIds', allGpuIds)
    } else {
      setSelectedGpus([])
      form.setFieldValue('gpuIds', [])
    }
  }

  // Submit form
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
      message.success('Reservation created successfully')
      navigate('/reservations/mine')
    } catch (error: any) {
      if (error.response?.data?.conflicts) {
        setConflicts(error.response.data.conflicts)
      }
      message.error(error.response?.data?.message || 'Failed to create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel
  const handleCancel = () => {
    navigate(-1)
  }

  // Render GPU selector
  const renderGpuSelector = () => {
    if (!selectedServer) return null

    const mode = form.getFieldValue('mode')
    const isWholeServer = mode === 'whole-server'

    return (
      <Form.Item label="Select GPU">
        <div className="gpu-grid">
          {(selectedServer.gpus || selectedServer.availableGpus || []).map((gpu) => {
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
          {selectedGpus.length} GPU(s) selected
        </Text>
      </Form.Item>
    )
  }

  // Render server selection cards
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
                  <div className="server-name">{server.name || 'Unknown Server'}</div>
                  <div className="server-gpus">
                    {(server.gpus || []).length || (server.availableGpus || []).length} GPUs
                  </div>
                </div>
              </div>
              <div className="server-availability">
                <Tag color={server.availableGpuCount > 0 ? 'success' : 'error'}>
                  Available: {server.availableGpuCount} GPU
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
<Title level={4}>New Reservation</Title>
 
        {/* Quota Info */}
        {userQuota && (
          <Alert
            type={remainingQuota > 20 ? 'info' : remainingQuota > 0 ? 'warning' : 'error'}
            message={
              <span>
                <WarningOutlined /> Used {userQuota.usedHoursThisWeek} hours this week,
                remaining quota: {remainingQuota} hours
              </span>
            }
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Conflict Warning */}
        {conflicts.length > 0 && (
          <Alert
            type="error"
            message="Time conflict detected"
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
          {/* Application Mode */}
          <Form.Item
            name="mode"
            label="Application Mode"
            rules={[{ required: true, message: 'Please select application mode' }]}
          >
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="single-gpu">Single GPU</Radio.Button>
              <Radio.Button value="multi-gpu">Multi GPU</Radio.Button>
              <Radio.Button value="whole-server">Whole Server</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* Select Server */}
          <Form.Item
            name="serverId"
            label="Select Server"
            rules={[{ required: true, message: 'Please select a server' }]}
          >
            {renderServerCards()}
          </Form.Item>

          {/* Select GPU */}
          {selectedServer && (
            <Form.Item
              name="gpuIds"
              rules={[
                { required: true, message: 'Please select at least one GPU' },
              ]}
            >
              {renderGpuSelector()}
            </Form.Item>
          )}

          {/* Time Settings */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="startTime"
                label="Start Time"
                rules={[{ required: true, message: 'Please select start time' }]}
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
                label="End Time"
                rules={[
                  { required: true, message: 'Please select end time' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || !getFieldValue('startTime')) {
                        return Promise.resolve()
                      }
                      if (dayjs(value).isAfter(dayjs(getFieldValue('startTime')))) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('End time must be after start time'))
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

          {/* Estimated Duration */}
          {duration > 0 && (
            <Form.Item>
              <Text>
                <ClockCircleOutlined /> Estimated duration: {duration} hours
              </Text>
              {userQuota && duration > remainingQuota && (
                <Text type="danger" style={{ marginLeft: 16 }}>
                  Exceeds remaining quota!
                </Text>
              )}
            </Form.Item>
          )}

          {/* Purpose */}
          <Form.Item
            name="purpose"
            label={<><FileTextOutlined /> Purpose</>}
            rules={[
              { required: true, message: 'Please enter reservation purpose' },
              { min: 10, message: 'Purpose must be at least 10 characters' },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Please describe the purpose of this reservation in detail for approval and resource scheduling..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* Actions */}
          <Form.Item>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={!!userQuota && duration > remainingQuota}
              >
                Submit Reservation
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
    available: 'Available',
    occupied: 'Occupied',
    reserved: 'Reserved',
    maintenance: 'Maintenance',
  }
  return texts[status] || status
}

export default ReservationForm