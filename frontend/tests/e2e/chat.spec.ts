import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Basculer vers l'onglet Chat
    await page.click('[data-testid="chat-tab"]');
    await expect(page.locator('[data-testid="chat-module"]')).toBeVisible();
  });

  test('should display chat interface correctly', async ({ page }) => {
    // Vérifier la présence des éléments principaux
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="messages-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="query-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-btn"]')).toBeVisible();
    
    // Vérifier le message de bienvenue
    await expect(page.locator('text=Bienvenue dans l\'assistant IA')).toBeVisible();
    
    // Vérifier les questions d'exemple
    const exampleButtons = page.locator('[data-testid="example-question"]');
    await expect(exampleButtons).toHaveCount(4);
  });

  test('should use example question', async ({ page }) => {
    // Cliquer sur une question d'exemple
    const firstExample = page.locator('[data-testid="example-question"]').first();
    const exampleText = await firstExample.textContent();
    
    await firstExample.click();
    
    // Vérifier que la question est dans le champ de saisie
    const input = page.locator('[data-testid="query-input"]');
    await expect(input).toHaveValue(exampleText || '');
  });

  test('should handle empty query submission', async ({ page }) => {
    // Essayer d'envoyer une requête vide
    const sendBtn = page.locator('[data-testid="send-btn"]');
    await expect(sendBtn).toBeDisabled();
    
    // Vérifier que le bouton reste désactivé avec des espaces
    await page.fill('[data-testid="query-input"]', '   ');
    await expect(sendBtn).toBeDisabled();
  });

  test('should enable send button with valid query', async ({ page }) => {
    const input = page.locator('[data-testid="query-input"]');
    const sendBtn = page.locator('[data-testid="send-btn"]');
    
    // Le bouton doit être désactivé initialement
    await expect(sendBtn).toBeDisabled();
    
    // Taper une question
    await input.fill('Test question');
    
    // Le bouton doit être activé
    await expect(sendBtn).toBeEnabled();
  });

  test('should send query with Enter key', async ({ page }) => {
    const input = page.locator('[data-testid="query-input"]');
    
    // Taper une question et appuyer sur Entrée
    await input.fill('Test question avec Entrée');
    await input.press('Enter');
    
    // Vérifier que le champ est vidé après envoi
    await expect(input).toHaveValue('');
    
    // Vérifier qu'un message utilisateur apparaît
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible();
  });

  test('should not send query with Shift+Enter', async ({ page }) => {
    const input = page.locator('[data-testid="query-input"]');
    
    // Taper une question et appuyer sur Shift+Entrée
    await input.fill('Test question');
    await input.press('Shift+Enter');
    
    // Le champ ne doit pas être vidé (pas d'envoi)
    await expect(input).toHaveValue('Test question\n');
  });

  test('should display loading state during query processing', async ({ page }) => {
    // Intercepter les requêtes API pour simuler un délai
    await page.route('**/rag/answer', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'test',
          lang: 'fr',
          answer: 'Réponse de test',
          sources: [],
          confidence: 0.8,
          stats: {
            total_processing_time_ms: 1000,
            lang_detected: 'fr'
          }
        })
      });
    });
    
    const input = page.locator('[data-testid="query-input"]');
    const sendBtn = page.locator('[data-testid="send-btn"]');
    
    // Envoyer une question
    await input.fill('Test question');
    await sendBtn.click();
    
    // Vérifier l'état de chargement
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(sendBtn).toBeDisabled();
    await expect(input).toBeDisabled();
    
    // Attendre la fin du chargement
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 5000 });
    await expect(sendBtn).toBeEnabled();
    await expect(input).toBeEnabled();
  });

  test('should display chat messages correctly', async ({ page }) => {
    // Intercepter la requête API
    await page.route('**/rag/answer', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'test question',
          lang: 'fr',
          answer: 'Voici une réponse de test avec des [Document Test#1:0-100] citations.',
          sources: [
            {
              title: 'Document Test',
              page: '1',
              span: '0-100',
              citation: '[Document Test#1:0-100]'
            }
          ],
          confidence: 0.85,
          stats: {
            total_processing_time_ms: 1500,
            lang_detected: 'fr'
          }
        })
      });
    });
    
    // Envoyer une question
    await page.fill('[data-testid="query-input"]', 'test question');
    await page.click('[data-testid="send-btn"]');
    
    // Vérifier le message utilisateur
    const userMessage = page.locator('[data-testid="message-user"]');
    await expect(userMessage).toBeVisible();
    await expect(userMessage).toContainText('test question');
    
    // Vérifier le message assistant
    const assistantMessage = page.locator('[data-testid="message-assistant"]');
    await expect(assistantMessage).toBeVisible();
    await expect(assistantMessage).toContainText('Voici une réponse de test');
    
    // Vérifier les citations
    const citationBtn = page.locator('[data-testid="citation-btn"]');
    await expect(citationBtn).toBeVisible();
    await expect(citationBtn).toContainText('Document Test (p.1)');
  });

  test('should handle NO_ANSWER response', async ({ page }) => {
    // Intercepter la requête API pour retourner NO_ANSWER
    await page.route('**/rag/answer', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'question sans réponse',
          lang: 'fr',
          answer: 'NO_ANSWER',
          sources: [],
          confidence: 0,
          reasoning: 'Aucune information pertinente trouvée',
          stats: {
            total_processing_time_ms: 800,
            lang_detected: 'fr'
          }
        })
      });
    });
    
    // Envoyer une question
    await page.fill('[data-testid="query-input"]', 'question sans réponse');
    await page.click('[data-testid="send-btn"]');
    
    // Vérifier le message NO_ANSWER
    const assistantMessage = page.locator('[data-testid="message-assistant"]');
    await expect(assistantMessage).toBeVisible();
    await expect(assistantMessage.locator('.no-answer-message')).toBeVisible();
    await expect(assistantMessage).toContainText('Aucune réponse trouvée');
  });

  test('should clear chat history', async ({ page }) => {
    // Envoyer quelques messages d'abord
    await page.fill('[data-testid="query-input"]', 'Premier message');
    await page.press('[data-testid="query-input"]', 'Enter');
    
    await page.fill('[data-testid="query-input"]', 'Deuxième message');
    await page.press('[data-testid="query-input"]', 'Enter');
    
    // Vérifier qu'il y a des messages
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(2);
    
    // Effacer l'historique
    await page.click('[data-testid="clear-chat-btn"]');
    
    // Vérifier que les messages ont disparu
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(0);
    await expect(page.locator('text=Bienvenue dans l\'assistant IA')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercepter la requête API pour retourner une erreur
    await page.route('**/rag/answer', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'ANSWER_FAILED',
          message: 'Erreur serveur'
        })
      });
    });
    
    // Envoyer une question
    await page.fill('[data-testid="query-input"]', 'question avec erreur');
    await page.click('[data-testid="send-btn"]');
    
    // Vérifier qu'un message d'erreur apparaît
    const assistantMessage = page.locator('[data-testid="message-assistant"]');
    await expect(assistantMessage).toBeVisible();
    await expect(assistantMessage).toContainText('une erreur est survenue');
  });

  test('should navigate between tabs', async ({ page }) => {
    // Vérifier qu'on est sur l'onglet Chat
    await expect(page.locator('[data-testid="chat-tab"]')).toHaveClass(/bg-blue-100/);
    await expect(page.locator('[data-testid="chat-module"]')).toBeVisible();
    
    // Basculer vers Sources
    await page.click('[data-testid="sources-tab"]');
    await expect(page.locator('[data-testid="sources-tab"]')).toHaveClass(/bg-blue-100/);
    await expect(page.locator('[data-testid="sources-module"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-module"]')).not.toBeVisible();
    
    // Revenir au Chat
    await page.click('[data-testid="chat-tab"]');
    await expect(page.locator('[data-testid="chat-tab"]')).toHaveClass(/bg-blue-100/);
    await expect(page.locator('[data-testid="chat-module"]')).toBeVisible();
  });

  test('should maintain chat history when switching tabs', async ({ page }) => {
    // Envoyer un message
    await page.fill('[data-testid="query-input"]', 'Message de test');
    await page.press('[data-testid="query-input"]', 'Enter');
    
    // Vérifier le message
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible();
    
    // Basculer vers Sources puis revenir
    await page.click('[data-testid="sources-tab"]');
    await page.click('[data-testid="chat-tab"]');
    
    // Vérifier que le message est toujours là
    await expect(page.locator('[data-testid="message-user"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-user"]')).toContainText('Message de test');
  });

});
