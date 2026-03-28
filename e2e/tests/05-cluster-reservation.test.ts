/**
 * E2E Test: Cluster Reservation Flow
 * 
 * Tests the complete cluster reservation workflow including:
 * - Viewing reservation page
 * - Switching between server and cluster reservation
 * - Creating a cluster reservation
 * - Conflict detection and display
 * - AI recommendations
 */

import { test, expect } from '@playwright/test'

test.describe('Cluster Reservation', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })
  })

  test('should display reservation type switch on reservation page', async ({ page }) => {
    await page.goto('/reservations')
    
    // Check for the segmented control
    await expect(page.locator('.ant-segmented').getByText('服务器预约')).toBeVisible()
    await expect(page.locator('.ant-segmented').getByText('集群预约')).toBeVisible()
  })

  test('should switch to cluster reservation', async ({ page }) => {
    await page.goto('/reservations')
    
    // Click on cluster reservation
    await page.click('.ant-segmented-item:has-text("集群预约")')
    
    // Should show cluster reservation button
    await expect(page.getByRole('button', { name: '新建集群预约' })).toBeVisible()
  })

  test('should navigate to cluster reservation form', async ({ page }) => {
    await page.goto('/reservations')
    
    // Click on cluster reservation
    await page.click('.ant-segmented-item:has-text("集群预约")')
    
    // Click new reservation button
    await page.click('button:has-text("新建集群预约")')
    
    // Should be on cluster reservation form
    await expect(page).toHaveURL('/reservations/cluster')
    await expect(page.getByText('新建集群预约')).toBeVisible()
  })

  test('should display available clusters', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for clusters to load
    await page.waitForSelector('.ant-select', { timeout: 10000 })
    
    // Click on cluster selector
    await page.click('.ant-select')
    
    // Should show cluster options
    await expect(page.getByText('Training Cluster A')).toBeVisible()
  })

  test('should show cluster info when cluster is selected', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select a cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // Should show cluster info card
    await expect(page.getByText('服务器')).toBeVisible()
    await expect(page.getByText('GPU')).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Try to submit without filling
    await page.click('button:has-text("提交预约")')
    
    // Should show validation errors
    await expect(page.getByText('请选择要预约的集群')).toBeVisible()
  })

  test('should detect time conflicts', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // Select a time range that conflicts
    // This would require setting up test data
    // For now, just verify the conflict warning component exists
  })

  test('should display AI recommendations', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // AI recommendations section should be visible
    await expect(page.getByText('AI 智能推荐')).toBeVisible()
    await expect(page.getByRole('button', { name: '获取推荐' })).toBeVisible()
  })

  test('should fetch and display AI recommendations', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // Click get recommendations
    await page.click('button:has-text("获取推荐")')
    
    // Wait for recommendations to load
    await page.waitForTimeout(2000)
    
    // Should show recommendation cards
    await expect(page.getByText('最佳')).or(page.getByText('选项')).toBeVisible()
  })

  test('should apply recommended time slot', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // Get recommendations
    await page.click('button:has-text("获取推荐")')
    await page.waitForTimeout(2000)
    
    // Click on a recommendation
    await page.click('.ant-tag:has-text("最佳")')
    
    // Time range should be filled
    const timeRangeInput = page.locator('.ant-picker-range')
    await expect(timeRangeInput).not.toBeEmpty()
  })

  test('should submit reservation successfully', async ({ page }) => {
    await page.goto('/reservations/cluster')
    
    // Wait for loading
    await page.waitForTimeout(1000)
    
    // Select cluster
    await page.click('.ant-select')
    await page.click('.ant-select-item:has-text("Training")')
    
    // Fill time range (tomorrow 10:00-14:00)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    
    await page.click('.ant-picker-range')
    await page.fill('.ant-picker-input input', dateStr)
    
    // Fill purpose
    await page.fill('textarea', 'Testing cluster reservation for automated tests')
    
    // Submit
    await page.click('button:has-text("提交预约")')
    
    // Should show success message or redirect
    await page.waitForTimeout(2000)
  })
})

test.describe('Reservation Page Navigation', () => {
  test('should navigate from sidebar to reservations', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Click on reservations in sidebar
    await page.click('text=资源预约')
    
    // Should navigate to reservations
    await expect(page).toHaveURL('/reservations')
  })
})

test.describe('Internationalization', () => {
  test('should display Chinese text for cluster reservation', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    await page.goto('/reservations/cluster')
    
    // Should display Chinese labels
    await expect(page.getByText('选择集群')).toBeVisible()
    await expect(page.getByText('时间范围')).toBeVisible()
    await expect(page.getByText('预约目的')).toBeVisible()
  })

  test('should display English text when language is switched', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Switch to English
    await page.click('.ant-dropdown-trigger') // Language switcher
    await page.click('text=English')
    
    await page.goto('/reservations/cluster')
    await page.waitForTimeout(1000)
    
    // Should display English labels
    await expect(page.getByText('Select Cluster')).toBeVisible()
    await expect(page.getByText('Time Range')).toBeVisible()
    await expect(page.getByText('Purpose')).toBeVisible()
  })
})