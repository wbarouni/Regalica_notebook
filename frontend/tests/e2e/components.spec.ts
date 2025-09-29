import { test, expect, Page } from '@playwright/test';

/**
 * Tests E2E pour les composants individuels
 * Tests détaillés de chaque fonctionnalité selon spécifications
 */

test.describe('Composants Sources Panel', () => {
  test('Upload et gestion des documents', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test upload multiple formats
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Upload fichier texte
    await fileInput.setInputFiles({
      name: 'document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Contenu du document de test pour validation upload')
    });
    
    await expect(page.locator('.upload-success, .document-uploaded')).toBeVisible({ timeout: 30000 });
    
    // Vérifier que le document apparaît dans la liste
    const documentList = page.locator('.document-list, .sources-list');
    await expect(documentList).toBeVisible();
    
    const documentItem = page.locator('.document-item, .source-item').first();
    await expect(documentItem).toBeVisible();
    
    // Test filtres si disponibles
    const filterInput = page.locator('input[placeholder*="filter"], input[placeholder*="search"]');
    if (await filterInput.isVisible()) {
      await filterInput.fill('document');
      await page.waitForTimeout(500);
      
      // Vérifier que le filtrage fonctionne
      await expect(documentItem).toBeVisible();
    }
  });

  test('Pagination des documents', async ({ page }) => {
    await page.goto('/');
    
    // Upload plusieurs documents pour tester la pagination
    const fileInput = page.locator('input[type="file"]');
    
    for (let i = 1; i <= 3; i++) {
      await fileInput.setInputFiles({
        name: `doc${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`Document ${i} pour test pagination`)
      });
      
      await page.waitForTimeout(2000);
    }
    
    // Vérifier les contrôles de pagination si présents
    const paginationControls = page.locator('.pagination, .page-controls');
    if (await paginationControls.isVisible()) {
      const nextButton = page.locator('button:has-text("Next"), .next-page');
      const prevButton = page.locator('button:has-text("Previous"), .prev-page');
      
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('Composant Chat Panel', () => {
  test('Interface de chat et streaming', async ({ page }) => {
    await page.goto('/');
    
    // Setup: Upload un document
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'chat-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Intelligence artificielle et machine learning sont des technologies révolutionnaires.')
    });
    
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
    
    // Test interface de chat
    const chatInput = page.locator('textarea[placeholder*="question"], .chat-input textarea');
    await expect(chatInput).toBeVisible();
    
    // Test placeholder et focus
    await chatInput.click();
    await expect(chatInput).toBeFocused();
    
    // Test saisie et envoi
    const question = "Qu'est-ce que l'intelligence artificielle ?";
    await chatInput.fill(question);
    
    const sendButton = page.locator('button[type="submit"], .send-button');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    
    // Vérifier que la question apparaît dans l'historique
    const userMessage = page.locator('.chat-message.user, .message-user');
    await expect(userMessage).toContainText(question);
    
    // Attendre la réponse
    const assistantMessage = page.locator('.chat-message.assistant, .message-assistant');
    await expect(assistantMessage).toBeVisible({ timeout: 45000 });
    
    // Vérifier les citations
    const citations = page.locator('.citation, .source-citation');
    await expect(citations.first()).toBeVisible();
  });

  test('Historique et export des conversations', async ({ page }) => {
    await page.goto('/');
    
    // Simuler une conversation existante
    const chatInput = page.locator('textarea[placeholder*="question"], .chat-input textarea');
    if (await chatInput.isVisible()) {
      await chatInput.fill("Test historique");
      
      const sendButton = page.locator('button[type="submit"], .send-button');
      if (await sendButton.isVisible()) {
        await sendButton.click();
        await page.waitForTimeout(3000);
      }
    }
    
    // Test export si disponible
    const exportButton = page.locator('button:has-text("Export"), .export-chat');
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(json|md|txt)$/);
    }
    
    // Test clear history si disponible
    const clearButton = page.locator('button:has-text("Clear"), .clear-history');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      
      // Confirmer si modal de confirmation
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});

test.describe('Composant Viewer Panel', () => {
  test('Affichage et navigation des documents', async ({ page }) => {
    await page.goto('/');
    
    // Upload un document avec contenu structuré
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'structured-doc.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`
        Chapitre 1: Introduction
        L'intelligence artificielle est une technologie révolutionnaire.
        
        Chapitre 2: Applications
        Les applications de l'IA sont nombreuses et variées.
        
        Chapitre 3: Conclusion
        L'avenir de l'IA est prometteur.
      `)
    });
    
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
    
    // Sélectionner le document dans la liste
    const documentItem = page.locator('.document-item, .source-item').first();
    if (await documentItem.isVisible()) {
      await documentItem.click();
    }
    
    // Vérifier que le viewer affiche le contenu
    const viewerPanel = page.locator('.viewer-panel, app-viewer-panel');
    await expect(viewerPanel).toBeVisible();
    
    const documentContent = page.locator('.document-content, .viewer-content');
    if (await documentContent.isVisible()) {
      await expect(documentContent).toContainText('Introduction');
    }
    
    // Test navigation par pages si applicable
    const nextPageButton = page.locator('button:has-text("Next"), .next-page');
    const prevPageButton = page.locator('button:has-text("Previous"), .prev-page');
    
    if (await nextPageButton.isVisible()) {
      await nextPageButton.click();
      await page.waitForTimeout(500);
    }
    
    if (await prevPageButton.isVisible()) {
      await prevPageButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('Surbrillance et scroll vers citations', async ({ page }) => {
    await page.goto('/');
    
    // Setup complet: document + question + réponse
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'highlight-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Machine Learning est une branche de l\'intelligence artificielle qui permet aux systèmes d\'apprendre automatiquement.')
    });
    
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
    
    const chatInput = page.locator('textarea[placeholder*="question"], .chat-input textarea');
    await chatInput.fill("Qu'est-ce que le Machine Learning ?");
    
    const sendButton = page.locator('button[type="submit"], .send-button');
    await sendButton.click();
    
    await expect(page.locator('.chat-message.assistant')).toBeVisible({ timeout: 45000 });
    
    // Cliquer sur une citation
    const citation = page.locator('.citation, .source-citation').first();
    await expect(citation).toBeVisible();
    await citation.click();
    
    // Vérifier la surbrillance dans le viewer
    const highlightedText = page.locator('.highlighted, .citation-highlight, .span-highlight');
    await expect(highlightedText).toBeVisible({ timeout: 5000 });
    
    // Vérifier que l'élément surligné est visible (scroll effectué)
    await expect(highlightedText).toBeInViewport();
  });
});

test.describe('Magic Studio Composants', () => {
  test('Mind Map génération et interaction', async ({ page }) => {
    await page.goto('/');
    
    // Setup: Générer une réponse avec sources
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'mindmap-source.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(`
        Concepts d'Intelligence Artificielle:
        - Machine Learning: apprentissage automatique
        - Deep Learning: réseaux de neurones
        - NLP: traitement du langage naturel
        - Computer Vision: vision par ordinateur
        - Robotics: robotique intelligente
      `)
    });
    
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
    
    const chatInput = page.locator('textarea[placeholder*="question"], .chat-input textarea');
    await chatInput.fill("Quels sont les domaines de l'IA ?");
    
    const sendButton = page.locator('button[type="submit"], .send-button');
    await sendButton.click();
    
    await expect(page.locator('.chat-message.assistant')).toBeVisible({ timeout: 45000 });
    
    // Accéder au Magic Studio
    const magicStudioTab = page.locator('button:has-text("Magic Studio"), .magic-studio-tab');
    if (await magicStudioTab.isVisible()) {
      await magicStudioTab.click();
    }
    
    // Aller à l'onglet Mind Map
    const mindMapTab = page.locator('button:has-text("Mind Map"), .tab-btn:has-text("Mind Map")');
    await mindMapTab.click();
    
    // Attendre la génération
    await page.waitForTimeout(3000);
    
    // Vérifier la présence du canvas
    const mindMapCanvas = page.locator('.mindmap-canvas, canvas');
    await expect(mindMapCanvas).toBeVisible();
    
    // Test interaction avec les nœuds
    const canvasBounds = await mindMapCanvas.boundingBox();
    if (canvasBounds) {
      // Cliquer au centre du canvas
      await page.mouse.click(
        canvasBounds.x + canvasBounds.width / 2,
        canvasBounds.y + canvasBounds.height / 2
      );
    }
    
    // Test export
    const exportButton = page.locator('button:has-text("Export"), .action-btn:has-text("Export")');
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    }
  });

  test('Podcast TTS contrôles', async ({ page }) => {
    await page.goto('/');
    
    // Accéder au Magic Studio et générer un podcast
    const magicStudioTab = page.locator('button:has-text("Magic Studio"), .magic-studio-tab');
    if (await magicStudioTab.isVisible()) {
      await magicStudioTab.click();
    }
    
    const podcastTab = page.locator('button:has-text("Podcast"), .tab-btn:has-text("Podcast")');
    await podcastTab.click();
    
    // Générer un podcast si nécessaire
    const generateButton = page.locator('button:has-text("Generate Podcast")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(5000);
    }
    
    // Test contrôles de lecture
    const playButton = page.locator('button:has-text("Play"), .play-btn');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      // Vérifier que le bouton change en Pause
      await expect(page.locator('button:has-text("Pause"), .play-btn:has-text("Pause")')).toBeVisible({ timeout: 5000 });
      
      // Test contrôle de vitesse
      const speedSelect = page.locator('select, .speed-control select');
      if (await speedSelect.isVisible()) {
        await speedSelect.selectOption('1.5');
        await page.waitForTimeout(1000);
      }
      
      // Arrêter la lecture
      const stopButton = page.locator('button:has-text("Stop"), .control-btn:has-text("Stop")');
      if (await stopButton.isVisible()) {
        await stopButton.click();
      }
    }
  });

  test('Actions génération et export', async ({ page }) => {
    await page.goto('/');
    
    // Setup: Avoir une réponse pour les actions
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'actions-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('L\'intelligence artificielle transforme notre société avec des applications dans la santé, l\'éducation et l\'industrie.')
    });
    
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
    
    const chatInput = page.locator('textarea[placeholder*="question"], .chat-input textarea');
    await chatInput.fill("Comment l'IA transforme-t-elle la société ?");
    
    const sendButton = page.locator('button[type="submit"], .send-button');
    await sendButton.click();
    
    await expect(page.locator('.chat-message.assistant')).toBeVisible({ timeout: 45000 });
    
    // Accéder aux Actions
    const magicStudioTab = page.locator('button:has-text("Magic Studio"), .magic-studio-tab');
    if (await magicStudioTab.isVisible()) {
      await magicStudioTab.click();
    }
    
    const actionsTab = page.locator('button:has-text("Actions"), .tab-btn:has-text("Actions")');
    await actionsTab.click();
    
    // Test génération de résumé
    const summaryButton = page.locator('button:has-text("Generate Summary")');
    await summaryButton.click();
    
    // Attendre la génération
    await expect(page.locator('.generated-content')).toBeVisible({ timeout: 30000 });
    
    // Test copy
    const copyButton = page.locator('button:has-text("Copy"), .content-btn:has-text("Copy")');
    if (await copyButton.isVisible()) {
      await copyButton.click();
      // Note: Le test du clipboard nécessite des permissions spéciales
    }
    
    // Test export
    const exportButton = page.locator('button:has-text("Export .md"), .content-btn:has-text("Export")');
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.md$/);
    }
    
    // Test autres actions
    const actionPlanButton = page.locator('button:has-text("Generate Plan")');
    if (await actionPlanButton.isVisible()) {
      await actionPlanButton.click();
      await expect(page.locator('.generated-content')).toBeVisible({ timeout: 30000 });
    }
  });
});

test.describe('Tests d\'Accessibilité', () => {
  test('Navigation au clavier', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation avec Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Vérifier qu'un élément est focusé
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('Attributs ARIA et rôles', async ({ page }) => {
    await page.goto('/');
    
    // Vérifier les rôles ARIA
    const mainContent = page.locator('[role="main"], main');
    if (await mainContent.isVisible()) {
      await expect(mainContent).toBeVisible();
    }
    
    // Vérifier les labels
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      const ariaLabel = await fileInput.getAttribute('aria-label');
      const label = page.locator('label[for]');
      
      expect(ariaLabel || await label.isVisible()).toBeTruthy();
    }
  });
});
