import { test as base, Page, expect } from '@playwright/test';
import * as path from 'path';

// ── Shared credentials ────────────────────────────────────────────────────────
export const ADMIN_USER = { username: 'admin', password: 'Admin123' };
export const BASE_URL   = 'http://localhost:8081';

// Path to the storageState file written by global-setup.ts
export const AUTH_FILE  = path.join(__dirname, '../.auth/admin.json');

// ── Login helper ──────────────────────────────────────────────────────────────
// Kept as a fallback; not used by the authedPage fixture (which injects the
// pre-authenticated storageState instead of going through the UI login flow).
export async function login(page: Page, username = ADMIN_USER.username, password = ADMIN_USER.password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/username|用户名/i).fill(username);
  await page.getByPlaceholder(/password|密码/i).fill(password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
}

// ── Custom fixture: authenticated page ────────────────────────────────────────
// Creates a fresh browser context pre-loaded with the JWT token that globalSetup
// saved to .auth/admin.json — bypasses the UI login flow entirely, which:
//   • avoids the auth rate-limit (5 req / 15 min on the backend)
//   • avoids the slow Vite dev-server SPA boot timeout in headless Chromium
type LSMFixtures = { authedPage: Page };

export const test = base.extend<LSMFixtures>({
  authedPage: async ({ browser }, use) => {
    // Load the pre-authenticated storage state from global-setup
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    // Navigate to the app so React reads the auth token from localStorage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await use(page);
    await context.close();
  },
});

export { expect };
