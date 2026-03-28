/**
 * Playwright Global Setup
 *
 * Runs ONCE before the entire test suite.
 * Logs in via the backend API (single HTTP call — avoids the 5-req/15-min
 * rate limit that would be hit if each test file did its own browser login),
 * injects the JWT token into a browser context's localStorage so that Zustand's
 * auth store recognises the session, then saves the resulting storageState to
 * .auth/admin.json.
 *
 * The authedPage fixture in fixtures/auth.ts loads this file instead of
 * re-running the full UI login flow on every test.
 *
 * Rate-limit safety: if the auth endpoint returns 429 and an existing
 * (potentially still-valid) storage state file exists, we keep it rather
 * than overwriting it with an empty one.
 */
import { chromium, request as apiRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:8080';
const BASE_URL = 'http://localhost:8081';
const CREDS = { username: 'admin', password: 'Admin123' };

export const AUTH_FILE = path.join(__dirname, '.auth/admin.json');

/** Returns true if the existing storage state file contains actual token data. */
function existingStateHasToken(): boolean {
  if (!fs.existsSync(AUTH_FILE)) return false;
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    // Zustand persists auth-storage inside origins[].localStorage
    return (
      Array.isArray(data.origins) &&
      data.origins.some((o: any) =>
        Array.isArray(o.localStorage) &&
        o.localStorage.some(
          (entry: any) =>
            entry.name === 'auth-storage' &&
            entry.value?.includes('"isAuthenticated":true'),
        ),
      )
    );
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  // Ensure the .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // ── 1. Obtain JWT token via API (no browser, no rate-limit hit) ────────────
  const apiCtx = await apiRequest.newContext();
  const res = await apiCtx.post(`${API_BASE}/api/auth/login`, {
    data: CREDS,
    headers: { Origin: BASE_URL },
  });

  // Read body BEFORE disposing the context (disposing frees the response buffer)
  const statusCode = res.status();
  let body: any = null;
  if (statusCode === 200) {
    body = await res.json();
  }
  await apiCtx.dispose();

  if (statusCode !== 200) {
    if (existingStateHasToken()) {
      console.log(
        `[global-setup] Login returned HTTP ${statusCode} (rate-limited?) — ` +
          'keeping existing storageState which may still be valid.',
      );
    } else {
      console.warn(
        `[global-setup] Login returned HTTP ${statusCode} and no valid ` +
          'existing storage state found — UI authenticated tests will fail.',
      );
      fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    }
    return;
  }
  const token: string = body.data?.token ?? body.token ?? '';
  const user = body.data?.user ?? body.user ?? {
    id: 'admin-id',
    username: 'admin',
    email: 'admin@lsm.local',
    role: 'ADMIN',
  };

  if (!token) {
    console.warn('[global-setup] Token missing in response body — writing empty storage state.');
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  // ── 2. Inject token into a browser context via localStorage ────────────────
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app origin so we can write to its localStorage
  const navOk = await page
    .goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (!navOk) {
    console.warn('[global-setup] Could not reach', BASE_URL, '— storageState may be incomplete.');
  }

  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { token, user, isAuthenticated: true }, version: 0 }),
      );
    },
    { token, user },
  );

  // ── 3. Persist the storage state ───────────────────────────────────────────
  await context.storageState({ path: AUTH_FILE });
  await browser.close();

  // Also persist the raw JWT so API-only spec files can read it without
  // making their own auth requests (which would exhaust the 5-req/15-min limit).
  fs.writeFileSync(
    path.join(__dirname, '.auth/token.json'),
    JSON.stringify({ token }),
  );

  console.log('[global-setup] Auth storage state saved →', AUTH_FILE);
}
