import { test, expect } from '@playwright/test';

// How it works is a customer page (☰ Menu → How it works); the admin dashboard shows the parlour only.
test.describe('ConeCurrency - How it works (customer page) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', {name: '☰ Menu'}).click();
    await page.getByRole('menuitem', {name: 'How it works'}).click();
    await expect(page.getByRole('heading', {name: 'How the parlour works 🍦'})).toBeVisible();
  });

  test('displays all 8 OS concept articles with code snippets and diagrams', async ({ page }) => {
    await expect(page.locator('#order-one')).toBeVisible();
    await expect(page.locator('#rush-hour')).toBeVisible();
    await expect(page.locator('#sold-out')).toBeVisible();
    await expect(page.locator('#queue-shed')).toBeVisible();
    await expect(page.locator('#bad-request')).toBeVisible();
    await expect(page.locator('#avg-latency')).toBeVisible();
    await expect(page.locator('#reset-counters')).toBeVisible();
    await expect(page.locator('#register-tape')).toBeVisible();
  });

  test('collapses and expands article body upon click', async ({ page }) => {
    const articleHeader = page.locator('#order-one .article-header');
    await articleHeader.click();
    await expect(page.locator('#order-one .article-body')).not.toBeVisible();

    await articleHeader.click();
    await expect(page.locator('#order-one .article-body')).toBeVisible();
  });

  test('customers get read-only articles without dashboard "try it" buttons', async ({ page }) => {
    await expect(page.getByTestId('btn-try-order-one')).toHaveCount(0);
    await page.getByRole('button', {name: 'Back to the shop'}).click();
    await expect(page.getByRole('heading', {name: 'Welcome to ConeCurrency 🍦'})).toBeVisible();
  });
});
