import { test as base, Page, expect } from '@playwright/test';

// ── Shared credentials ────────────────────────────────────────────────────────
export const ADMIN_USER = { username: 'admin', password: 'admin123' };
export const BASE_URL   = 'http://111.229.248.91:8081';

// ── Login helper ──────────────────────────────────────────────────────────────
export async function login(page: Page, username = ADMIN_USER.username, password = ADMIN_USER.password) {
  // Use domcontentloaded to avoid blocking on Vite HMR WebSocket / module graph
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/username|用户名/i).fill(username);
  await page.getByPlaceholder(/password|密码/i).fill(password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  // Wait until redirected away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
}

// ── Custom fixture: authenticated page ────────────────────────────────────────
type LSMFixtures = { authedPage: Page };

export const test = base.extend<LSMFixtures>({
  authedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
