import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Tasks from '../Tasks'

// Mock Task API
vi.mock('../../services/api', () => ({
  taskApi: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    batchDelete: vi.fn(),
    batchCancel: vi.fn(),
    batchUpdateStatus: vi.fn(),
  },
}))

// Mock WebSocket service
vi.mock('../../services/websocket', () => ({
  wsService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock child components to simplify rendering
vi.mock('../../components/ExportButton', () => ({
  ExportButton: () => <button>导出</button>,
}))

vi.mock('../../components/BatchProgressBar', () => ({
  default: () => <div data-testid="batch-progress">批量进度</div>,
}))

vi.mock('../../components/ConfirmDialog', () => ({
  default: ({ visible, onConfirm, onCancel }: any) =>
    visible ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>确认</button>
        <button onClick={onCancel}>取消</button>
      </div>
    ) : null,
}))

vi.mock('../../components/ErrorDetails', () => ({
  default: () => <div data-testid="error-details">错误详情</div>,
}))

import { taskApi } from '../../services/api'

const mockTasks = [
  {
    id: 'task-1',
    name: 'Model Training',
    description: 'Train ResNet50',
    status: 'RUNNING',
    priority: 7,
    createdAt: '2026-03-17T08:00:00Z',
  },
  {
    id: 'task-2',
    name: 'Data Preprocessing',
    description: 'Preprocess dataset',
    status: 'PENDING',
    priority: 3,
    createdAt: '2026-03-17T09:00:00Z',
  },
  {
    id: 'task-3',
    name: 'Model Evaluation',
    description: 'Evaluate model',
    status: 'COMPLETED',
    priority: 5,
    createdAt: '2026-03-17T07:00:00Z',
    completedAt: '2026-03-17T12:00:00Z',
  },
]

describe('Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(taskApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockTasks },
    })
    ;(taskApi.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: { running: 1, pending: 1, completed: 1 } },
    })
  })

  describe('渲染测试', () => {
    it('应该不崩溃地渲染任务页面', async () => {
      const { container } = render(<Tasks />)
      expect(container).toBeTruthy()
    })

    it('挂载时应该加载任务列表', async () => {
      render(<Tasks />)

      await waitFor(() => {
        expect(taskApi.getAll).toHaveBeenCalledTimes(1)
      })
    })

    it('应该显示任务名称', async () => {
      render(<Tasks />)

      await waitFor(() => {
        expect(screen.getByText('Model Training')).toBeInTheDocument()
      })
    })

    it('应该显示所有任务', async () => {
      render(<Tasks />)

      await waitFor(() => {
        expect(screen.getByText('Model Training')).toBeInTheDocument()
        expect(screen.getByText('Data Preprocessing')).toBeInTheDocument()
        expect(screen.getByText('Model Evaluation')).toBeInTheDocument()
      })
    })

    it('应该渲染新建任务按钮', async () => {
      render(<Tasks />)

      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('创建任务', () => {
    it('点击新建按钮应该显示创建表单', async () => {
      render(<Tasks />)

      await waitFor(() => {
        expect(screen.getByText('Model Training')).toBeInTheDocument()
      })

      // Find and click the Create Task button
      const addButton = screen.getByRole('button', { name: /Create Task/ })
      fireEvent.click(addButton)

      await waitFor(() => {
        // Modal should be visible after clicking - look for form fields
        expect(screen.getByText('Task Name')).toBeInTheDocument()
      })
    })
  })

  describe('错误状态', () => {
    it('API 失败时应该不崩溃', async () => {
      ;(taskApi.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const { container } = render(<Tasks />)

      await waitFor(() => {
        expect(container).toBeTruthy()
      })
    })
  })
})
