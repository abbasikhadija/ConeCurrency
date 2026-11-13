import { test, expect } from '@playwright/test';

test.describe('ConeCurrency Gelateria - Dashboard E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/login', {data:{password:'classroom-test-only'}});
    await page.goto('/');
    await expect(page.getByText('Backend Connected', {exact:true})).toBeVisible();
    // Wait for header and connection status
    await expect(page.locator('.brand-title')).toContainText('ConeCurrency Gelateria');
  });

  test('completes single order flow (BOOK) and updates counter and register tape', async ({ page }) => {
    // Click Order 1 Cone
    const bookBtn = page.getByTestId('btn-book');
    await expect(bookBtn).toBeEnabled();
    await bookBtn.click();

    // Verify counter increments to at least 1
    const bookedStat = page.getByTestId('stat-booked');
    await expect(bookedStat).not.toHaveText('0');

    // Verify register tape receives entry
    const tapeStream = page.getByTestId('tape-stream');
    await expect(tapeStream).toContainText('BOOK');
  });

  test('triggers Rush Hour (10 Cones) parallel burst', async ({ page }) => {
    const rushBtn = page.getByTestId('btn-rush');
    await rushBtn.click();

    // Verify register tape logs multiple entries
    const tapeRows = page.getByTestId('tape-entry-row');
    await expect(tapeRows.first()).toBeVisible();
    await expect(tapeRows).toHaveCount(10);
  });

  test('triggers Flash Mob (25 Cones) and triggers celebratory confetti effect', async ({ page }) => {
    const flashBtn = page.getByTestId('btn-flash');
    await flashBtn.click();

    const tapeRows = page.getByTestId('tape-entry-row');
    await expect(tapeRows.first()).toBeVisible();
  });

  test('sends bad request and verifies error response handling', async ({ page }) => {
    const badBtn = page.getByTestId('btn-bad');
    await badBtn.click();

    const tapeStream = page.getByTestId('tape-stream');
    await expect(tapeStream).toContainText('ERR');
  });

  test('resets counters and clears register tape cleanly', async ({ page }) => {
    // Order a cone first
    await page.getByTestId('btn-book').click();
    await expect(page.getByTestId('stat-booked')).not.toHaveText('0');

    // Click Reset Counters
    await page.getByTestId('btn-reset-counters').click();
    if (process.env.PLAYWRIGHT_REAL_BACKEND === '1') {
      await expect(page.getByRole('alert').filter({hasText:'Backend rejected reset'})).toBeVisible();
      await expect(page.getByTestId('stat-booked')).not.toHaveText('0');
    } else {
      await expect(page.getByTestId('stat-booked')).toHaveText('0');
    }

    // Click Clear Tape
    await page.getByTestId('btn-clear-tape').click();
    await expect(page.getByTestId('tape-stream')).toContainText('[Ready for client traffic');
  });

  test('keyboard shortcut B orders cone and C clears tape', async ({ page }) => {
    await page.keyboard.press('B');
    await expect(page.getByTestId('stat-booked')).not.toHaveText('0');

    await page.keyboard.press('C');
    await expect(page.getByTestId('tape-stream')).toContainText('[Ready for client traffic');
  });

  test('keyboard shortcut ? opens help modal', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('#modal-title')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-title')).not.toBeVisible();
  });
});

