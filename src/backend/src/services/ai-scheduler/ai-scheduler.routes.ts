/**
 * AI 智能调度系统 - 路由配置
 * @version 3.1.0
 */

import { Router } from 'express';
import { aiSchedulerController } from './ai-scheduler.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// 所有路由都需要认证
router.use(authMiddleware);

// ============================================
// 系统状态
// ============================================

/**
 * @route GET /api/ai-scheduler/status
 * @desc 获取 AI 调度系统整体状态
 * @access Private
 */
router.get('/status', aiSchedulerController.getSystemStatus.bind(aiSchedulerController));

// ============================================
// ML 调度器
// ============================================

/**
 * @route GET /api/ai-scheduler/model/status
 * @desc 获取 ML 模型状态
 * @access Private
 */
router.get('/model/status', aiSchedulerController.getModelStatus.bind(aiSchedulerController));

/**
 * @route GET /api/ai-scheduler/schedule/:taskId
 * @desc 获取单个任务的调度建议
 * @access Private
 */
router.get('/schedule/:taskId', aiSchedulerController.getSchedulingDecision.bind(aiSchedulerController));

/**
 * @route POST /api/ai-scheduler/schedule/batch
 * @desc 批量任务调度优化
 * @access Private
 */
router.post('/schedule/batch', aiSchedulerController.batchSchedule.bind(aiSchedulerController));

/**
 * @route POST /api/ai-scheduler/learn
 * @desc 提交学习反馈
 * @access Private
 */
router.post('/learn', aiSchedulerController.submitLearningFeedback.bind(aiSchedulerController));

// ============================================
// GPU 预测器
// ============================================

/**
 * @route POST /api/ai-scheduler/gpu/predict
 * @desc 预测性 GPU 分配
 * @access Private
 */
router.post('/gpu/predict', aiSchedulerController.predictGpuAllocation.bind(aiSchedulerController));

/**
 * @route GET /api/ai-scheduler/gpu/releasing
 * @desc 获取即将释放的 GPU
 * @access Private
 */
router.get('/gpu/releasing', aiSchedulerController.getReleasingGpus.bind(aiSchedulerController));

/**
 * @route GET /api/ai-scheduler/gpu/patterns
 * @desc 获取 GPU 使用模式统计
 * @access Private
 */
router.get('/gpu/patterns', aiSchedulerController.getGpuPatterns.bind(aiSchedulerController));

/**
 * @route POST /api/ai-scheduler/gpu/predict-batch
 * @desc 批量 GPU 需求预测
 * @access Private
 */
router.post('/gpu/predict-batch', aiSchedulerController.predictBatchGpuRequirements.bind(aiSchedulerController));

// ============================================
// 负载均衡
// ============================================

/**
 * @route GET /api/ai-scheduler/load-balancing/cluster-load
 * @desc 获取集群负载状态
 * @access Private
 */
router.get('/load-balancing/cluster-load', aiSchedulerController.getClusterLoad.bind(aiSchedulerController));

/**
 * @route POST /api/ai-scheduler/load-balancing/analyze
 * @desc 执行负载均衡分析
 * @access Private
 */
router.post('/load-balancing/analyze', aiSchedulerController.analyzeLoadBalancing.bind(aiSchedulerController));

/**
 * @route POST /api/ai-scheduler/load-balancing/execute
 * @desc 执行负载均衡决策
 * @access Private
 */
router.post('/load-balancing/execute', aiSchedulerController.executeLoadBalancing.bind(aiSchedulerController));

/**
 * @route GET /api/ai-scheduler/load-balancing/report
 * @desc 获取负载均衡报告
 * @access Private
 */
router.get('/load-balancing/report', aiSchedulerController.getLoadBalancingReport.bind(aiSchedulerController));

/**
 * @route PUT /api/ai-scheduler/load-balancing/config
 * @desc 更新负载均衡配置
 * @access Private (Admin only)
 */
router.put('/load-balancing/config', aiSchedulerController.updateLoadBalancingConfig.bind(aiSchedulerController));

// ============================================
// 综合调度
// ============================================

/**
 * @route POST /api/ai-scheduler/smart-schedule
 * @desc 智能任务调度 - 综合所有 AI 能力
 * @access Private
 */
router.post('/smart-schedule', aiSchedulerController.smartSchedule.bind(aiSchedulerController));

export default router;