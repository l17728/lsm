import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * User Preferences Interface
 */
export interface UserPreferences {
  // Theme settings
  theme: {
    enabled: boolean;
    mode: 'light' | 'dark' | 'system';
    accentColor: string;
  };
  
  // Language settings
  language: {
    code: string; // 'zh-CN', 'en-US', etc.
    timezone: string;
    dateFormat: string; // 'YYYY-MM-DD', 'MM/DD/YYYY', etc.
    timeFormat: '12h' | '24h';
  };
  
  // Notification settings
  notifications: {
    email: boolean;
    websocket: boolean;
    desktop: boolean;
    sound: boolean;
    quietHours: {
      enabled: boolean;
      start: string; // '22:00'
      end: string; // '08:00'
    };
  };
  
  // Pagination settings
  pagination: {
    pageSize: number;
    defaultSort: string;
    defaultOrder: 'asc' | 'desc';
  };
  
  // Display settings
  display: {
    compactMode: boolean;
    showAnimations: boolean;
    autoRefresh: boolean;
    refreshInterval: number; // seconds
  };
}

/**
 * User Preferences Service
 */
export class PreferencesService {
  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
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
      
      const result: UserPreferences = {
        theme: {
          enabled: preferences.theme?.enabled ?? false,
          mode: preferences.theme?.mode ?? 'system',
          accentColor: preferences.theme?.accentColor ?? '#667eea',
        },
        language: {
          code: preferences.language?.code ?? 'zh-CN',
          timezone: preferences.language?.timezone ?? 'Asia/Shanghai',
          dateFormat: preferences.language?.dateFormat ?? 'YYYY-MM-DD',
          timeFormat: preferences.language?.timeFormat ?? '24h',
        },
        notifications: {
          email: preferences.notifications?.email ?? true,
          websocket: preferences.notifications?.websocket ?? true,
          desktop: preferences.notifications?.desktop ?? true,
          sound: preferences.notifications?.sound ?? true,
          quietHours: {
            enabled: preferences.notifications?.quietHours?.enabled ?? false,
            start: preferences.notifications?.quietHours?.start ?? '22:00',
            end: preferences.notifications?.quietHours?.end ?? '08:00',
          },
        },
        pagination: {
          pageSize: preferences.pagination?.pageSize ?? 20,
          defaultSort: preferences.pagination?.defaultSort ?? 'createdAt',
          defaultOrder: preferences.pagination?.defaultOrder ?? 'desc',
        },
        display: {
          compactMode: preferences.display?.compactMode ?? false,
          showAnimations: preferences.display?.showAnimations ?? true,
          autoRefresh: preferences.display?.autoRefresh ?? true,
          refreshInterval: preferences.display?.refreshInterval ?? 30,
        },
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
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentMetadata = (user.metadata as any) || {};
      const currentPreferences = currentMetadata.preferences || {};

      // Deep merge preferences
      const updatedPreferences: UserPreferences = {
        theme: {
          ...currentPreferences.theme,
          ...updates.theme,
        },
        language: {
          ...currentPreferences.language,
          ...updates.language,
        },
        notifications: {
          ...currentPreferences.notifications,
          ...updates.notifications,
          quietHours: {
            ...currentPreferences.notifications?.quietHours,
            ...updates.notifications?.quietHours,
          },
        },
        pagination: {
          ...currentPreferences.pagination,
          ...updates.pagination,
        },
        display: {
          ...currentPreferences.display,
          ...updates.display,
        },
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
   * Update theme preferences
   */
  async updateTheme(
    userId: string,
    theme: Partial<UserPreferences['theme']>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, { 
      theme: { ...current.theme, ...theme } 
    });
  }

  /**
   * Update language preferences
   */
  async updateLanguage(
    userId: string,
    language: Partial<UserPreferences['language']>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, { 
      language: { ...current.language, ...language } 
    });
  }

  /**
   * Update notification preferences
   */
  async updateNotifications(
    userId: string,
    notifications: Partial<UserPreferences['notifications']>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, { 
      notifications: { 
        ...current.notifications, 
        ...notifications,
        quietHours: { ...current.notifications.quietHours, ...notifications.quietHours }
      } 
    });
  }

  /**
   * Update pagination preferences
   */
  async updatePagination(
    userId: string,
    pagination: Partial<UserPreferences['pagination']>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, { 
      pagination: { ...current.pagination, ...pagination } 
    });
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(userId: string): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    return this.updateUserPreferences(userId, {
      theme: {
        ...current.theme,
        enabled: !current.theme.enabled,
      },
    });
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: {
        enabled: false,
        mode: 'system',
        accentColor: '#667eea',
      },
      language: {
        code: 'zh-CN',
        timezone: 'Asia/Shanghai',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
      },
      notifications: {
        email: true,
        websocket: true,
        desktop: true,
        sound: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
      },
      pagination: {
        pageSize: 20,
        defaultSort: 'createdAt',
        defaultOrder: 'desc',
      },
      display: {
        compactMode: false,
        showAnimations: true,
        autoRefresh: true,
        refreshInterval: 30,
      },
    };
  }

  /**
   * Get from cache
   */
  private async getFromCache(userId: string): Promise<UserPreferences | null> {
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
  private async saveToCache(userId: string, preferences: UserPreferences): Promise<void> {
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
