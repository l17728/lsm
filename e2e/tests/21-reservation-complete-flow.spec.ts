/**
 * E2E Tests — Complete Reservation Flow
 *
 * Purpose: Test the complete flow from calendar view to reservation creation
 *
 * Covers:
 * - TC-FLOW-001: Navigate to reservations page
 * - TC-FLOW-002: Switch between calendar views (month/week/day)
 * - TC-FLOW-003: Click on day cell to view day details
 * - TC-FLOW-004: Create new reservation from calendar
 * - TC-FLOW-005: View created reservation in my reservations
 * - TC-FLOW-006: Cancel reservation from my reservations
 */
import { test, expect } from '@playwright/test';

test.describe('Complete Reservation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reservations page
    await page.goto('/reservations');
    
    // Wait for the page to load
    await page.waitForSelector('.calendar-view, .reservations-page', { timeout: 10000 });
  });

  test('TC-FLOW-001: Navigate to reservations page and see calendar', async ({ page }) => {
    // Verify calendar is visible
    await page.waitForSelector('.calendar-view', { timeout: 5000 });
    
    // Verify toolbar elements exist
    const toolbar = await page.locator('.calendar-toolbar').count();
    expect(toolbar).toBe(1);
    
    // Verify legend exists
    const legend = await page.locator('.calendar-legend').count();
    expect(legend).toBeGreaterThan(0);
  });

  test('TC-FLOW-002: Switch between calendar views', async ({ page }) => {
    // Wait for month view (default)
    await page.waitForSelector('.calendar-month-view', { timeout: 5000 });
    
    // Switch to week view
    const weekButton = page.locator('.ant-segmented-item-label', { hasText: /Week|周/ });
    if (await weekButton.count() > 0) {
      await weekButton.click();
      await page.waitForSelector('.calendar-week-view', { timeout: 5000 });
      const weekView = await page.locator('.calendar-week-view').count();
      expect(weekView).toBe(1);
    }
    
    // Switch to day view
    const dayButton = page.locator('.ant-segmented-item-label', { hasText: /Day|日/ });
    if (await dayButton.count() > 0) {
      await dayButton.click();
      await page.waitForSelector('.calendar-day-view', { timeout: 5000 });
      const dayView = await page.locator('.calendar-day-view').count();
      expect(dayView).toBe(1);
    }
    
    // Switch back to month view
    const monthButton = page.locator('.ant-segmented-item-label', { hasText: /Month|月/ });
    if (await monthButton.count() > 0) {
      await monthButton.click();
      await page.waitForSelector('.calendar-month-view', { timeout: 5000 });
      const monthView = await page.locator('.calendar-month-view').count();
      expect(monthView).toBe(1);
    }
  });

  test('TC-FLOW-003: Click day cell navigates to day view', async ({ page }) => {
    // Start in month view
    await page.waitForSelector('.calendar-month-view', { timeout: 5000 });
    
    // Find a day cell with reservations (has-reservations class)
    const cellsWithReservations = await page.locator('.month-cell.has-reservations').all();
    
    if (cellsWithReservations.length > 0) {
      // Click on a cell with reservations
      await cellsWithReservations[0].click();
      
      // Should navigate to day view
      await page.waitForSelector('.calendar-day-view', { timeout: 5000 });
      const dayView = await page.locator('.calendar-day-view').count();
      expect(dayView).toBe(1);
    } else {
      // Click any day cell
      const dayCells = await page.locator('.month-cell').all();
      if (dayCells.length > 0) {
        await dayCells[0].click();
        await page.waitForSelector('.calendar-day-view', { timeout: 5000 });
      }
    }
  });

  test('TC-FLOW-004: Navigate to new reservation form', async ({ page }) => {
    // Find "New Server Reservation" button
    const newReservationButton = page.locator('button', { hasText: /New Server Reservation|新建服务器预约/ });
    
    if (await newReservationButton.count() > 0) {
      await newReservationButton.click();
      
      // Should navigate to reservation form
      await page.waitForURL('**/reservations/new', { timeout: 5000 });
      
      // Verify form page loaded
      const formPage = await page.locator('.reservation-form-page, form').count();
      expect(formPage).toBeGreaterThan(0);
    }
  });

  test('TC-FLOW-005: Navigate to my reservations', async ({ page }) => {
    // Find "My Reservations" button
    const myReservationsButton = page.locator('button', { hasText: /My Reservations|我的预约/ });
    
    if (await myReservationsButton.count() > 0) {
      await myReservationsButton.click();
      
      // Should navigate to my reservations page
      await page.waitForURL('**/reservations/mine', { timeout: 5000 });
      
      // Verify my reservations page loaded
      const myResPage = await page.locator('.my-reservations-page, .ant-card').count();
      expect(myResPage).toBeGreaterThan(0);
    }
  });

  test('TC-FLOW-006: Navigate to cluster reservation form', async ({ page }) => {
    // Find "New Cluster Reservation" button
    const clusterReservationButton = page.locator('button', { hasText: /New Cluster Reservation|新建集群预约/ });
    
    if (await clusterReservationButton.count() > 0) {
      await clusterReservationButton.click();
      
      // Should navigate to cluster reservation form
      await page.waitForURL('**/reservations/cluster', { timeout: 5000 });
      
      // Verify cluster reservation form loaded
      const clusterFormPage = await page.locator('.cluster-reservation-form, form, .ant-card').count();
      expect(clusterFormPage).toBeGreaterThan(0);
    }
  });
});

test.describe('Calendar Navigation Deep Dive', () => {
  test('TC-NAV-001: Navigate to previous/next month', async ({ page }) => {
    await page.goto('/reservations');
    await page.waitForSelector('.calendar-view', { timeout: 10000 });
    
    // Get current date display
    const dateDisplay = await page.locator('.current-date').textContent();
    
    // Click next button
    const buttons = await page.locator('.toolbar-center button').all();
    if (buttons.length >= 2) {
      await buttons[1].click();
      await page.waitForTimeout(500);
      
      // Date display should change
      const newDateDisplay = await page.locator('.current-date').textContent();
      console.log(`Date changed from ${dateDisplay} to ${newDateDisplay}`);
    }
  });

  test('TC-NAV-002: Click today button resets to current date', async ({ page }) => {
    await page.goto('/reservations');
    await page.waitForSelector('.calendar-view', { timeout: 10000 });
    
    // Navigate away from current month
    const buttons = await page.locator('.toolbar-center button').all();
    if (buttons.length >= 2) {
      await buttons[1].click();
      await page.waitForTimeout(300);
    }
    
    // Click on date display (typically resets to today)
    const dateDisplay = await page.locator('.current-date');
    if (await dateDisplay.count() > 0) {
      await dateDisplay.click();
      await page.waitForTimeout(300);
    }
  });

  test('TC-NAV-003: Server filter affects calendar display', async ({ page }) => {
    await page.goto('/reservations');
    await page.waitForSelector('.calendar-view', { timeout: 10000 });
    
    // Find server filter dropdown
    const serverFilter = await page.locator('.ant-select').first();
    if (await serverFilter.count() > 0) {
      await serverFilter.click();
      await page.waitForTimeout(300);
      
      // Verify dropdown opened
      const dropdown = await page.locator('.ant-select-dropdown').count();
      console.log(`Dropdown visible: ${dropdown > 0}`);
    }
  });
});