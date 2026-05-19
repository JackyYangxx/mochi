import { test, expect } from '@playwright/test';

test.describe('Todo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('adds a todo via pet click', async ({ page }) => {
    // Click the pet to open input modal
    await page.click('[data-testid="pet-view"]');

    // Input modal should appear
    await expect(page.locator('.todo-input')).toBeVisible();

    // Type a todo
    await page.fill('.todo-input', 'Buy groceries');
    await page.press('.todo-input', 'Enter');

    // Modal should close and todo should appear in list
    await expect(page.locator('.todo-input')).not.toBeVisible();
    await expect(page.getByText('Buy groceries')).toBeVisible();
  });

  test('toggles todo completion', async ({ page }) => {
    // Add a todo first
    await page.click('[data-testid="pet-view"]');
    await page.fill('.todo-input', 'Test task');
    await page.press('.todo-input', 'Enter');

    // Click the checkbox to complete
    await page.click('.todo-checkbox');

    // Should show completed state
    await expect(page.locator('.todo-item.completed')).toBeVisible();
  });

  test('deletes a todo', async ({ page }) => {
    // Add a todo
    await page.click('[data-testid="pet-view"]');
    await page.fill('.todo-input', 'To delete');
    await page.press('.todo-input', 'Enter');

    // Hover and click delete
    await page.hover('.todo-item');
    await page.click('.todo-delete');

    // Todo should be removed
    await expect(page.getByText('To delete')).not.toBeVisible();
  });

  test('search filters todos', async ({ page }) => {
    // Add multiple todos
    await page.click('[data-testid="pet-view"]');
    await page.fill('.todo-input', 'Apple');
    await page.press('.todo-input', 'Enter');

    await page.click('[data-testid="pet-view"]');
    await page.fill('.todo-input', 'Banana');
    await page.press('.todo-input', 'Enter');

    // Search for Apple
    await page.fill('.search-input', 'Apple');

    // Should only show Apple
    await expect(page.getByText('Apple')).toBeVisible();
    await expect(page.getByText('Banana')).not.toBeVisible();
  });
});