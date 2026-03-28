import prisma from '../utils/prisma';
import { team_role as TeamRole, team_status as TeamStatus } from '@prisma/client';

export { TeamRole, TeamStatus };

export interface AddMemberDto {
  teamId: string;
  userId: string;
  role?: TeamRole;
  invitedBy?: string;
  metadata?: Record<string, any>;
}

export interface UpdateMemberRoleDto {
  teamId: string;
  userId: string;
  role: TeamRole;
}

export interface MemberQueryOptions {
  teamId?: string;
  userId?: string;
  role?: TeamRole;
  page?: number;
  limit?: number;
}

/**
 * Team Member Service
 * Handles team membership management
 */
export class TeamMemberService {
  /**
   * Add member to team
   */
  async addMember(data: AddMemberDto) {
    // Check if team exists and is active
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    if (team.status !== TeamStatus.ACTIVE) {
      throw new Error('Team is not active');
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: data.teamId, userId: data.userId },
      },
    });

    if (existingMember) {
      throw new Error('User is already a team member');
    }

    // Check member limit (if quota exists)
    const quota = await prisma.resourceQuota.findFirst({
      where: {
        teamId: data.teamId,
        quotaType: 'TEAM',
      },
    });

    if (quota && quota.maxConcurrent !== null) {
      const currentCount = await prisma.teamMember.count({
        where: { teamId: data.teamId },
      });

      if (currentCount >= quota.maxConcurrent) {
        throw new Error('Team member limit reached');
      }
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId: data.teamId,
        userId: data.userId,
        role: data.role || TeamRole.MEMBER,
        invitedBy: data.invitedBy,
        metadata: data.metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(`[TeamMember] Added user "${member.user.username}" to team "${data.teamId}" as ${data.role || 'MEMBER'}`);
    return member;
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string) {
    // Check if member exists
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Check if this is the last owner
    if (member.role === TeamRole.OWNER) {
      const ownerCount = await prisma.teamMember.count({
        where: { teamId, role: TeamRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last owner. Transfer ownership first.');
      }
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    console.log(`[TeamMember] Removed user "${userId}" from team "${teamId}"`);
  }

  /**
   * Update member role
   */
  async updateRole(teamId: string, userId: string, newRole: TeamRole) {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    // Check if demoting the last owner
    if (member.role === TeamRole.OWNER && newRole !== TeamRole.OWNER) {
      const ownerCount = await prisma.teamMember.count({
        where: { teamId, role: TeamRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new Error('Cannot demote the last owner. Transfer ownership first.');
      }
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId },
      },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    console.log(`[TeamMember] Updated user "${userId}" role to ${newRole} in team "${teamId}"`);
    return updatedMember;
  }

  /**
   * Transfer ownership
   */
  async transferOwnership(teamId: string, fromUserId: string, toUserId: string) {
    return prisma.$transaction(async (tx) => {
      // Verify current owner
      const currentOwner = await tx.teamMember.findUnique({
        where: {
          teamId_userId: { teamId, userId: fromUserId },
        },
      });

      if (!currentOwner || currentOwner.role !== TeamRole.OWNER) {
        throw new Error('Current user is not an owner');
      }

      // Verify new owner exists and is a member
      const newOwner = await tx.teamMember.findUnique({
        where: {
          teamId_userId: { teamId, userId: toUserId },
        },
      });

      if (!newOwner) {
        throw new Error('Target user is not a team member');
      }

      // Demote current owner to admin
      await tx.teamMember.update({
        where: {
          teamId_userId: { teamId, userId: fromUserId },
        },
        data: { role: TeamRole.ADMIN },
      });

      // Promote new owner
      const updatedMember = await tx.teamMember.update({
        where: {
          teamId_userId: { teamId, userId: toUserId },
        },
        data: { role: TeamRole.OWNER },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      console.log(`[TeamMember] Transferred ownership from ${fromUserId} to ${toUserId} in team "${teamId}"`);
      return updatedMember;
    });
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      prisma.teamMember.findMany({
        where: { teamId },
        skip,
        take: limit,
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.teamMember.count({ where: { teamId } }),
    ]);

    return {
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's team memberships
   */
  async getUserMemberships(userId: string) {
    return prisma.teamMember.findMany({
      where: {
        userId,
        team: { status: TeamStatus.ACTIVE },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Get member by team and user ID
   */
  async getMember(teamId: string, userId: string) {
    return prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Check if user can perform action based on team role
   */
  async checkPermission(
    teamId: string,
    userId: string,
    requiredRoles: TeamRole[]
  ): Promise<{ allowed: boolean; member?: any }> {
    const member = await this.getMember(teamId, userId);

    if (!member) {
      return { allowed: false };
    }

    const allowed = requiredRoles.includes(member.role as TeamRole);
    return { allowed, member };
  }

  /**
   * Bulk add members
   */
  async bulkAddMembers(
    teamId: string,
    members: Array<{ userId: string; role?: TeamRole }>,
    invitedBy?: string
  ) {
    const results = {
      success: [] as string[],
      failed: [] as { userId: string; error: string }[],
    };

    for (const member of members) {
      try {
        await this.addMember({
          teamId,
          userId: member.userId,
          role: member.role || TeamRole.MEMBER,
          invitedBy,
        });
        results.success.push(member.userId);
      } catch (error: any) {
        results.failed.push({
          userId: member.userId,
          error: error.message,
        });
      }
    }

    console.log(`[TeamMember] Bulk add: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }
}

export const teamMemberService = new TeamMemberService();
export default teamMemberService;