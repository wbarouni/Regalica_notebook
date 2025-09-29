import { test, expect } from '@playwright/test';

test('homepage loads and displays correct content', async ({ page }) => {
  await page.goto('/');

  // Vérifier que la page se charge
  await expect(page).toHaveTitle(/Regalica Notebook JS/);

  // Vérifier que le texte requis est présent
  await expect(page.locator('h1')).toContainText('Regalica Notebook JS – Skeleton OK');

  // Vérifier que les éléments principaux sont présents
  await expect(page.locator('text=Application de notebook intelligent')).toBeVisible();
  
  // Vérifier les trois sections principales
  await expect(page.locator('text=Notebooks')).toBeVisible();
  await expect(page.locator('text=IA Intégrée')).toBeVisible();
  await expect(page.locator('text=Base de Données')).toBeVisible();
});

test('page is responsive', async ({ page }) => {
  await page.goto('/');
  
  // Test desktop
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.locator('h1')).toBeVisible();
  
  // Test mobile
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.locator('h1')).toBeVisible();
});
