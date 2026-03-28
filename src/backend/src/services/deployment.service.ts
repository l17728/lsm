import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Deployment Service for LSM Project
 */
export class DeploymentService {
  private workspaceDir: string;
  private backupDir: string;

  constructor() {
    this.workspaceDir = process.env.WORKSPACE_DIR || '/root/.openclaw/workspace/lsm-project';
    this.backupDir = process.env.BACKUP_DIR || '/root/.openclaw/workspace/backups';
  }

  /**
   * Create backup before deployment
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);

    try {
      // Create backup directory
      await execAsync(`mkdir -p ${backupPath}`);

      // Backup database
      await execAsync(
        `pg_dump -U lsm_admin -h localhost lsm > ${backupPath}/database.sql`
      );

      // Backup environment files
      await execAsync(`cp ${this.workspaceDir}/src/backend/.env ${backupPath}/backend.env`);
      await execAsync(`cp ${this.workspaceDir}/src/frontend/.env ${backupPath}/frontend.env`);

      // Backup current build
      await execAsync(`cp -r ${this.workspaceDir}/src/backend/dist ${backupPath}/backend-dist`);
      await execAsync(`cp -r ${this.workspaceDir}/src/frontend/dist ${backupPath}/frontend-dist`);

      console.log(`[Deployment] Backup created at ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('[Deployment] Backup failed:', error);
      throw new Error('Backup failed');
    }
  }

  /**
   * Build backend
   */
  async buildBackend(): Promise<void> {
    try {
      console.log('[Deployment] Building backend...');
      
      await execAsync(`cd ${this.workspaceDir}/src/backend && npm run build`);
      
      console.log('[Deployment] Backend build completed');
    } catch (error) {
      console.error('[Deployment] Backend build failed:', error);
      throw new Error('Backend build failed');
    }
  }

  /**
   * Build frontend
   */
  async buildFrontend(): Promise<void> {
    try {
      console.log('[Deployment] Building frontend...');
      
      await execAsync(`cd ${this.workspaceDir}/src/frontend && npm run build`);
      
      console.log('[Deployment] Frontend build completed');
    } catch (error) {
      console.error('[Deployment] Frontend build failed:', error);
      throw new Error('Frontend build failed');
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('[Deployment] Running database migrations...');
      
      await execAsync(`cd ${this.workspaceDir}/src/backend && npx prisma migrate deploy`);
      
      console.log('[Deployment] Migrations completed');
    } catch (error) {
      console.error('[Deployment] Migrations failed:', error);
      throw new Error('Migrations failed');
    }
  }

  /**
   * Restart services
   */
  async restartServices(): Promise<void> {
    try {
      console.log('[Deployment] Restarting services...');

      // Restart backend
      await execAsync('pm2 restart lsm-backend || true');
      
      // Restart frontend
      await execAsync('pm2 restart lsm-frontend || true');

      console.log('[Deployment] Services restarted');
    } catch (error) {
      console.error('[Deployment] Service restart failed:', error);
      throw new Error('Service restart failed');
    }
  }

  /**
   * Health check after deployment
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[Deployment] Running health check...');

      // Check backend
      const backendCheck = await execAsync(
        'curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health'
      );
      
      if (backendCheck.stdout.trim() !== '200') {
        throw new Error('Backend health check failed');
      }

      // Check frontend
      const frontendCheck = await execAsync(
        'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000'
      );
      
      if (frontendCheck.stdout.trim() !== '200') {
        throw new Error('Frontend health check failed');
      }

      console.log('[Deployment] Health check passed');
      return true;
    } catch (error) {
      console.error('[Deployment] Health check failed:', error);
      return false;
    }
  }

  /**
   * Rollback to previous version
   */
  async rollback(backupPath: string): Promise<void> {
    try {
      console.log(`[Deployment] Rolling back to ${backupPath}...`);

      // Restore database
      await execAsync(
        `psql -U lsm_admin -h localhost lsm < ${backupPath}/database.sql`
      );

      // Restore environment files
      await execAsync(`cp ${backupPath}/backend.env ${this.workspaceDir}/src/backend/.env`);
      await execAsync(`cp ${backupPath}/frontend.env ${this.workspaceDir}/src/frontend/.env`);

      // Restore builds
      await execAsync(`cp -r ${backupPath}/backend-dist/* ${this.workspaceDir}/src/backend/dist/`);
      await execAsync(`cp -r ${backupPath}/frontend-dist/* ${this.workspaceDir}/src/frontend/dist/`);

      // Restart services
      await this.restartServices();

      console.log('[Deployment] Rollback completed');
    } catch (error) {
      console.error('[Deployment] Rollback failed:', error);
      throw new Error('Rollback failed');
    }
  }

  /**
   * Full deployment process
   */
  async deploy(): Promise<void> {
    let backupPath: string | null = null;

    try {
      console.log('[Deployment] Starting deployment...');

      // Step 1: Create backup
      backupPath = await this.createBackup();

      // Step 2: Build backend
      await this.buildBackend();

      // Step 3: Build frontend
      await this.buildFrontend();

      // Step 4: Run migrations
      await this.runMigrations();

      // Step 5: Restart services
      await this.restartServices();

      // Step 6: Health check
      const healthOk = await this.healthCheck();

      if (!healthOk) {
        throw new Error('Health check failed');
      }

      console.log('[Deployment] Deployment completed successfully');
    } catch (error) {
      console.error('[Deployment] Deployment failed:', error);
      
      // Rollback if backup exists
      if (backupPath) {
        console.log('[Deployment] Initiating rollback...');
        await this.rollback(backupPath);
      }
      
      throw error;
    }
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups(daysToKeep: number = 7): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const files = await fs.promises.readdir(this.backupDir);
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isDirectory() && stats.mtime < cutoffDate) {
          await fs.promises.rm(filePath, { recursive: true, force: true });
          console.log(`[Deployment] Cleaned old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('[Deployment] Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
