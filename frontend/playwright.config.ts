import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour les tests E2E
 * Tests selon spécifications strictes : Upload → Chat → Citations → Viewer → Magic Studio
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Timeout global pour les tests */
  timeout: 60000,
  
  /* Timeout pour les assertions */
  expect: {
    timeout: 10000
  },
  
  /* Parallélisation des tests */
  fullyParallel: true,
  
  /* Échec si des tests sont marqués comme .only */
  forbidOnly: !!process.env.CI,
  
  /* Retry en cas d'échec */
  retries: process.env.CI ? 2 : 0,
  
  /* Nombre de workers */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  /* Configuration globale */
  use: {
    /* URL de base */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4200',
    
    /* Trace en cas d'échec */
    trace: 'on-first-retry',
    
    /* Screenshots */
    screenshot: 'only-on-failure',
    
    /* Vidéo */
    video: 'retain-on-failure',
    
    /* Timeout pour les actions */
    actionTimeout: 15000,
    
    /* Timeout pour la navigation */
    navigationTimeout: 30000
  },

  /* Configuration des projets */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    /* Tests mobiles */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Serveur de développement */
  webServer: process.env.CI ? undefined : {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
});
