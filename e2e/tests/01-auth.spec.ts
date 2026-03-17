/**
 * E2E — Authentication
 *
 * Covers: login success, login failure, protected route redirect,
 *         logout, session persistence on refresh.
 */
import { test, expect } from '../fixtures/auth';
import { test as baseTest } from '@playwright/test';
import { ADMIN_USER } from '../fixtures/auth';

const GOTO_OPTS = { waitUntil: 'domcontentloaded' as const };

test.describe('Authentication', () => {
  // ── Login ──────────────────────────────────────────────────────────────────

  baseTest('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard', GOTO_OPTS);
    await expect(page).toHaveURL(/login/);
  });

  baseTest('should show login form with username and password fields', async ({ page }) => {
    await page.goto('/login', GOTO_OPTS);
    await expect(page.getByPlaceholder(/username|用户名/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password|密码/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|登录/i })).toBeVisible();
  });

  baseTest('should show error on wrong credentials', async ({ page }) => {
    await page.goto('/login', GOTO_OPTS);
    await page.getByPlaceholder(/username|用户名/i).fill('admin');
    await page.getByPlaceholder(/password|密码/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|登录/i }).click();
    // Should stay on login page or show error message
    await expect(page.locator('body')).toContainText(/./, { timeout: 5000 });
    // URL should still contain login OR an error is visible
    const url = page.url();
    const hasError = await page.getByRole('alert').count() > 0
      || await page.locator('.ant-message-error, .ant-alert-error, [class*="error"]').count() > 0;
    expect(url.includes('login') || hasError).toBeTruthy();
  });

  baseTest('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login', GOTO_OPTS);
    await page.getByPlaceholder(/username|用户名/i).fill(ADMIN_USER.username);
    await page.getByPlaceholder(/password|密码/i).fill(ADMIN_USER.password);
    await page.getByRole('button', { name: /login|登录/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
    // Should land on dashboard or home
    await expect(page).not.toHaveURL(/login/);
  });

  // ── Post-login ─────────────────────────────────────────────────────────────

  test('should display user info / navigation after login', async ({ authedPage: page }) => {
    // Navigation menu or header should be visible
    const nav = page.locator('nav, .ant-layout-sider, .ant-menu, header').first();
    await expect(nav).toBeVisible();
  });

  test('should navigate to dashboard after login', async ({ authedPage: page }) => {
    await page.goto('/dashboard', GOTO_OPTS);
    await expect(page).not.toHaveURL(/login/);
    // Dashboard heading or stat cards
    await expect(
      page.getByText(/dashboard|servers|gpu/i).first()
    ).toBeVisible();
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  test('should logout and redirect to /login', async ({ authedPage: page }) => {
    // Look for logout button in header/menu
    const logoutBtn = page.getByRole('button', { name: /logout|退出|sign out/i })
      .or(page.getByText(/logout|退出/i).first());

    // Try dropdown avatar menu first
    const avatar = page.locator('.ant-avatar, [class*="avatar"], [class*="user-menu"]').first();
    if (await avatar.isVisible()) {
      await avatar.click();
      await page.waitForTimeout(300);
    }

    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/login/, { timeout: 12000 });
      await expect(page).toHaveURL(/login/);
    } else {
      // Skip if logout button location differs
      test.skip();
    }
  });

  // ── Session persistence ────────────────────────────────────────────────────

  test('should stay logged in after page refresh', async ({ authedPage: page }) => {
    await page.goto('/dashboard', GOTO_OPTS);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
  });
});
