import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons'
import { serverApi } from '../services/api'
import ExportButton from '../components/ExportButton'
import BatchProgressBar, { BatchProgressItem } from '../components/BatchProgressBar'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorDetails, { ErrorDetailItem } from '../components/ErrorDetails'
import type { ColumnsType } from 'antd/es/table'

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
  const [loading, setLoading] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm()

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
              updatedItems[itemIndex].error = '删除失败';
            }
            const server = servers.find(s => s.id === id);
            errors.push({
              id,
              name: server?.name || id,
              type: 'DELETE',
              error: result.reason?.message || '未知错误',
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
        message.warning(`删除完成：成功 ${successCount} 项，失败 ${failureCount} 项`);
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
              updatedItems[itemIndex].error = '状态更新失败';
            }
            const server = servers.find(s => s.id === id);
            errors.push({
              id,
              name: server?.name || id,
              type: 'STATUS_CHANGE',
              error: result.reason?.message || '未知错误',
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
        message.warning(`状态更新完成：成功 ${successCount} 项，失败 ${failureCount} 项`);
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
              error: '重试失败',
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
        message.success('所有失败项已重试成功');
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
              error: '重试失败',
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
        message.success('所有失败项已重试成功');
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
      `    类型：${error.type || '未知'}\n` +
      `    错误：${error.error}\n` +
      `    时间：${error.timestamp || 'N/A'}\n`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-operation-errors-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    message.success('错误日志已导出');
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
    <div>
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
        title="批量操作进度"
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
          message.warning('操作已取消');
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
            ? `确定要删除选中的 ${selectedRowKeys.length} 台服务器吗？`
            : `确定要更新选中的 ${selectedRowKeys.length} 台服务器的状态为 ${pendingAction?.status} 吗？`
        }
        itemCount={selectedRowKeys.length}
        itemLabel="台服务器"
        actionLabel={pendingAction?.type === 'delete' ? '删除' : '确认'}
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
        title="批量操作失败详情"
        errors={batchState.errors}
        loading={batchState.isProcessing}
        onRetry={handleRetryErrors}
        onRetryAll={handleRetryAllErrors}
        onExport={handleExportErrors}
        onClose={() => setErrorDetailsVisible(false)}
      />
    </div>
  )
}

// Import Checkbox and Popconfirm from antd
import { Checkbox, Popconfirm } from 'antd';

export default Servers
