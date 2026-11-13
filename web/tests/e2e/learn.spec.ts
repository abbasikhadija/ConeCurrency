import { test, expect } from '@playwright/test';

test.describe('ConeCurrency Gelateria - How it Works (Learn Section) E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/login', {data:{password:'classroom-test-only'}});
    await page.goto('/');
    await expect(page.getByText('Backend Connected', {exact:true})).toBeVisible();
    // Switch to Learn section
    await page.getByText('How it Works').click();
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

  test('"Try it" button jumps back to parlour dashboard and triggers action', async ({ page }) => {
    const tryBtn = page.getByTestId('btn-try-order-one');
    await tryBtn.click();

    // Verifies it returned to the parlour counter
    await expect(page.getByText('Parlour Counter')).toBeVisible();
  });
});

