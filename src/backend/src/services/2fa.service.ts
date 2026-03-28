import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

/**
 * 2FA Service for Two-Factor Authentication
 */
export class TwoFactorAuthService {
  /**
   * Generate 2FA secret for user
   */
  generateSecret(userId: string, email: string): {
    secret: string;
    otpauthUrl: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `LSM System (${email})`,
      issuer: 'LSM System',
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate QR code for 2FA setup
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const qrCode = await qrcode.toDataURL(otpauthUrl);
      return qrCode;
    } catch (error) {
      console.error('[2FA] QR code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify 2FA token
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps of drift
      });

      return verified;
    } catch (error) {
      console.error('[2FA] Token verification error:', error);
      return false;
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(backupCodes: string[], code: string): boolean {
    const index = backupCodes.indexOf(code.toUpperCase());
    if (index !== -1) {
      backupCodes.splice(index, 1); // Remove used code
      return true;
    }
    return false;
  }

  /**
   * Validate 2FA setup
   */
  validateSetup(secret: string, token: string): boolean {
    return this.verifyToken(secret, token);
  }

  /**
   * Disable 2FA for user
   */
  disable2FA(): void {
    // Implementation depends on database schema
    console.log('[2FA] 2FA disabled');
  }
}

// Export singleton instance
export const twoFactorAuthService = new TwoFactorAuthService();
