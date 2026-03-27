import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, message, Alert, Checkbox, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, StopOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { taskApi } from '../services/api'
import { wsService } from '../services/websocket'
import { ExportButton } from '../components/ExportButton'
import BatchProgressBar, { BatchProgressItem } from '../components/BatchProgressBar'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorDetails, { ErrorDetailItem } from '../components/ErrorDetails'
import type { ColumnsType } from 'antd/es/table'

interface Task {
  id: string
  name: string
  description?: string
  status: string
  priority: number
  createdAt: string
  startedAt?: string
  completedAt?: string
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

const Tasks: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [modalVisible, setModalVisible] = useState(false)
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
    type: 'delete' | 'cancel' | 'status_change';
    status?: string;
  } | null>(null);

  // Error details modal state
  const [errorDetailsVisible, setErrorDetailsVisible] = useState(false);

  useEffect(() => {
    loadTasks()

    const onTasksUpdate = () => { loadTasks() }
    const onTaskUpdate = () => { loadTasks() }

    wsService.on('tasks:update', onTasksUpdate)
    wsService.on('task:update', onTaskUpdate)

    return () => {
      wsService.off('tasks:update', onTasksUpdate)
      wsService.off('task:update', onTaskUpdate)
    }
  }, [])

  // Load tasks
  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await taskApi.getAll()
      setTasks(response.data.data)
    } catch (error: any) {
      message.error('Failed to load tasks')
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
      message.warning('Please select tasks to delete')
      return
    }

    const items: BatchProgressItem[] = tasks
      .filter(t => selectedRowKeys.includes(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        status: 'pending' as const,
      }));

    initBatchOperation(selectedRowKeys.length, items);
    setConfirmVisible(false);

    try {
      const batchSize = 5;
      const ids = selectedRowKeys as string[];
      let successCount = 0;
      let failureCount = 0;
      const errors: ErrorDetailItem[] = [];
      const updatedItems: BatchProgressItem[] = [...items];

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(id => taskApi.delete(id))
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
            const task = tasks.find(t => t.id === id);
            errors.push({
              id,
              name: task?.name || id,
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
        message.success(`Successfully deleted ${successCount} tasks`);
        setSelectedRowKeys([]);
        loadTasks();
      } else {
        message.warning(`Delete completed: ${successCount} success, ${failureCount} failed`);
        setErrorDetailsVisible(true);
        loadTasks();
      }
    } catch (error: any) {
      updateBatchProgress({ isProcessing: false });
      message.error('Failed to batch delete tasks');
      setErrorDetailsVisible(true);
    }
  };

  // Batch cancel with progress tracking
  const handleBatchCancel = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to cancel')
      return
    }

    const items: BatchProgressItem[] = tasks
      .filter(t => selectedRowKeys.includes(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        status: 'pending' as const,
      }));

    initBatchOperation(selectedRowKeys.length, items);
    setConfirmVisible(false);

    try {
      const batchSize = 5;
      const ids = selectedRowKeys as string[];
      let successCount = 0;
      let failureCount = 0;
      const errors: ErrorDetailItem[] = [];
      const updatedItems: BatchProgressItem[] = [...items];

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(id => taskApi.cancel(id))
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
              updatedItems[itemIndex].error = 'Cancel failed';
            }
            const task = tasks.find(t => t.id === id);
            errors.push({
              id,
              name: task?.name || id,
              type: 'CANCEL',
              error: result.reason?.message || 'Unknown error',
              timestamp: new Date().toISOString(),
              canRetry: false,
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
        message.success(`Successfully cancelled ${successCount} tasks`);
        setSelectedRowKeys([]);
        loadTasks();
      } else {
        message.warning(`Cancel completed: ${successCount} success, ${failureCount} failed`);
        setErrorDetailsVisible(true);
      }
    } catch (error: any) {
      updateBatchProgress({ isProcessing: false });
      message.error('Failed to batch cancel tasks');
      setErrorDetailsVisible(true);
    }
  };

  // Batch status change with progress tracking
  const handleBatchStatusChange = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to update')
      return
    }

    const items: BatchProgressItem[] = tasks
      .filter(t => selectedRowKeys.includes(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        status: 'pending' as const,
      }));

    initBatchOperation(selectedRowKeys.length, items);
    setConfirmVisible(false);

    try {
      const batchSize = 5;
      const ids = selectedRowKeys as string[];
      let successCount = 0;
      let failureCount = 0;
      const errors: ErrorDetailItem[] = [];
      const updatedItems: BatchProgressItem[] = [...items];

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(id => taskApi.update(id, { status }))
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
            const task = tasks.find(t => t.id === id);
            errors.push({
              id,
              name: task?.name || id,
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
        message.success(`Successfully updated status for ${successCount} tasks`);
        setSelectedRowKeys([]);
        loadTasks();
      } else {
        message.warning(`Status update completed: ${successCount} success, ${failureCount} failed`);
        setErrorDetailsVisible(true);
        loadTasks();
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
        ids.map(id => taskApi.delete(id))
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
        loadTasks();
      }
    } else if (pendingAction?.type === 'cancel') {
        message.warning('Cancel operation cannot be retried');
    } else if (pendingAction?.type === 'status_change') {
      const results = await Promise.allSettled(
        ids.map(id => taskApi.update(id, { status: pendingAction.status! }))
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
        loadTasks();
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

  // Start batch cancel with confirmation
  const startBatchCancel = () => {
    setPendingAction({ type: 'cancel' });
    setConfirmVisible(true);
  };

  // Start batch status change with confirmation
  const startBatchStatusChange = (status: string) => {
    setPendingAction({ type: 'status_change', status });
    setConfirmVisible(true);
  };

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(tasks.map(t => t.id))
    } else {
      setSelectedRowKeys([])
    }
  }

  const handleCreate = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleCancel = async (id: string) => {
    try {
      await taskApi.cancel(id)
      message.success('Task cancelled')
      loadTasks()
    } catch (error: any) {
      message.error('Failed to cancel task')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await taskApi.delete(id)
      message.success('Task deleted')
      loadTasks()
    } catch (error: any) {
      message.error('Failed to delete task')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await taskApi.create(values)
      message.success('Task created')
      setModalVisible(false)
      loadTasks()
    } catch (error: any) {
      if (error.message !== 'Validation failed') {
        message.error('Failed to create task')
      }
    }
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      PENDING: 'default',
      RUNNING: 'processing',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'warning',
    }
    return colorMap[status] || 'default'
  }

  // Batch selection column
  const batchColumns = {
    title: (
      <Checkbox
        checked={selectedRowKeys.length === tasks.length && tasks.length > 0}
        onChange={(e) => onSelectAll(e.target.checked)}
        indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < tasks.length}
      />
    ),
    dataIndex: 'id',
    key: 'selection',
    width: 50,
    render: (_: any, record: Task) => (
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

  const columns: ColumnsType<Task> = [
    batchColumns,
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => (
        <Tag color={priority > 5 ? 'red' : priority > 2 ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'PENDING' && (
            <Popconfirm
              title="Cancel task?"
              onConfirm={() => handleCancel(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger icon={<StopOutlined />}>
                Cancel
              </Button>
            </Popconfirm>
          )}
          {(record.status === 'COMPLETED' || record.status === 'CANCELLED' || record.status === 'FAILED') && (
            <Popconfirm
              title="Delete task?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Tasks</h1>
        <Space>
          <ExportButton endpoint="/api/export/tasks" filename="tasks" />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Task
          </Button>
        </Space>
      </div>

      {/* Batch Operations Toolbar */}
      {selectedRowKeys.length > 0 && (
        <Alert
          message={`${selectedRowKeys.length} task(s) selected`}
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
                danger
                loading={batchState.isProcessing}
                onClick={startBatchCancel}
              >
                Cancel Selected
              </Button>
              <Button
                size="small"
                loading={batchState.isProcessing}
                onClick={() => startBatchStatusChange('COMPLETED')}
              >
                Mark Complete
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
        dataSource={tasks}
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
        title="Create Task"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Task Name"
            rules={[
              { required: true, message: 'Please input task name' },
              { max: 100, message: 'Task name must be less than 100 characters' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority (0-10)"
            initialValue={0}
            rules={[{ type: 'number', min: 0, max: 10 }]}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
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
        type={pendingAction?.type === 'delete' ? 'delete' : pendingAction?.type === 'cancel' ? 'dangerous' : 'status_change'}
        message={
            pendingAction?.type === 'delete'
              ? `Are you sure you want to delete the selected ${selectedRowKeys.length} tasks?`
              : pendingAction?.type === 'cancel'
              ? `Are you sure you want to cancel the selected ${selectedRowKeys.length} tasks?`
              : `Are you sure you want to update the status of selected ${selectedRowKeys.length} tasks to ${pendingAction?.status}?`
        }
        itemCount={selectedRowKeys.length}
        itemLabel="tasks"
        actionLabel={
          pendingAction?.type === 'delete' ? 'Delete' : 
          pendingAction?.type === 'cancel' ? 'Cancel' : 'Confirm'
        }
        loading={batchState.isProcessing}
        onConfirm={() => {
          if (pendingAction?.type === 'delete') {
            handleBatchDelete();
          } else if (pendingAction?.type === 'cancel') {
            handleBatchCancel();
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
    </div>
  )
}

export default Tasks
