/**
 * Cluster Reservation Form Page
 * 
 * Features:
 * - Select cluster for reservation
 * - Time range selection with conflict detection
 * - Display conflict details when detected
 * - AI time slot recommendations
 * - Support i18n (Chinese/English)
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Form,
  Select,
  DatePicker,
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
  Badge,
  Tooltip,
  Divider,
  Empty,
  List,
  Radio,
  Tabs,
  Statistic,
} from 'antd'
import {
  ClusterOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  UserOutlined,
  DesktopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs, { Dayjs } from 'dayjs'
import { clusterApi, clusterReservationApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

interface Cluster {
  id: string
  name: string
  code: string
  status: string
  type: string
  totalServers: number
  totalGpus: number
  totalCpuCores: number
  totalMemory: number
  description?: string
}

interface ConflictInfo {
  id: string
  startTime: Date
  endTime: Date
  status: string
  queuePosition: number | null
  user: {
    id: string
    username: string
    displayName: string | null
  }
}

interface TimeSlotRecommendation {
  startTime: string
  endTime: string
  score: number
  confidence: number
  reasons: string[]
  queuePosition: number | null
}

const ClusterReservationForm: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [duration, setDuration] = useState<number>(0)
  const [aiRecommendations, setAiRecommendations] = useState<TimeSlotRecommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number>(120) // default 2 hours

  // Load clusters on mount
  useEffect(() => {
    loadClusters()
    
    // Handle pre-filled data from navigation
    const state = location.state as any
    if (state?.clusterId) {
      form.setFieldValue('clusterId', state.clusterId)
    }
  }, [])

  const loadClusters = async () => {
    setLoading(true)
    try {
      const response = await clusterApi.getAvailableForReservation()
      // Filter only available clusters for reservation
      const availableClusters = (response.data.data || []).filter(
        (c: Cluster) => c.status !== 'MAINTENANCE'
      )
      setClusters(availableClusters)
    } catch (error: any) {
      message.error(t('messages.operationFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Check for conflicts when time range changes
  const checkConflicts = useCallback(async (clusterId: string, startTime: Dayjs, endTime: Dayjs) => {
    if (!clusterId || !startTime || !endTime) {
      setConflicts([])
      return
    }

    setCheckingConflicts(true)
    try {
      const response = await clusterReservationApi.checkConflicts({
        clusterId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
      
      if (response.data.data?.hasConflicts) {
        setConflicts(response.data.data.conflicts)
      } else {
        setConflicts([])
      }
    } catch (error: any) {
      console.error('Failed to check conflicts:', error)
    } finally {
      setCheckingConflicts(false)
    }
  }, [])

  // Handle cluster selection
  const handleClusterChange = (clusterId: string) => {
    const cluster = clusters.find(c => c.id === clusterId)
    setSelectedCluster(cluster || null)
    setConflicts([])
    setAiRecommendations([])
    
    // Check conflicts if time is already selected
    const timeRange = form.getFieldValue('timeRange')
    if (timeRange && timeRange[0] && timeRange[1]) {
      checkConflicts(clusterId, timeRange[0], timeRange[1])
    }
  }

  // Handle time range change
  const handleTimeRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      // Calculate duration
      const hours = dates[1].diff(dates[0], 'hour', true)
      setDuration(Math.round(hours * 10) / 10)
      
      // Check conflicts
      if (selectedCluster) {
        checkConflicts(selectedCluster.id, dates[0], dates[1])
      }
    } else {
      setDuration(0)
      setConflicts([])
    }
  }

  // Fetch AI recommendations
  const fetchAiRecommendations = async (duration: number) => {
    if (!selectedCluster) return
    
    setLoadingRecommendations(true)
    try {
      const response = await clusterReservationApi.recommendTimeSlots({
        clusterId: selectedCluster.id,
        duration,
      })
      setAiRecommendations(response.data.data || [])
    } catch (error: any) {
      console.error('Failed to fetch AI recommendations:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  // Apply AI recommended time slot
  const applyRecommendation = (recommendation: TimeSlotRecommendation) => {
    form.setFieldsValue({
      timeRange: [dayjs(recommendation.startTime), dayjs(recommendation.endTime)],
    })
    handleTimeRangeChange([dayjs(recommendation.startTime), dayjs(recommendation.endTime)])
  }

  // Submit form
  const handleSubmit = async (values: any) => {
    if (!selectedCluster) {
      message.error(t('clusterReservation.selectClusterPlaceholder'))
      return
    }

    setSubmitting(true)
    try {
      await clusterReservationApi.create({
        clusterId: values.clusterId,
        startTime: values.timeRange[0].toISOString(),
        endTime: values.timeRange[1].toISOString(),
        purpose: values.purpose,
      })
      
      message.success(t('clusterReservation.submitSuccess'))
      navigate('/reservations')
    } catch (error: any) {
      message.error(error.response?.data?.error || t('clusterReservation.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // Get cluster status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      AVAILABLE: { color: 'green', text: t('clusterReservation.available') },
      ALLOCATED: { color: 'blue', text: t('clusterReservation.inUse') },
      RESERVED: { color: 'orange', text: t('clusterReservation.reserved') },
      MAINTENANCE: { color: 'red', text: t('clusterReservation.maintenance') },
    }
    return config[status] || { color: 'default', text: status }
  }

  // Get conflict status tag
  const getConflictStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'gold', text: t('clusterReservation.pendingApproval') },
      APPROVED: { color: 'green', text: t('clusterReservation.approved') },
      ACTIVE: { color: 'blue', text: t('clusterReservation.active') },
    }
    const statusConfig = config[status] || { color: 'default', text: status }
    return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="cluster-reservation-form-page" style={{ padding: 24 }}>
      <Card>
        <Title level={4}>
          <ClusterOutlined style={{ marginRight: 8 }} />
          {t('clusterReservation.newReservation')}
        </Title>

        {/* Conflict Warning */}
        {conflicts.length > 0 && (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            message={t('clusterReservation.conflictDetected')}
            description={
              <div>
                <Paragraph>{t('clusterReservation.conflictWarning')}</Paragraph>
                
                {/* Conflict List */}
                <List
                  size="small"
                  dataSource={conflicts}
                  renderItem={(conflict) => (
                    <List.Item style={{ border: '1px solid #faad14', borderRadius: 4, marginBottom: 8, padding: 12 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <UserOutlined />
                          <Text strong>{conflict.user.displayName || conflict.user.username}</Text>
                          {getConflictStatusTag(conflict.status)}
                          {conflict.queuePosition && (
                            <Tag color="orange">
                              {t('clusterReservation.conflictQueuePosition', { position: conflict.queuePosition })}
                            </Tag>
                          )}
                        </Space>
                        <Space>
                          <ClockCircleOutlined />
                          <Text type="secondary">
                            {dayjs(conflict.startTime).format('YYYY-MM-DD HH:mm')} - {dayjs(conflict.endTime).format('HH:mm')}
                          </Text>
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            }
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* No Conflict Message */}
        {selectedCluster && form.getFieldValue('timeRange') && conflicts.length === 0 && !checkingConflicts && (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            message={t('clusterReservation.noConflict')}
            description={t('clusterReservation.timeAvailable')}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* Select Cluster */}
          <Form.Item
            name="clusterId"
            label={t('clusterReservation.selectCluster')}
            rules={[{ required: true, message: t('clusterReservation.selectClusterPlaceholder') }]}
          >
            <Select
              placeholder={t('clusterReservation.selectClusterPlaceholder')}
              onChange={handleClusterChange}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {clusters.map(cluster => {
                const statusConfig = getStatusBadge(cluster.status)
                return (
                  <Select.Option key={cluster.id} value={cluster.id}>
                    <Space>
                      <ClusterOutlined />
                      {cluster.name}
                      <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
                    </Space>
                  </Select.Option>
                )
              })}
            </Select>
          </Form.Item>

          {/* Selected Cluster Info */}
          {selectedCluster && (
            <Card size="small" style={{ marginBottom: 24, background: '#fafafa' }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title={t('clusterReservation.servers')} 
                    value={selectedCluster.totalServers} 
                    prefix={<DesktopOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={t('clusterReservation.gpus')} 
                    value={selectedCluster.totalGpus}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={t('clusterReservation.cpuCores')} 
                    value={selectedCluster.totalCpuCores}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={t('clusterReservation.memory')} 
                    value={selectedCluster.totalMemory} 
                    suffix="GB"
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* AI Recommendations Section */}
          {selectedCluster && (
            <Card 
              size="small" 
              style={{ marginBottom: 24, background: '#f6ffed', borderColor: '#b7eb8f' }}
              title={
                <Space>
                  <BulbOutlined style={{ color: '#52c41a' }} />
                  <span>{t('clusterReservation.aiRecommendations')}</span>
                </Space>
              }
              extra={
                <Space>
                  <Select
                    size="small"
                    value={selectedDuration}
                    onChange={(val) => {
                      setSelectedDuration(val)
                      fetchAiRecommendations(val)
                    }}
                    style={{ width: 120 }}
                    options={[
                      { value: 60, label: '1 Hour' },
                      { value: 120, label: '2 Hours' },
                      { value: 240, label: '4 Hours' },
                      { value: 480, label: '8 Hours' },
                    ]}
                  />
                  <Button 
                    size="small" 
                    icon={<ThunderboltOutlined />}
                    loading={loadingRecommendations}
                    onClick={() => fetchAiRecommendations(selectedDuration)}
                  >
                    {t('clusterReservation.getRecommendations')}
                  </Button>
                </Space>
              }
            >
              {loadingRecommendations ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin tip="AI is analyzing optimal time slots..." />
                </div>
              ) : aiRecommendations.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {aiRecommendations.map((rec, index) => (
                    <div
                      key={index}
                      onClick={() => applyRecommendation(rec)}
                      style={{
                        padding: '8px 12px',
                        background: index === 0 ? '#e6f7ff' : '#fff',
                        border: `1px solid ${index === 0 ? '#1890ff' : '#d9d9d9'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <Tag color={index === 0 ? 'blue' : 'default'}>
                            {index === 0 ? t('clusterReservation.bestOption') : t('clusterReservation.option', { num: index + 1 })}
                          </Tag>
                          <Text strong>
                            {dayjs(rec.startTime).format('MM-DD HH:mm')} - {dayjs(rec.endTime).format('HH:mm')}
                          </Text>
                        </Space>
                        <Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('clusterReservation.confidence')}: {(rec.confidence * 100).toFixed(0)}%
                          </Text>
                          <Tag color="green">{rec.score} {t('clusterReservation.score')}</Tag>
                          {rec.queuePosition ? (
                            <Tag color="orange">{t('clusterReservation.needQueue')}</Tag>
                          ) : (
                            <Tag color="green">{t('clusterReservation.noQueue')}</Tag>
                          )}
                        </Space>
                      </Space>
                      <div style={{ marginTop: 4 }}>
                        {(rec.reasons || []).slice(0, 2).map((reason, i) => (
                          <Tag key={i} color="geekblue" style={{ fontSize: 11, marginBottom: 2 }}>
                            {reason}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ color: '#8c8c8c', fontSize: 12, textAlign: 'center', padding: 10 }}>
                  Click "{t('clusterReservation.getRecommendations')}" for AI-powered optimal time slot analysis
                </div>
              )}
            </Card>
          )}

          {/* Time Range */}
          <Form.Item
            name="timeRange"
            label={t('clusterReservation.timeRange')}
            rules={[{ required: true, message: 'Please select time range' }]}
          >
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              onChange={handleTimeRangeChange}
            />
          </Form.Item>

          {/* Checking Conflicts Indicator */}
          {checkingConflicts && (
            <div style={{ marginBottom: 16 }}>
              <Spin size="small" /> {t('clusterReservation.checkingConflicts')}
            </div>
          )}

          {/* Estimated Duration */}
          {duration > 0 && (
            <Form.Item>
              <Text>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {t('clusterReservation.duration')}: {duration} {t('clusterReservation.hours')}
              </Text>
            </Form.Item>
          )}

          {/* Purpose */}
          <Form.Item
            name="purpose"
            label={<><FileTextOutlined style={{ marginRight: 4 }} />{t('clusterReservation.purpose')}</>}
            rules={[
              { required: true, message: t('clusterReservation.purposeRequired') },
              { min: 10, message: t('clusterReservation.purposeRequired') },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('clusterReservation.purposePlaceholder')}
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* Actions */}
          <Form.Item>
            <Space>
              <Button onClick={() => navigate(-1)}>{t('clusterReservation.cancel')}</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={conflicts.length > 0}
              >
                {t('clusterReservation.submit')}
              </Button>
            </Space>
          </Form.Item>

          {/* Info about approval */}
          <Alert
            type="info"
            showIcon
            message={
              <span>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {t('clusterReservation.pendingApproval')}
              </span>
            }
          />
        </Form>
      </Card>
    </div>
  )
}

export default ClusterReservationForm