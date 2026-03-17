/**
 * TwoFactorAuthService Unit Tests
 *
 * Tests for 2FA cryptographic operations.
 * No Prisma dependency — pure TOTP/QR code operations.
 */

import { TwoFactorAuthService } from '../../services/2fa.service';

// Mock speakeasy
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn().mockReturnValue({
    base32: 'JBSWY3DPEHPK3PXP',
    otpauth_url: 'otpauth://totp/LSM%20System%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=LSM%20System',
  }),
  totp: {
    verify: jest.fn(),
  },
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;

  beforeEach(() => {
    service = new TwoFactorAuthService();
    jest.clearAllMocks();
  });

  // ==================== generateSecret ====================

  describe('generateSecret', () => {
    it('should return base32 secret and otpauth URL', () => {
      const result = service.generateSecret('user-1', 'test@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.otpauthUrl).toContain('otpauth://totp/');
    });

    it('should call speakeasy.generateSecret with correct params', () => {
      service.generateSecret('user-1', 'test@example.com');

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'LSM System (test@example.com)',
        issuer: 'LSM System',
        length: 32,
      });
    });

    it('should include user email in the OTP auth URL name', () => {
      (speakeasy.generateSecret as jest.Mock).mockReturnValueOnce({
        base32: 'NEWSECRET123',
        otpauth_url: 'otpauth://totp/LSM%20System%20(admin%40lab.com)?secret=NEWSECRET123&issuer=LSM',
      });

      const result = service.generateSecret('user-2', 'admin@lab.com');

      expect(result.secret).toBe('NEWSECRET123');
      expect(result.otpauthUrl).toContain('admin%40lab.com');
    });
  });

  // ==================== generateQRCode ====================

  describe('generateQRCode', () => {
    it('should return base64 data URL', async () => {
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      (qrcode.toDataURL as jest.Mock).mockResolvedValue(mockDataUrl);

      const result = await service.generateQRCode('otpauth://totp/test');

      expect(result).toBe(mockDataUrl);
      expect(qrcode.toDataURL).toHaveBeenCalledWith('otpauth://totp/test');
    });

    it('should throw error when QR code generation fails', async () => {
      (qrcode.toDataURL as jest.Mock).mockRejectedValue(new Error('QR generation failed'));

      await expect(service.generateQRCode('invalid-url')).rejects.toThrow(
        'Failed to generate QR code'
      );
    });
  });

  // ==================== verifyToken ====================

  describe('verifyToken', () => {
    it('should return true for valid TOTP token', () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = service.verifyToken('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        encoding: 'base32',
        token: '123456',
        window: 2,
      });
    });

    it('should return false for invalid TOTP token', () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const result = service.verifyToken('JBSWY3DPEHPK3PXP', '000000');

      expect(result).toBe(false);
    });

    it('should return false when speakeasy throws an error', () => {
      (speakeasy.totp.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Internal speakeasy error');
      });

      const result = service.verifyToken('INVALID_SECRET', '123456');

      expect(result).toBe(false);
    });
  });

  // ==================== generateBackupCodes ====================

  describe('generateBackupCodes', () => {
    it('should generate the default 10 backup codes', () => {
      const codes = service.generateBackupCodes();

      expect(codes).toHaveLength(10);
    });

    it('should generate the specified number of backup codes', () => {
      const codes = service.generateBackupCodes(5);

      expect(codes).toHaveLength(5);
    });

    it('should generate uppercase string codes', () => {
      const codes = service.generateBackupCodes(3);

      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]+$/);
      });
    });

    it('should generate unique codes', () => {
      // Run multiple times to reduce flakiness
      let hasDuplicate = false;
      for (let i = 0; i < 5; i++) {
        const codes = service.generateBackupCodes(10);
        const uniqueCodes = new Set(codes);
        if (uniqueCodes.size !== codes.length) {
          hasDuplicate = true;
          break;
        }
      }
      // Backup codes should generally be unique (probabilistic, not guaranteed)
      expect(hasDuplicate).toBe(false);
    });
  });

  // ==================== verifyBackupCode ====================

  describe('verifyBackupCode', () => {
    it('should return true and remove the code when valid', () => {
      const backupCodes = ['ABC123', 'DEF456', 'GHI789'];

      const result = service.verifyBackupCode(backupCodes, 'DEF456');

      expect(result).toBe(true);
      expect(backupCodes).toHaveLength(2);
      expect(backupCodes).not.toContain('DEF456');
    });

    it('should return false when code does not match', () => {
      const backupCodes = ['ABC123', 'DEF456'];

      const result = service.verifyBackupCode(backupCodes, 'WRONG1');

      expect(result).toBe(false);
      expect(backupCodes).toHaveLength(2); // unchanged
    });

    it('should be case-insensitive for input code', () => {
      const backupCodes = ['ABC123'];

      const result = service.verifyBackupCode(backupCodes, 'abc123');

      expect(result).toBe(true);
      expect(backupCodes).toHaveLength(0);
    });

    it('should return false for empty backup codes array', () => {
      const result = service.verifyBackupCode([], 'ABC123');

      expect(result).toBe(false);
    });

    it('should only remove the matched code, not others', () => {
      const backupCodes = ['CODE1', 'CODE2', 'CODE3'];

      service.verifyBackupCode(backupCodes, 'CODE2');

      expect(backupCodes).toEqual(['CODE1', 'CODE3']);
    });
  });

  // ==================== validateSetup ====================

  describe('validateSetup', () => {
    it('should return true when token is valid (delegates to verifyToken)', () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = service.validateSetup('JBSWY3DPEHPK3PXP', '123456');

      expect(result).toBe(true);
    });

    it('should return false when token is invalid', () => {
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      const result = service.validateSetup('JBSWY3DPEHPK3PXP', '999999');

      expect(result).toBe(false);
    });
  });
});
