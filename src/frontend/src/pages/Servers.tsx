import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Alert, Card, Row, Col, Typography, Empty, Statistic, Checkbox, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined, DesktopOutlined, ClusterOutlined, UserOutlined, ClockCircleOutlined, CloseOutlined } from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { serverApi, clusterApi } from '../services/api'
import ExportButton from '../components/ExportButton'
import BatchProgressBar, { BatchProgressItem } from '../components/BatchProgressBar'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorDetails, { ErrorDetailItem } from '../components/ErrorDetails'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

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
  clusterServers?: any[]
}

interface Cluster {
  id: string
  name: string
  code: string
  type: string
  status: string
  totalServers: number
  totalGpus: number
  totalCpuCores: number
  totalMemory: number
  servers?: Array<{
    server: Server
    priority: number
    role?: string
  }>
  assignee?: {
    id: string
    username: string
    email: string
  }
  assignmentEnd?: string
}

interface BatchOperationState {
  isProcessing: boolean;
  total: number;
  processed: number;
  successCount: number;
  failureCount: number;
  items: BatchProgressItem[];
  errors: ErrorDetailItem[];
}

const Servers: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm()

  // Right panel state for cluster drill-down
  const [drillDownVisible, setDrillDownVisible] = useState(false)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [clusterLoading, setClusterLoading] = useState(false)

  // Check for drill-down params on mount
  useEffect(() => {
    const clusterId = searchParams.get('cluster')
    const highlightServer = searchParams.get('highlight')
    
    if (clusterId) {
      setSelectedClusterId(clusterId)
      setDrillDownVisible(true)
      loadClusterDetail(clusterId)
    }
  }, [searchParams])

  // Load cluster detail for drill-down view
  const loadClusterDetail = async (clusterId: string) => {
    setClusterLoading(true)
    try {
      const response = await clusterApi.getById(clusterId)
      setSelectedCluster(response.data.data)
    } catch (error: any) {
      message.error('Failed to load cluster details')
    } finally {
      setClusterLoading(false)
    }
  }

  // Close drill-down panel
  const handleCloseDrillDown = () => {
    setDrillDownVisible(false)
    setSelectedClusterId(null)
    setSelectedCluster(null)
    // Clear URL params
    searchParams.delete('cluster')
    searchParams.delete('highlight')
    setSearchParams(searchParams)
  }

  // Navigate back to cluster
  const handleBackToCluster = () => {
    if (selectedClusterId) {
      navigate(`/clusters?highlight=${selectedClusterId}`)
    }
  }

  // Batch operation state
  const [batchState, setBatchState] = useState<BatchOperationState>({
    isProcessing: false,
    total: 0,
    processed: 0,
    successCount: 0,
    failureCount: 0,
    items: [],
    errors: [],
  });

  // Confirm dialog state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'delete' | 'status_change';
    status?: string;
  } | null>(null);

  // Error details modal state
  const [errorDetailsVisible, setErrorDetailsVisible] = useState(false);

  useEffect(() => {
    loadServers()
  }, [])

  // Load servers
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

  // Initialize batch operation
  const initBatchOperation = (total: number, items: BatchProgressItem[]) => {
    setBatchState({
      isProcessing: true,
      total,
      processed: 0,
      successCount: 0,
      failureCount: 0,
      items,
      errors: [],
    });
  };

  // Update batch progress
  const updateBatchProgress = (updates: Partial<BatchOperationState>) => {
    setBatchState(prev => ({ ...prev, ...updates }));
  };

  // Batch delete with progress tracking
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select servers to delete')
      return
    }

    const items: BatchProgressItem[] = servers
      .filter(s => selectedRowKeys.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        status: 'pending' as const,
      }));

    initBatchOperation(selectedRowKeys.length, items);
    setConfirmVisible(false);

    try {
      // Process in batches of 5
      const batchSize = 5;
      const ids = selectedRowKeys as string[];
      let successCount = 0;
      let failureCount = 0;
      const errors: ErrorDetailItem[] = [];
      const updatedItems: BatchProgressItem[] = [...items];

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(id => serverApi.delete(id))
        );

        results.forEach((result, index) => {
          const id = batch[index];
          const itemIndex = updatedItems.findIndex(item => item.id === id);
          
          if (result.status === 'fulfilled') {
            successCount++;
            if (itemIndex >= 0) {
              updatedItems[itemIndex].status = 'success';
            }
          } else {
            failureCount++;
            if (itemIndex >= 0) {
              updatedItems[itemIndex].status = 'error';
              updatedItems[itemIndex].error = 'Delete failed';
            }
            const server = servers.find(s => s.id === id);
            errors.push({
              id,
              name: server?.name || id,
              type: 'DELETE',
              error: result.reason?.message || 'Unknown error',
              timestamp: new Date().toISOString(),
              canRetry: true,
            });
          }
        });

        updateBatchProgress({
          processed: Math.min(i + batchSize, ids.length),
          successCount,
          failureCount,
          items: updatedItems,
          errors,
        });
      }

      updateBatchProgress({ isProcessing: false });

      if (failureCount === 0) {
        message.success(`Successfully deleted ${successCount} servers`);
        setSelectedRowKeys([]);
        loadServers();
      } else {
        message.warning(`Delete completed: ${successCount} success, ${failureCount} failed`);
        setErrorDetailsVisible(true);
        loadServers();
      }
    } catch (error: any) {
      updateBatchProgress({ isProcessing: false });
      message.error('Failed to batch delete servers');
      setErrorDetailsVisible(true);
    }
  };

  // Batch status change with progress tracking
  const handleBatchStatusChange = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select servers to update')
      return
    }

    const items: BatchProgressItem[] = servers
      .filter(s => selectedRowKeys.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        status: 'pending' as const,
      }));

    initBatchOperation(selectedRowKeys.length, items);
    setConfirmVisible(false);

    try {
      // Process in batches of 5
      const batchSize = 5;
      const ids = selectedRowKeys as string[];
      let successCount = 0;
      let failureCount = 0;
      const errors: ErrorDetailItem[] = [];
      const updatedItems: BatchProgressItem[] = [...items];

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(id => serverApi.update(id, { status }))
        );

        results.forEach((result, index) => {
          const id = batch[index];
          const itemIndex = updatedItems.findIndex(item => item.id === id);
          
          if (result.status === 'fulfilled') {
            successCount++;
            if (itemIndex >= 0) {
              updatedItems[itemIndex].status = 'success';
            }
          } else {
            failureCount++;
            if (itemIndex >= 0) {
              updatedItems[itemIndex].status = 'error';
              updatedItems[itemIndex].error = 'Status update failed';
            }
            const server = servers.find(s => s.id === id);
            errors.push({
              id,
              name: server?.name || id,
              type: 'STATUS_CHANGE',
              error: result.reason?.message || 'Unknown error',
              timestamp: new Date().toISOString(),
              canRetry: true,
            });
          }
        });

        updateBatchProgress({
          processed: Math.min(i + batchSize, ids.length),
          successCount,
          failureCount,
          items: updatedItems,
          errors,
        });
      }

      updateBatchProgress({ isProcessing: false });

      if (failureCount === 0) {
        message.success(`Successfully updated status for ${successCount} servers`);
        setSelectedRowKeys([]);
        loadServers();
      } else {
        message.warning(`Status update completed: ${successCount} success, ${failureCount} failed`);
        setErrorDetailsVisible(true);
        loadServers();
      }
    } catch (error: any) {
      updateBatchProgress({ isProcessing: false });
      message.error('Failed to batch update status');
      setErrorDetailsVisible(true);
    }
  };

  // Retry failed items
  const handleRetryErrors = async (ids: string[]) => {
    if (pendingAction?.type === 'delete') {
      const results = await Promise.allSettled(
        ids.map(id => serverApi.delete(id))
      );

      let successCount = 0;
      let failureCount = 0;
      const updatedErrors = batchState.errors.filter(e => !ids.includes(e.id));
      const updatedItems = batchState.items.map(item => {
        if (ids.includes(item.id)) {
          const result = results.find((_, i) => ids[i] === item.id);
          if (result?.status === 'fulfilled') {
            successCount++;
            return { ...item, status: 'success' as const };
          } else {
            failureCount++;
            return { 
              ...item, 
              status: 'error' as const,
              error: 'Retry failed',
              retryCount: (item.retryCount || 0) + 1,
            };
          }
        }
        return item;
      });

      updateBatchProgress({
        successCount: batchState.successCount + successCount,
        failureCount: batchState.failureCount + failureCount,
        errors: updatedErrors,
        items: updatedItems,
      });

      if (updatedErrors.length === 0) {
        message.success('All failed items have been retried successfully');
        setErrorDetailsVisible(false);
        loadServers();
      }
    } else if (pendingAction?.type === 'status_change' && pendingAction.status) {
      const results = await Promise.allSettled(
        ids.map(id => serverApi.update(id, { status: pendingAction.status! }))
      );

      let successCount = 0;
      let failureCount = 0;
      const updatedErrors = batchState.errors.filter(e => !ids.includes(e.id));
      const updatedItems = batchState.items.map(item => {
        if (ids.includes(item.id)) {
          const result = results.find((_, i) => ids[i] === item.id);
          if (result?.status === 'fulfilled') {
            successCount++;
            return { ...item, status: 'success' as const };
          } else {
            failureCount++;
            return { 
              ...item, 
              status: 'error' as const,
              error: 'Retry failed',
              retryCount: (item.retryCount || 0) + 1,
            };
          }
        }
        return item;
      });

      updateBatchProgress({
        successCount: batchState.successCount + successCount,
        failureCount: batchState.failureCount + failureCount,
        errors: updatedErrors,
        items: updatedItems,
      });

      if (updatedErrors.length === 0) {
        message.success('All failed items have been retried successfully');
        setErrorDetailsVisible(false);
        loadServers();
      }
    }
  };

  // Handle retry all
  const handleRetryAllErrors = async () => {
    const errorIds = batchState.errors.map(e => e.id);
    await handleRetryErrors(errorIds);
  };

  // Handle export errors
  const handleExportErrors = () => {
    const content = batchState.errors.map((error, index) => 
      `[${index + 1}] ${error.name}\n` +
      `    Type: ${error.type || 'Unknown'}\n` +
      `    Error: ${error.error}\n` +
      `    Time: ${error.timestamp || 'N/A'}\n`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-operation-errors-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    message.success('Error log exported');
  };

  // Start batch delete with confirmation
  const startBatchDelete = () => {
    setPendingAction({ type: 'delete' });
    setConfirmVisible(true);
  };

  // Start batch status change with confirmation
  const startBatchStatusChange = (status: string) => {
    setPendingAction({ type: 'status_change', status });
    setConfirmVisible(true);
  };

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(servers.map(s => s.id))
    } else {
      setSelectedRowKeys([])
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

  // Batch selection column
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
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)' }}>
      {/* Left Panel: Server Management */}
      <div style={{ flex: drillDownVisible ? '0 0 60%' : 1, minWidth: 0, transition: 'flex 0.3s' }}>
        <Card 
          title={
            <Space>
              <DesktopOutlined />
              <span>Server Management</span>
            </Space>
          }
          style={{ height: '100%', overflow: 'auto' }}
        >
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

      {/* Batch Operations Toolbar */}
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
                loading={batchState.isProcessing}
                onClick={startBatchDelete}
              >
                Delete Selected
              </Button>
              <Button
                size="small"
                loading={batchState.isProcessing}
                onClick={() => startBatchStatusChange('ONLINE')}
              >
                Set Online
              </Button>
              <Button
                size="small"
                loading={batchState.isProcessing}
                onClick={() => startBatchStatusChange('OFFLINE')}
              >
                Set Offline
              </Button>
              <Button
                size="small"
                loading={batchState.isProcessing}
                onClick={() => startBatchStatusChange('MAINTENANCE')}
              >
                Set Maintenance
              </Button>
              <Button
                size="small"
                onClick={() => setSelectedRowKeys([])}
                disabled={batchState.isProcessing}
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
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          selections: [
            Table.SELECTION_ALL,
            Table.SELECTION_INVERT,
            Table.SELECTION_NONE,
          ],
        }}
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

      {/* Batch Progress Bar */}
      <BatchProgressBar
        visible={batchState.isProcessing || (batchState.processed > 0 && batchState.processed === batchState.total)}
          title="Batch Operation Progress"
        total={batchState.total}
        processed={batchState.processed}
        successCount={batchState.successCount}
        failureCount={batchState.failureCount}
        isProcessing={batchState.isProcessing}
        items={batchState.items}
        showDetails
        onCancel={() => {
          // Cancel logic - for now just set processing to false
          updateBatchProgress({ isProcessing: false });
            message.warning('Operation cancelled');
        }}
        onClose={() => {
          if (!batchState.isProcessing) {
            updateBatchProgress({ 
              processed: 0, 
              successCount: 0, 
              failureCount: 0, 
              items: [],
              errors: [],
            });
          }
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmVisible}
        type={pendingAction?.type === 'delete' ? 'delete' : 'status_change'}
        message={
            pendingAction?.type === 'delete'
              ? `Are you sure you want to delete the selected ${selectedRowKeys.length} servers?`
              : `Are you sure you want to update the status of selected ${selectedRowKeys.length} servers to ${pendingAction?.status}?`
        }
        itemCount={selectedRowKeys.length}
        itemLabel="servers"
        actionLabel={pendingAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        loading={batchState.isProcessing}
        onConfirm={() => {
          if (pendingAction?.type === 'delete') {
            handleBatchDelete();
          } else if (pendingAction?.type === 'status_change' && pendingAction.status) {
            handleBatchStatusChange(pendingAction.status);
          }
        }}
        onCancel={() => {
          setConfirmVisible(false);
          setPendingAction(null);
        }}
      />

      {/* Error Details Modal */}
      <ErrorDetails
        visible={errorDetailsVisible}
          title="Batch Operation Failure Details"
        errors={batchState.errors}
        loading={batchState.isProcessing}
        onRetry={handleRetryErrors}
        onRetryAll={handleRetryAllErrors}
        onExport={handleExportErrors}
        onClose={() => setErrorDetailsVisible(false)}
      />
        </Card>
      </div>

      {/* Right Panel: Cluster Drill-Down View */}
      {drillDownVisible && (
        <div style={{ flex: '0 0 38%', minWidth: 0 }}>
          <Card
              title={
                <Space>
                  <ClusterOutlined />
                  <span>Cluster Details</span>
                </Space>
              }
            extra={
              <Space>
                <Button 
                  size="small" 
                  onClick={handleBackToCluster}
                  icon={<ClusterOutlined />}
                >
                  Back to Cluster
                </Button>
                <Button 
                  size="small" 
                  icon={<CloseOutlined />}
                  onClick={handleCloseDrillDown}
                />
              </Space>
            }
            style={{ height: '100%', overflow: 'auto' }}
            loading={clusterLoading}
          >
            {selectedCluster ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* Cluster Info */}
                <div>
                  <Title level={5}>{selectedCluster.name}</Title>
                  <Space>
                    <Tag color={selectedCluster.status === 'AVAILABLE' ? 'green' : 'blue'}>
                      {selectedCluster.status}
                    </Tag>
                    <Tag>{selectedCluster.type}</Tag>
                  </Space>
                </div>

                {/* Assignee Info */}
                {selectedCluster.assignee && (
                  <div>
                    <Text type="secondary">User: </Text>
                    <UserOutlined style={{ marginRight: 4 }} />
                    <Text>{selectedCluster.assignee.username}</Text>
                    {selectedCluster.assignmentEnd && (
                      <div>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        <Text type="secondary">
                          Until {new Date(selectedCluster.assignmentEnd).toLocaleString()}
                        </Text>
                      </div>
                    )}
                  </div>
                )}

                {/* Resources */}
                <Row gutter={8}>
                  <Col span={12}>
                <Card size="small">
                  <Statistic title="Servers" value={selectedCluster.totalServers} suffix="count" />
                </Card>
                  </Col>
                  <Col span={12}>
                <Card size="small">
                  <Statistic title="GPUs" value={selectedCluster.totalGpus} suffix="count" />
                </Card>
                  </Col>
                </Row>

                {/* Server Cards */}
                  <Title level={5}>Server List</Title>
                {selectedCluster.servers && selectedCluster.servers.length > 0 ? (
                  <Row gutter={[8, 8]}>
                    {selectedCluster.servers.map((s) => (
                      <Col key={s.server.id} span={24}>
                        <Card
                          size="small"
                          hoverable
                          style={{
                            borderColor: searchParams.get('highlight') === s.server.id ? '#1890ff' : undefined,
                            borderWidth: searchParams.get('highlight') === s.server.id ? 2 : 1,
                          }}
                        >
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Text strong>{s.server.name}</Text>
                              <Tag color={s.server.status === 'ONLINE' ? 'green' : 'default'}>
                                {s.server.status}
                              </Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {s.server.hostname || s.server.ipAddress}
                            </Text>
                            <Space size="small">
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                GPU: {s.server.gpuCount}
                              </Text>
                              {s.role && <Tag color="blue" style={{ fontSize: 10 }}>{s.role}</Tag>}
                            </Space>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description="No servers available" />
                )}
              </Space>
            ) : (
                  <Empty description="Select a cluster to view details" />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default Servers
