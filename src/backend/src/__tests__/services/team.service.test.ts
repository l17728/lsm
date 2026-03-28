/**
 * TeamService Unit Tests
 *
 * Tests for team CRUD and membership operations.
 */

// Mock prisma with team and teamMember models
jest.mock('../../utils/prisma', () => ({
  team: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  teamMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}));

// Mock @prisma/client for enum imports
jest.mock('@prisma/client', () => ({
  team_status: {
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED',
    SUSPENDED: 'SUSPENDED',
  },
  team_role: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
    VIEWER: 'VIEWER',
  },
}));

import { TeamService } from '../../services/team.service';
import prisma from '../../utils/prisma';

describe('TeamService', () => {
  let service: TeamService;

  beforeEach(() => {
    service = new TeamService();
    jest.clearAllMocks();
  });

  // ==================== create ====================

  describe('create', () => {
    const validCreateData = {
      name: 'ML Research Team',
      slug: 'ml-research',
      description: 'Machine learning research group',
      createdBy: 'user-1',
    };

    it('should create a team and add creator as OWNER', async () => {
      const mockTeam = { id: 'team-1', ...validCreateData };

      // No existing slug or name
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock transaction to execute the callback
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          team: { create: jest.fn().mockResolvedValue(mockTeam) },
          teamMember: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.create(validCreateData);

      expect(result).toEqual(mockTeam);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error when slug already exists', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'existing-team',
        slug: 'ml-research',
      });

      await expect(service.create(validCreateData)).rejects.toThrow(
        'Team slug "ml-research" already exists'
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw error when name already exists', async () => {
      (prisma.team.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // slug check passes
        .mockResolvedValueOnce({ id: 'existing-team', name: 'ML Research Team' }); // name conflict

      await expect(service.create(validCreateData)).rejects.toThrow(
        'Team name "ML Research Team" already exists'
      );
    });
  });

  // ==================== getById ====================

  describe('getById', () => {
    it('should return team with counts when found', async () => {
      const mockTeam = {
        id: 'team-1',
        name: 'Test Team',
        _count: { members: 3, servers: 2, tasks: 5 },
      };
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(mockTeam);

      const result = await service.getById('team-1');

      expect(result).toEqual(mockTeam);
      expect(prisma.team.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'team-1' } })
      );
    });

    it('should return null when team not found', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== list ====================

  describe('list', () => {
    it('should return paginated teams with defaults', async () => {
      const mockTeams = [
        { id: 'team-1', name: 'Team A' },
        { id: 'team-2', name: 'Team B' },
      ];
      (prisma.team.findMany as jest.Mock).mockResolvedValue(mockTeams);
      (prisma.team.count as jest.Mock).mockResolvedValue(2);

      const result = await service.list();

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should apply status filter', async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.count as jest.Mock).mockResolvedValue(0);

      await service.list({ status: 'ACTIVE' as any });

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('should apply search filter across name, slug, and description', async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.count as jest.Mock).mockResolvedValue(0);

      await service.list({ search: 'ml' });

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should calculate correct pagination', async () => {
      (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.team.count as jest.Mock).mockResolvedValue(45);

      const result = await service.list({ page: 2, limit: 10 });

      expect(result.pagination.totalPages).toBe(5);
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });
  });

  // ==================== archive ====================

  describe('archive', () => {
    it('should update team status to ARCHIVED', async () => {
      const mockTeam = { id: 'team-1', name: 'Old Team', status: 'ARCHIVED' };
      (prisma.team.update as jest.Mock).mockResolvedValue(mockTeam);

      const result = await service.archive('team-1');

      expect(result).toEqual(mockTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { status: 'ARCHIVED' },
      });
    });
  });

  // ==================== isMember ====================

  describe('isMember', () => {
    it('should return true when user is a team member', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'MEMBER',
      });

      const result = await service.isMember('team-1', 'user-1');

      expect(result).toBe(true);
      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 'team-1', userId: 'user-1' } },
      });
    });

    it('should return false when user is not a team member', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.isMember('team-1', 'non-member');

      expect(result).toBe(false);
    });
  });

  // ==================== hasRole ====================

  describe('hasRole', () => {
    it('should return true when user has one of the required roles', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'ADMIN',
      });

      const result = await service.hasRole('team-1', 'user-1', ['ADMIN', 'OWNER'] as any[]);

      expect(result).toBe(true);
    });

    it('should return false when user role is not in required roles', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        teamId: 'team-1',
        userId: 'user-1',
        role: 'VIEWER',
      });

      const result = await service.hasRole('team-1', 'user-1', ['ADMIN', 'OWNER'] as any[]);

      expect(result).toBe(false);
    });

    it('should return false when user is not a member at all', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.hasRole('team-1', 'non-member', ['MEMBER'] as any[]);

      expect(result).toBe(false);
    });
  });
});
