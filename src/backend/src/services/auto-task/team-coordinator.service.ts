/**
 * Team Coordinator Service - 团队协调服务
 * 
 * 支持自主组织团队开发
 * - Agent 角色分配
 * - 任务分发和负载均衡
 * - 团队协作管理
 */

import prisma from '../../utils/prisma';

// Agent 角色定义
export enum AgentRole {
  COORDINATOR = 'COORDINATOR',     // 协调者 - 任务分解和分配
  DEVELOPER = 'DEVELOPER',          // 开发者 - 代码实现
  REVIEWER = 'REVIEWER',            // 审核者 - 代码审查
  TESTER = 'TESTER',                // 测试者 - 测试验证
  DOCUMENTER = 'DOCUMENTER',        // 文档编写者
  DEPLOYER = 'DEPLOYER',            // 部署者 - 环境和发布
}

// Agent 能力描述
interface AgentCapability {
  role: AgentRole;
  skills: string[];
  maxConcurrentTasks: number;
  priority: number;
}

// Agent 实例
interface AgentInstance {
  id: string;
  role: AgentRole;
  status: 'idle' | 'busy' | 'offline';
  currentTasks: string[];
  completedTasks: number;
  lastHeartbeat: Date;
}

// 任务分配请求
interface TaskAssignment {
  taskId: string;
  assignedTo: string;
  role: AgentRole;
  subtasks?: TaskAssignment[];
  dependencies?: string[];
  priority: number;
}

// 团队配置
interface TeamConfig {
  name: string;
  agents: Map<string, AgentInstance>;
  capabilities: AgentCapability[];
}

// 默认能力配置
const DEFAULT_CAPABILITIES: AgentCapability[] = [
  { role: AgentRole.COORDINATOR, skills: ['planning', 'decomposition', 'assignment'], maxConcurrentTasks: 5, priority: 100 },
  { role: AgentRole.DEVELOPER, skills: ['coding', 'debugging', 'refactoring'], maxConcurrentTasks: 3, priority: 75 },
  { role: AgentRole.REVIEWER, skills: ['code-review', 'quality-check', 'best-practices'], maxConcurrentTasks: 5, priority: 60 },
  { role: AgentRole.TESTER, skills: ['testing', 'validation', 'bug-detection'], maxConcurrentTasks: 4, priority: 50 },
  { role: AgentRole.DOCUMENTER, skills: ['documentation', 'api-docs', 'readme'], maxConcurrentTasks: 6, priority: 40 },
  { role: AgentRole.DEPLOYER, skills: ['deployment', 'ci-cd', 'infrastructure'], maxConcurrentTasks: 2, priority: 80 },
];

export class TeamCoordinatorService {
  private teams: Map<string, TeamConfig> = new Map();
  private capabilities: AgentCapability[] = DEFAULT_CAPABILITIES;
  private agentRegistry: Map<string, AgentInstance> = new Map();

  /**
   * 注册 Agent
   */
  registerAgent(
    agentId: string,
    role: AgentRole,
    customCapabilities?: Partial<AgentCapability>
  ): AgentInstance {
    const capability = this.capabilities.find(c => c.role === role) || DEFAULT_CAPABILITIES[0];
    
    const agent: AgentInstance = {
      id: agentId,
      role,
      status: 'idle',
      currentTasks: [],
      completedTasks: 0,
      lastHeartbeat: new Date(),
    };

    this.agentRegistry.set(agentId, agent);
    console.log(`[TeamCoordinator] Agent ${agentId} registered as ${role}`);
    
    return agent;
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return false;

    // 检查是否有进行中的任务
    if (agent.currentTasks.length > 0) {
      console.warn(`[TeamCoordinator] Agent ${agentId} has ${agent.currentTasks.length} pending tasks`);
      this.reassignTasks(agentId, agent.currentTasks);
    }

    this.agentRegistry.delete(agentId);
    return true;
  }

  /**
   * 分配任务给合适的 Agent
   */
  async assignTask(
    taskId: string,
    requiredRole: AgentRole,
    preferredAgentId?: string
  ): Promise<TaskAssignment | null> {
    // 查找可用的 Agent
    let targetAgent: AgentInstance | null = null;

    if (preferredAgentId) {
      const preferred = this.agentRegistry.get(preferredAgentId);
      if (preferred && preferred.role === requiredRole && preferred.status !== 'offline') {
        targetAgent = preferred;
      }
    }

    if (!targetAgent) {
      targetAgent = this.findAvailableAgent(requiredRole);
    }

    if (!targetAgent) {
      console.warn(`[TeamCoordinator] No available agent for role ${requiredRole}`);
      return null;
    }

    // 更新 Agent 状态
    targetAgent.status = targetAgent.currentTasks.length > 0 ? 'busy' : 'idle';
    targetAgent.currentTasks.push(taskId);

    const assignment: TaskAssignment = {
      taskId,
      assignedTo: targetAgent.id,
      role: requiredRole,
      priority: this.getRolePriority(requiredRole),
    };

    // 记录到数据库
    await this.recordAssignment(taskId, targetAgent.id, requiredRole);

    return assignment;
  }

  /**
   * 查找可用的 Agent
   */
  private findAvailableAgent(role: AgentRole): AgentInstance | null {
    const agents = Array.from(this.agentRegistry.values())
      .filter(a => a.role === role && a.status !== 'offline');

    if (agents.length === 0) return null;

    // 按负载排序，选择最空闲的
    const capability = this.capabilities.find(c => c.role === role);
    const maxTasks = capability?.maxConcurrentTasks || 3;

    const availableAgents = agents
      .filter(a => a.currentTasks.length < maxTasks)
      .sort((a, b) => a.currentTasks.length - b.currentTasks.length);

    return availableAgents[0] || null;
  }

  /**
   * 重新分配任务
   */
  private async reassignTasks(fromAgentId: string, taskIds: string[]): Promise<void> {
    for (const taskId of taskIds) {
      const agent = this.agentRegistry.get(fromAgentId);
      if (!agent) continue;

      // 移除旧分配
      agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);

      // 查找新的可用 Agent
      const newAgent = this.findAvailableAgent(agent.role);
      if (newAgent) {
        newAgent.currentTasks.push(taskId);
        await this.recordAssignment(taskId, newAgent.id, agent.role);
        console.log(`[TeamCoordinator] Reassigned task ${taskId} from ${fromAgentId} to ${newAgent.id}`);
      }
    }
  }

  /**
   * 标记任务完成
   */
  completeTask(agentId: string, taskId: string): void {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return;

    agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
    agent.completedTasks++;
    
    // 更新状态
    if (agent.currentTasks.length === 0) {
      agent.status = 'idle';
    }
  }

  /**
   * 更新 Agent 心跳
   */
  updateHeartbeat(agentId: string): boolean {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return false;

    agent.lastHeartbeat = new Date();
    return true;
  }

  /**
   * 获取团队状态
   */
  getTeamStatus(): {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    busyAgents: number;
    byRole: Record<AgentRole, number>;
  } {
    const agents = Array.from(this.agentRegistry.values());
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status !== 'offline').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      byRole: this.countByRole(agents),
    };
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus(agentId: string): AgentInstance | null {
    return this.agentRegistry.get(agentId) || null;
  }

  /**
   * 列出所有 Agent
   */
  listAgents(): AgentInstance[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * 获取角色优先级
   */
  private getRolePriority(role: AgentRole): number {
    const capability = this.capabilities.find(c => c.role === role);
    return capability?.priority || 50;
  }

  /**
   * 按角色统计
   */
  private countByRole(agents: AgentInstance[]): Record<AgentRole, number> {
    const count: Record<AgentRole, number> = {
      [AgentRole.COORDINATOR]: 0,
      [AgentRole.DEVELOPER]: 0,
      [AgentRole.REVIEWER]: 0,
      [AgentRole.TESTER]: 0,
      [AgentRole.DOCUMENTER]: 0,
      [AgentRole.DEPLOYER]: 0,
    };

    for (const agent of agents) {
      count[agent.role]++;
    }

    return count;
  }

  /**
   * 记录任务分配到数据库
   */
  private async recordAssignment(
    taskId: string,
    agentId: string,
    role: AgentRole
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: agentId,
          action: 'TASK_ASSIGNED',
          resourceType: 'AGENT_TASK',
          resourceId: taskId,
          details: { role, agentId, assignedAt: new Date().toISOString() },
        },
      });
    } catch (error) {
      console.error('[TeamCoordinator] Failed to record assignment:', error);
    }
  }

  /**
   * 创建协作团队
   */
  createTeam(name: string, agentIds: string[]): TeamConfig {
    const agents = new Map<string, AgentInstance>();
    
    for (const agentId of agentIds) {
      const agent = this.agentRegistry.get(agentId);
      if (agent) {
        agents.set(agentId, agent);
      }
    }

    const team: TeamConfig = {
      name,
      agents,
      capabilities: this.capabilities,
    };

    this.teams.set(name, team);
    return team;
  }

  /**
   * 获取团队
   */
  getTeam(name: string): TeamConfig | undefined {
    return this.teams.get(name);
  }

  /**
   * 检查离线 Agent
   */
  checkOfflineAgents(timeoutMs = 60000): string[] {
    const now = Date.now();
    const offlineAgents: string[] = [];

    for (const [id, agent] of this.agentRegistry) {
      if (now - agent.lastHeartbeat.getTime() > timeoutMs) {
        agent.status = 'offline';
        offlineAgents.push(id);
      }
    }

    return offlineAgents;
  }
}

export const teamCoordinatorService = new TeamCoordinatorService();
export default teamCoordinatorService;