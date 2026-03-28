import { TeamMemberService, TeamRole, TeamStatus, AddMemberDto } from '../../services/team-member.service';
import prisma from '../../utils/prisma';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const makeService = () => new TeamMemberService();

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
  status: TeamStatus.ACTIVE,
};

const mockMember = {
  teamId: 'team-1',
  userId: 'user-2',
  role: TeamRole.MEMBER,
  joinedAt: new Date(),
  invitedBy: 'user-1',
  metadata: {},
  user: {
    id: 'user-2',
    username: 'testuser',
    email: 'test@example.com',
    role: 'USER',
  },
};

describe('TeamMemberService', () => {
  let service: TeamMemberService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  describe('addMember', () => {
    it('should add a new member to an active team', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(mockTeam);
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.teamMember.create as jest.Mock).mockResolvedValue(mockMember);

      const dto: AddMemberDto = { teamId: 'team-1', userId: 'user-2', invitedBy: 'user-1' };
      const result = await service.addMember(dto);

      expect(prisma.teamMember.create as jest.Mock).toHaveBeenCalledTimes(1);
      expect(result.userId).toBe('user-2');
      expect(result.role).toBe(TeamRole.MEMBER);
    });

    it('should throw when team is not found', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addMember({ teamId: 'ghost-team', userId: 'user-2' })
      ).rejects.toThrow('Team not found');
    });

    it('should throw when team is inactive', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue({
        ...mockTeam,
        status: TeamStatus.INACTIVE,
      });

      await expect(
        service.addMember({ teamId: 'team-1', userId: 'user-2' })
      ).rejects.toThrow('Team is not active');
    });

    it('should throw when user is already a member', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(mockTeam);
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(mockMember);

      await expect(
        service.addMember({ teamId: 'team-1', userId: 'user-2' })
      ).rejects.toThrow('User is already a team member');
    });

    it('should throw when team member limit is reached', async () => {
      (prisma.team.findUnique as jest.Mock).mockResolvedValue(mockTeam);
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue({
        id: 'quota-1',
        maxConcurrent: 2,
      });
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(2);

      await expect(
        service.addMember({ teamId: 'team-1', userId: 'user-2' })
      ).rejects.toThrow('Team member limit reached');
    });
  });

  describe('removeMember', () => {
    it('should remove an existing non-owner member', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(mockMember);
      (prisma.teamMember.delete as jest.Mock).mockResolvedValue(mockMember);

      await service.removeMember('team-1', 'user-2');

      expect(prisma.teamMember.delete as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId_userId: { teamId: 'team-1', userId: 'user-2' } },
        })
      );
    });

    it('should throw when member is not found', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.removeMember('team-1', 'ghost-user')).rejects.toThrow(
        'Member not found'
      );
    });

    it('should throw when removing the last owner', async () => {
      const ownerMember = { ...mockMember, role: TeamRole.OWNER };
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(ownerMember);
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(1);

      await expect(service.removeMember('team-1', 'user-2')).rejects.toThrow(
        'Cannot remove the last owner'
      );
    });
  });

  describe('getTeamMembers', () => {
    it('should return paginated team members', async () => {
      const members = [mockMember];
      (prisma.teamMember.findMany as jest.Mock).mockResolvedValue(members);
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getTeamMembers('team-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('updateRole', () => {
    it('should update member role successfully', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(mockMember);
      const updatedMember = { ...mockMember, role: TeamRole.ADMIN };
      (prisma.teamMember.update as jest.Mock).mockResolvedValue(updatedMember);

      const result = await service.updateRole('team-1', 'user-2', TeamRole.ADMIN);

      expect(result.role).toBe(TeamRole.ADMIN);
      expect(prisma.teamMember.update as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('should throw when demoting the last owner', async () => {
      const ownerMember = { ...mockMember, role: TeamRole.OWNER };
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(ownerMember);
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.updateRole('team-1', 'user-2', TeamRole.MEMBER)
      ).rejects.toThrow('Cannot demote the last owner');
    });
  });
});
