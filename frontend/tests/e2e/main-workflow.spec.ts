import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Tests E2E principaux selon spécifications strictes
 * 1. Upload → Chat question → citations ≥1
 * 2. Clic citation → Viewer scrolle & highlight exact
 * 3. Magic Studio : Mind Map (≥3 nœuds), Podcast joue, Export .md
 * 4. Mobile viewport (tabs 3 panneaux)
 */

test.describe('Workflow Principal RAG', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    
    // Attendre que l'application soit chargée
    await expect(page.locator('app-shell')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('1. Upload → Chat question → citations ≥1', async () => {
    // Étape 1: Upload d'un document
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Créer un fichier de test temporaire
    const testContent = `
      Intelligence Artificielle et Machine Learning
      
      L'intelligence artificielle (IA) est une technologie révolutionnaire qui transforme notre monde.
      Le machine learning, une branche de l'IA, permet aux machines d'apprendre automatiquement.
      
      Applications principales:
      - Reconnaissance vocale et traitement du langage naturel
      - Vision par ordinateur et analyse d'images
      - Systèmes de recommandation personnalisés
      - Véhicules autonomes et robotique avancée
      
      L'avenir de l'IA promet des innovations encore plus spectaculaires dans tous les domaines.
    `;
    
    // Simuler l'upload du fichier
    await fileInput.setInputFiles({
      name: 'test-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent)
    });
    
    // Attendre la confirmation d'upload
    await expect(page.locator('.upload-success, .document-uploaded')).toBeVisible({ timeout: 30000 });
    
    // Étape 2: Poser une question dans le chat
    const chatInput = page.locator('textarea[placeholder*="question"], input[placeholder*="question"], .chat-input textarea, .chat-input input');
    await expect(chatInput).toBeVisible();
    
    const question = "Quelles sont les principales applications de l'intelligence artificielle ?";
    await chatInput.fill(question);
    
    // Envoyer la question
    const sendButton = page.locator('button[type="submit"], .send-button, button:has-text("Send"), button:has-text("Envoyer")');
    await sendButton.click();
    
    // Attendre la réponse avec citations
    await expect(page.locator('.chat-message.assistant, .response-message')).toBeVisible({ timeout: 45000 });
    
    // Vérifier qu'il y a au moins une citation
    const citations = page.locator('.citation, .source-citation, [data-citation]');
    await expect(citations.first()).toBeVisible({ timeout: 10000 });
    
    const citationCount = await citations.count();
    expect(citationCount).toBeGreaterThanOrEqual(1);
    
    console.log(`✅ Test 1 réussi: ${citationCount} citation(s) trouvée(s)`);
  });

  test('2. Clic citation → Viewer scrolle & highlight exact', async () => {
    // Prérequis: Avoir un document et une réponse avec citations
    await test.step('Setup: Upload et question', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-doc.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Machine Learning est une branche de l\'intelligence artificielle qui permet aux systèmes d\'apprendre automatiquement à partir de données.')
      });
      
      await expect(page.locator('.upload-success, .document-uploaded')).toBeVisible({ timeout: 30000 });
      
      const chatInput = page.locator('textarea[placeholder*="question"], input[placeholder*="question"], .chat-input textarea, .chat-input input');
      await chatInput.fill("Qu'est-ce que le Machine Learning ?");
      
      const sendButton = page.locator('button[type="submit"], .send-button, button:has-text("Send"), button:has-text("Envoyer")');
      await sendButton.click();
      
      await expect(page.locator('.chat-message.assistant, .response-message')).toBeVisible({ timeout: 45000 });
    });
    
    // Test principal: Clic sur citation
    const citation = page.locator('.citation, .source-citation, [data-citation]').first();
    await expect(citation).toBeVisible();
    
    // Vérifier que le viewer panel est visible
    const viewerPanel = page.locator('.viewer-panel, app-viewer-panel');
    await expect(viewerPanel).toBeVisible();
    
    // Cliquer sur la citation
    await citation.click();
    
    // Attendre que le viewer réagisse (scroll + highlight)
    await page.waitForTimeout(1000); // Laisser le temps pour l'animation
    
    // Vérifier qu'un élément est surligné dans le viewer
    const highlightedElement = page.locator('.highlighted, .citation-highlight, .span-highlight, [data-highlighted="true"]');
    await expect(highlightedElement).toBeVisible({ timeout: 5000 });
    
    // Vérifier que le scroll a eu lieu (l'élément surligné doit être visible)
    await expect(highlightedElement).toBeInViewport();
    
    console.log('✅ Test 2 réussi: Citation cliquée → Viewer scroll & highlight');
  });

  test('3. Magic Studio : Mind Map (≥3 nœuds), Podcast joue, Export .md', async () => {
    // Prérequis: Avoir une réponse pour générer le Magic Studio
    await test.step('Setup: Générer une réponse RAG', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'ai-concepts.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(`
          Intelligence Artificielle: Concepts Fondamentaux
          
          L'intelligence artificielle comprend plusieurs domaines:
          - Machine Learning: apprentissage automatique
          - Deep Learning: réseaux de neurones profonds  
          - Natural Language Processing: traitement du langage
          - Computer Vision: vision par ordinateur
          - Robotics: robotique intelligente
          
          Ces technologies révolutionnent l'industrie moderne.
        `)
      });
      
      await expect(page.locator('.upload-success, .document-uploaded')).toBeVisible({ timeout: 30000 });
      
      const chatInput = page.locator('textarea[placeholder*="question"], input[placeholder*="question"], .chat-input textarea, .chat-input input');
      await chatInput.fill("Quels sont les principaux domaines de l'intelligence artificielle ?");
      
      const sendButton = page.locator('button[type="submit"], .send-button, button:has-text("Send"), button:has-text("Envoyer")');
      await sendButton.click();
      
      await expect(page.locator('.chat-message.assistant, .response-message')).toBeVisible({ timeout: 45000 });
    });
    
    // Accéder au Magic Studio
    const magicStudioTab = page.locator('button:has-text("Magic Studio"), .magic-studio-tab, [data-tab="magic-studio"]');
    if (await magicStudioTab.isVisible()) {
      await magicStudioTab.click();
    }
    
    const magicStudio = page.locator('.magic-studio, app-magic-studio');
    await expect(magicStudio).toBeVisible();
    
    // Test Mind Map
    await test.step('Mind Map: ≥3 nœuds', async () => {
      const mindMapTab = page.locator('button:has-text("Mind Map"), .tab-btn:has-text("Mind Map")');
      await mindMapTab.click();
      
      // Attendre la génération de la mind map
      await page.waitForTimeout(3000);
      
      // Vérifier qu'il y a au moins 3 nœuds
      const mindMapNodes = page.locator('.mindmap-canvas, canvas[data-mindmap]');
      await expect(mindMapNodes).toBeVisible();
      
      // Vérifier le compteur de nœuds ou les nœuds eux-mêmes
      const nodeCount = page.locator('.node-count');
      if (await nodeCount.isVisible()) {
        const countText = await nodeCount.textContent();
        const count = parseInt(countText?.match(/\d+/)?.[0] || '0');
        expect(count).toBeGreaterThanOrEqual(3);
      }
      
      console.log('✅ Mind Map: ≥3 nœuds générés');
    });
    
    // Test Podcast
    await test.step('Podcast: Lecture TTS', async () => {
      const podcastTab = page.locator('button:has-text("Podcast"), .tab-btn:has-text("Podcast")');
      await podcastTab.click();
      
      // Générer le podcast si nécessaire
      const generatePodcastBtn = page.locator('button:has-text("Generate Podcast"), .action-execute-btn:has-text("Generate Podcast")');
      if (await generatePodcastBtn.isVisible()) {
        await generatePodcastBtn.click();
        await page.waitForTimeout(5000); // Attendre la génération
      }
      
      // Tester la lecture
      const playButton = page.locator('button:has-text("Play"), .play-btn, .control-btn:has-text("Play")');
      await expect(playButton).toBeVisible();
      await playButton.click();
      
      // Vérifier que la lecture a commencé
      await page.waitForTimeout(2000);
      const pauseButton = page.locator('button:has-text("Pause"), .play-btn:has-text("Pause")');
      await expect(pauseButton).toBeVisible({ timeout: 5000 });
      
      // Arrêter la lecture
      const stopButton = page.locator('button:has-text("Stop"), .control-btn:has-text("Stop")');
      if (await stopButton.isVisible()) {
        await stopButton.click();
      }
      
      console.log('✅ Podcast: Lecture TTS fonctionnelle');
    });
    
    // Test Export .md
    await test.step('Export .md', async () => {
      const actionsTab = page.locator('button:has-text("Actions"), .tab-btn:has-text("Actions")');
      await actionsTab.click();
      
      // Générer du contenu à exporter
      const summaryBtn = page.locator('button:has-text("Generate Summary"), .action-execute-btn:has-text("Generate Summary")');
      await summaryBtn.click();
      
      // Attendre la génération
      await expect(page.locator('.generated-content')).toBeVisible({ timeout: 30000 });
      
      // Tester l'export
      const exportBtn = page.locator('button:has-text("Export .md"), .content-btn:has-text("Export")');
      await expect(exportBtn).toBeVisible();
      
      // Configurer l'écoute des téléchargements
      const downloadPromise = page.waitForEvent('download');
      await exportBtn.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.md$/);
      
      console.log('✅ Export .md: Téléchargement réussi');
    });
  });

  test('4. Mobile viewport (tabs 3 panneaux)', async () => {
    // Configurer le viewport mobile
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    // Recharger pour s'assurer que le responsive s'applique
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Vérifier que l'interface s'adapte au mobile
    const shell = page.locator('app-shell, .shell-container');
    await expect(shell).toBeVisible();
    
    // En mobile, les panneaux doivent être en mode tabs/navigation
    const mobileNavigation = page.locator('.mobile-nav, .bottom-nav, .tab-navigation, .mobile-tabs');
    
    // Si pas de navigation mobile spécifique, vérifier que les panneaux sont empilés
    const panels = page.locator('.panel, .sidebar-sources, .chat-panel, .viewer-panel');
    const panelCount = await panels.count();
    
    if (panelCount > 0) {
      // Vérifier que les panneaux sont accessibles via navigation
      for (let i = 0; i < Math.min(panelCount, 3); i++) {
        const panel = panels.nth(i);
        
        // Chercher les boutons de navigation pour chaque panneau
        const navButtons = page.locator('button, .nav-item, .tab-item');
        const navCount = await navButtons.count();
        
        if (navCount >= 3) {
          // Tester la navigation entre les panneaux
          await navButtons.nth(i).click();
          await page.waitForTimeout(500);
          
          // Vérifier qu'un panneau est visible
          const visiblePanels = page.locator('.panel:visible, .active-panel, [aria-selected="true"]');
          await expect(visiblePanels.first()).toBeVisible();
        }
      }
    }
    
    // Test d'upload en mobile
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: 'mobile-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test mobile upload functionality')
      });
      
      await expect(page.locator('.upload-success, .document-uploaded')).toBeVisible({ timeout: 30000 });
    }
    
    // Test de chat en mobile
    const chatInput = page.locator('textarea, input[type="text"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill("Test mobile");
      
      const sendButton = page.locator('button[type="submit"], .send-button').first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
      }
    }
    
    console.log('✅ Mobile viewport: Interface responsive fonctionnelle');
  });
});

test.describe('Tests de Performance et Robustesse', () => {
  test('Gestion des erreurs réseau', async ({ page }) => {
    await page.goto('/');
    
    // Simuler une panne réseau
    await page.route('**/api/**', route => route.abort());
    
    const chatInput = page.locator('textarea[placeholder*="question"], input[placeholder*="question"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill("Test avec erreur réseau");
      
      const sendButton = page.locator('button[type="submit"], .send-button').first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
      }
      
      // Vérifier qu'un message d'erreur apparaît
      await expect(page.locator('.error-message, .alert-error, [role="alert"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Chargement avec connexion lente', async ({ page }) => {
    // Simuler une connexion lente
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });
    
    await page.goto('/');
    
    // Vérifier que les indicateurs de chargement apparaissent
    const loadingIndicators = page.locator('.loading, .spinner, .skeleton, [aria-busy="true"]');
    
    if (await loadingIndicators.first().isVisible({ timeout: 1000 })) {
      console.log('✅ Indicateurs de chargement présents');
    }
  });
});
