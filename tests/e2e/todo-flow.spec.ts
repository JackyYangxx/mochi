import { test, expect } from '@playwright/test';

test.describe('Todo Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
  });

  test('app renders without errors', async ({ page }) => {
    // Check that the app container exists
    const container = page.locator('.app-container');
    await expect(container).toBeVisible();

    // Check pet view exists
    const petView = page.locator('.pet-view');
    await expect(petView).toBeVisible();
  });

  test('clicking pet opens input modal', async ({ page }) => {
    const petView = page.locator('.pet-view');
    await petView.click();

    const inputModal = page.locator('.input-modal');
    await expect(inputModal).toBeVisible();
  });

  test('can add a todo item', async ({ page }) => {
    // Open input modal
    const petView = page.locator('.pet-view');
    await petView.click();

    // Type todo content
    const input = page.locator('.input-modal-input');
    await input.fill('Test todo item');

    // Press Enter to submit
    await input.press('Enter');

    // Check todo appears in list
    const todoItem = page.locator('.todo-item');
    await expect(todoItem).toBeVisible();
  });

  test('can toggle todo completion', async ({ page }) => {
    // Add a todo first
    const petView = page.locator('.pet-view');
    await petView.click();
    const input = page.locator('.input-modal-input');
    await input.fill('Toggle test');
    await input.press('Enter');

    // Wait for todo to appear
    await page.waitForSelector('.todo-item');

    // Click checkbox to toggle
    const checkbox = page.locator('.todo-checkbox').first();
    await checkbox.click();

    // Check todo is completed
    const completedTodo = page.locator('.todo-item.completed');
    await expect(completedTodo).toBeVisible();
  });

  test('can delete a todo item', async ({ page }) => {
    // Add a todo
    const petView = page.locator('.pet-view');
    await petView.click();
    const input = page.locator('.input-modal-input');
    await input.fill('Delete test');
    await input.press('Enter');

    // Wait for todo
    await page.waitForSelector('.todo-item');

    // Hover and click delete
    const todoItem = page.locator('.todo-item').first();
    await todoItem.hover();
    const deleteBtn = page.locator('.todo-delete').first();
    await deleteBtn.click();

    // Verify todo is removed
    await expect(page.locator('.todo-item')).toHaveCount(0);
  });

  test('search filters todo list', async ({ page }) => {
    // Add multiple todos
    const petView = page.locator('.pet-view');
    await petView.click();
    await page.locator('.input-modal-input').fill('Apple todo');
    await page.locator('.input-modal-input').press('Enter');

    await petView.click();
    await page.locator('.input-modal-input').fill('Banana todo');
    await page.locator('.input-modal-input').press('Enter');

    // Search for one
    const searchInput = page.locator('.todo-search-input');
    await searchInput.fill('Apple');

    // Only matching todo should show
    const todos = page.locator('.todo-item');
    await expect(todos).toHaveCount(1);
  });
});
