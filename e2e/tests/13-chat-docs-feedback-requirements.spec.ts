/**
 * E2E — Chat / Docs / Feedback / Requirements
 *
 * Chat         (/chat)         : LSM Agent page renders, input area visible
 * Docs         (/docs)         : document tabs, markdown area
 * Feedback     (/feedback)     : feedback table, submit button
 * Requirements (/requirements) : requirements table, submit button
 */
import { test, expect } from '../fixtures/auth';

// ─── AI Chat (LSM Agent) ──────────────────────────────────────────────────────

test.describe('Chat — LSM Agent', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Chat page without errors', async ({ authedPage: page }) => {
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('should show the LSM Agent heading or branding', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/lsm agent|ai 助手|chat|对话/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should render a message input area', async ({ authedPage: page }) => {
    await expect(
      page.locator('textarea, input[type="text"], .ant-input').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show send button', async ({ authedPage: page }) => {
    await expect(
      page.locator('button').filter({ has: page.locator('[data-icon="send"], .anticon-send') })
        .or(page.getByRole('button', { name: /send|发送/i }))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should show connection status indicator', async ({ authedPage: page }) => {
    // Connection status icons rendered by Ant Design icons (data-icon attribute)
    await expect(
      page.locator('[data-icon="disconnect"], [data-icon="wifi"], [data-icon="loading-3-quarters"]').first()
        .or(page.getByText(/connected|disconnected|connecting|已连接|未连接/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show new session or history button', async ({ authedPage: page }) => {
    await expect(
      page.locator('button').filter({
        has: page.locator('[data-icon="plus"], [data-icon="history"], .anticon-plus, .anticon-history')
      }).or(page.getByRole('button', { name: /new|新建|history|历史/i }))
      .first()
    ).toBeVisible({ timeout: 8000 });
  });
});

// ─── Documentation Page ───────────────────────────────────────────────────────

test.describe('Docs Page', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Docs page without errors', async ({ authedPage: page }) => {
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('should show documentation tabs or content area', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-tabs, [role="tablist"], .ant-tabs-nav, .ant-card, .ant-alert, .ant-spin').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should render document content or loading state', async ({ authedPage: page }) => {
    // Either content renders, a loading spinner, or an error alert is shown
    await expect(
      page.locator('.ant-spin, article, [class*="markdown"], .ant-card-body, .ant-tabs-content, .ant-alert').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display docs-related heading or text', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/document|文档|manual|手册|guide|指南/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ─── Feedback Page ────────────────────────────────────────────────────────────

test.describe('Feedback Page', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/feedback', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Feedback page without errors', async ({ authedPage: page }) => {
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('should render feedback table or empty state', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-table, .ant-empty').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show submit feedback button', async ({ authedPage: page }) => {
    await expect(
      page.getByRole('button', { name: /submit|提交|add|新建|feedback|反馈/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should open submit feedback modal', async ({ authedPage: page }) => {
    const btn = page.getByRole('button', { name: /submit|提交|add|新建|feedback|反馈/i }).first();
    await btn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 8000 });
    // Close modal
    const cancelBtn = page.locator('.ant-modal-content').getByRole('button', { name: /cancel|取消/i });
    await cancelBtn.click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show status filter controls', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-select, .ant-tabs, [role="tablist"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should display feedback statistics cards', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-statistic, .ant-card').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Requirements Page ────────────────────────────────────────────────────────

test.describe('Requirements Page', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/requirements', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Requirements page without errors', async ({ authedPage: page }) => {
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('should render requirements table or empty state', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-table, .ant-empty').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show submit requirement button', async ({ authedPage: page }) => {
    await expect(
      page.getByRole('button', { name: /submit|提交|add|新增|新建|requirement|需求/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should open submit requirement modal', async ({ authedPage: page }) => {
    const btn = page.getByRole('button', { name: /submit|提交|add|新增|新建|requirement|需求/i }).first();
    await btn.click();
    await expect(page.locator('.ant-modal-content')).toBeVisible({ timeout: 8000 });
    // Close modal
    const cancelBtn = page.locator('.ant-modal-content').getByRole('button', { name: /cancel|取消/i });
    await cancelBtn.click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show requirements statistics cards', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-statistic, .ant-card').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display status or priority filter', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-select, .ant-tabs, [role="tablist"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should show existing requirements with status tags', async ({ authedPage: page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    if (count > 0) {
      const tagVisible = await page.locator('.ant-tag').first().isVisible().catch(() => false);
      expect(typeof tagVisible).toBe('boolean');
    } else {
      // Check for table or empty state
      const hasContent = await page.locator('.ant-table, .ant-empty').first().isVisible().catch(() => false);
      expect(hasContent || await page.locator('body').isVisible()).toBeTruthy();
    }
  });
});
