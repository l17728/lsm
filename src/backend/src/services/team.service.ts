import prisma from '../utils/prisma';
import { team_status as TeamStatus, team_role as TeamRole } from '@prisma/client';

// Re-export enums
export { TeamStatus, TeamRole };

export interface CreateTeamDto {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  settings?: Record<string, any>;
  createdBy: string;
}

export interface UpdateTeamDto {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  status?: TeamStatus;
  settings?: Record<string, any>;
}

export interface TeamQueryOptions {
  status?: TeamStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Team Service
 * Handles team CRUD operations and team-level operations
 */
export class TeamService {
  /**
   * Create a new team
   * Automatically adds creator as OWNER
   */
  async create(data: CreateTeamDto) {
    // Check if slug already exists
    const existingSlug = await prisma.team.findUnique({
      where: { slug: data.slug },
    });

    if (existingSlug) {
      throw new Error(`Team slug "${data.slug}" already exists`);
    }

    // Check if name already exists
    const existingName = await prisma.team.findUnique({
      where: { name: data.name },
    });

    if (existingName) {
      throw new Error(`Team name "${data.name}" already exists`);
    }

    // Create team and add creator as owner in a transaction
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.team.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          logoUrl: data.logoUrl,
          settings: data.settings || {},
          createdBy: data.createdBy,
        },
      });

      // Add creator as team owner
      await tx.teamMember.create({
        data: {
          teamId: newTeam.id,
          userId: data.createdBy,
          role: TeamRole.OWNER,
        },
      });

      return newTeam;
    });

    console.log(`[Team] Created team "${team.name}" (${team.id})`);
    return team;
  }

  /**
   * Get team by ID
   */
  async getById(teamId: string) {
    return prisma.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: { members: true, servers: true, tasks: true },
        },
      },
    });
  }

  /**
   * Get team by slug
   */
  async getBySlug(slug: string) {
    return prisma.team.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { members: true, servers: true, tasks: true },
        },
      },
    });
  }

  /**
   * List teams with pagination and filtering
   */
  async list(options: TeamQueryOptions = {}) {
    const { status, search, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { members: true, servers: true, tasks: true },
          },
        },
      }),
      prisma.team.count({ where }),
    ]);

    return {
      data: teams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update team
   */
  async update(teamId: string, data: UpdateTeamDto) {
    // Check for slug conflicts
    if (data.slug) {
      const existing = await prisma.team.findFirst({
        where: {
          slug: data.slug,
          NOT: { id: teamId },
        },
      });
      if (existing) {
        throw new Error(`Team slug "${data.slug}" already exists`);
      }
    }

    // Check for name conflicts
    if (data.name) {
      const existing = await prisma.team.findFirst({
        where: {
          name: data.name,
          NOT: { id: teamId },
        },
      });
      if (existing) {
        throw new Error(`Team name "${data.name}" already exists`);
      }
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data,
    });

    console.log(`[Team] Updated team "${team.name}" (${team.id})`);
    return team;
  }

  /**
   * Soft delete team (archive)
   */
  async archive(teamId: string) {
    const team = await prisma.team.update({
      where: { id: teamId },
      data: { status: TeamStatus.ARCHIVED },
    });

    console.log(`[Team] Archived team "${team.name}" (${team.id})`);
    return team;
  }

  /**
   * Restore archived team
   */
  async restore(teamId: string) {
    const team = await prisma.team.update({
      where: { id: teamId },
      data: { status: TeamStatus.ACTIVE },
    });

    console.log(`[Team] Restored team "${team.name}" (${team.id})`);
    return team;
  }

  /**
   * Suspend team
   */
  async suspend(teamId: string) {
    const team = await prisma.team.update({
      where: { id: teamId },
      data: { status: TeamStatus.SUSPENDED },
    });

    console.log(`[Team] Suspended team "${team.name}" (${team.id})`);
    return team;
  }

  /**
   * Get teams for a user
   */
  async getUserTeams(userId: string) {
    return prisma.team.findMany({
      where: {
        members: {
          some: { userId },
        },
        status: TeamStatus.ACTIVE,
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true, servers: true, tasks: true },
        },
      },
    });
  }

  /**
   * Check if user is team member
   */
  async isMember(teamId: string, userId: string): Promise<boolean> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
    return !!member;
  }

  /**
   * Check if user has team role
   */
  async hasRole(teamId: string, userId: string, roles: TeamRole[]): Promise<boolean> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
    return member ? roles.includes(member.role as TeamRole) : false;
  }

  /**
   * Get team statistics
   */
  async getStats(teamId: string) {
    const [memberCount, serverCount, taskCount, activeQuotas] = await Promise.all([
      prisma.teamMember.count({ where: { teamId } }),
      prisma.server.count({ where: { teamId } }),
      prisma.task.count({ where: { teamId } }),
      prisma.resourceQuota.findMany({
        where: { teamId },
        select: {
          quotaType: true,
          maxServers: true,
          maxGpus: true,
          maxConcurrent: true,
          maxGpuHours: true,
        },
      }),
    ]);

    return {
      memberCount,
      serverCount,
      taskCount,
      quotas: activeQuotas,
    };
  }
}

export const teamService = new TeamService();
export default teamService;