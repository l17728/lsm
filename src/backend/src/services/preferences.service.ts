import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Dark Mode Preferences
 */
export interface DarkModePreferences {
  enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
}

/**
 * User Preferences Service
 */
export class PreferencesService {
  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<DarkModePreferences> {
    try {
      // Try to get from cache first
      const cached = await this.getFromCache(userId);
      if (cached) return cached;

      // Get from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          metadata: true,
        },
      });

      if (!user) {
        return this.getDefaultPreferences();
      }

      const preferences = (user.metadata as any)?.preferences || {};
      
      const result: DarkModePreferences = {
        enabled: preferences.enabled ?? false,
        theme: preferences.theme ?? 'system',
        accentColor: preferences.accentColor ?? '#667eea',
      };

      // Cache the result
      await this.saveToCache(userId, result);

      return result;
    } catch (error) {
      console.error('[Preferences] Error getting preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<DarkModePreferences>
  ): Promise<DarkModePreferences> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentMetadata = (user.metadata as any) || {};
      const currentPreferences = currentMetadata.preferences || {};

      const updatedPreferences = {
        enabled: preferences.enabled ?? currentPreferences.enabled ?? false,
        theme: preferences.theme ?? currentPreferences.theme ?? 'system',
        accentColor: preferences.accentColor ?? currentPreferences.accentColor ?? '#667eea',
      };

      await prisma.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...currentMetadata,
            preferences: updatedPreferences,
          },
        },
      });

      // Update cache
      await this.saveToCache(userId, updatedPreferences);

      return updatedPreferences;
    } catch (error) {
      console.error('[Preferences] Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(userId: string): Promise<DarkModePreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, {
      enabled: !current.enabled,
    });
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): DarkModePreferences {
    return {
      enabled: false,
      theme: 'system',
      accentColor: '#667eea',
    };
  }

  /**
   * Get from cache
   */
  private async getFromCache(userId: string): Promise<DarkModePreferences | null> {
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis();
      
      const cached = await redis.get(`preferences:${userId}`);
      await redis.quit();
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save to cache
   */
  private async saveToCache(userId: string, preferences: DarkModePreferences): Promise<void> {
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis();
      
      await redis.setex(
        `preferences:${userId}`,
        3600, // 1 hour TTL
        JSON.stringify(preferences)
      );
      
      await redis.quit();
    } catch (error) {
      console.error('[Preferences] Error saving to cache:', error);
    }
  }
}

// Export singleton instance
export const preferencesService = new PreferencesService();
