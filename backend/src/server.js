const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');

const app = express();

// Configuration depuis les variables d'environnement
const PORT = process.env.PORT_BACKEND || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accepter seulement les fichiers PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Store en mémoire pour les sources (en production, utiliser une base de données)
const sources = new Map();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

app.use(express.json());

// Route de healthcheck obligatoire
app.get('/health/ready', (req, res) => {
  res.json({ status: 'ready' });
});

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Regalica Notebook Backend',
    version: '0.1.0',
    status: 'running'
  });
});

// Endpoint pour uploader des sources (PDF)
app.post('/sources', upload.single('file'), (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      console.warn('[/sources] No file provided in request');
      return res.status(400).json({ 
        error: 'Aucun fichier fourni',
        code: 'NO_FILE'
      });
    }

    // Validation supplémentaire du fichier
    if (req.file.size === 0) {
      console.warn(`[/sources] Empty file uploaded: ${req.file.originalname}`);
      return res.status(400).json({ 
        error: 'Le fichier est vide',
        code: 'EMPTY_FILE'
      });
    }

    const sourceId = uuidv4();
    const sourceData = {
      source_id: sourceId,
      filename: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploaded_at: new Date().toISOString(),
      processing_status: 'uploaded'
    };

    // Stocker les métadonnées de la source
    sources.set(sourceId, sourceData);

    const processingTime = Date.now() - startTime;
    console.log(`[/sources] Source uploaded successfully: ${sourceData.filename} (${sourceId}) - ${processingTime}ms`);

    res.json({
      source_id: sourceId,
      filename: req.file.originalname,
      size: req.file.size,
      status: 'uploaded',
      processing_time_ms: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[/sources] Error uploading source (${processingTime}ms):`, error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload',
      code: 'UPLOAD_ERROR'
    });
  }
});

// Endpoint pour poser des questions sur les sources
app.post('/chat/ask', (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, source_id } = req.body;

    // Validation des paramètres
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.warn('[/chat/ask] Invalid or empty message provided');
      return res.status(400).json({ 
        error: 'Message requis et non vide',
        code: 'INVALID_MESSAGE'
      });
    }

    if (!source_id || typeof source_id !== 'string') {
      console.warn('[/chat/ask] Invalid or missing source_id');
      return res.status(400).json({ 
        error: 'source_id requis et valide',
        code: 'INVALID_SOURCE_ID'
      });
    }

    // Vérifier que la source existe
    const source = sources.get(source_id);
    if (!source) {
      console.warn(`[/chat/ask] Source not found: ${source_id}`);
      return res.status(404).json({ 
        error: 'Source non trouvée',
        code: 'SOURCE_NOT_FOUND',
        source_id: source_id
      });
    }

    // Simulation d'une réponse basée sur le document
    // En production, ici on ferait appel à Ollama pour analyser le PDF
    const simulatedAnswer = generateSimulatedAnswer(message.trim(), source);

    const processingTime = Date.now() - startTime;
    console.log(`[/chat/ask] Question processed: "${message.substring(0, 50)}..." for source ${source_id} (${source.filename}) - ${processingTime}ms`);

    res.json({
      answer: simulatedAnswer,
      source_id: source_id,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      processing_time_ms: processingTime,
      source_filename: source.filename
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[/chat/ask] Error processing chat question (${processingTime}ms):`, error);
    res.status(500).json({ 
      error: 'Erreur lors du traitement de la question',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Fonction pour générer une réponse simulée
function generateSimulatedAnswer(message, source) {
  const lowerMessage = message.toLowerCase();
  
  // Réponses spécialisées selon le type de question
  if (lowerMessage.includes('titre') || lowerMessage.includes('title')) {
    return `Le document "${source.filename}" semble être un fichier PDF de test. Le titre exact nécessiterait une analyse plus approfondie du contenu avec Ollama.`;
  }
  
  if (lowerMessage.includes('contenu') || lowerMessage.includes('content') || lowerMessage.includes('résumé') || lowerMessage.includes('summary')) {
    return `Ce document PDF (${Math.round(source.size / 1024)} KB) contient du texte de test. Pour une analyse détaillée du contenu, l'intégration avec Ollama permettrait d'extraire et d'analyser le texte complet.`;
  }
  
  if (lowerMessage.includes('taille') || lowerMessage.includes('size') || lowerMessage.includes('poids')) {
    return `Le document "${source.filename}" fait ${Math.round(source.size / 1024)} KB (${source.size} bytes). Il a été uploadé le ${new Date(source.uploaded_at).toLocaleString('fr-FR')}.`;
  }
  
  if (lowerMessage.includes('quand') || lowerMessage.includes('date') || lowerMessage.includes('upload')) {
    return `Le document "${source.filename}" a été uploadé le ${new Date(source.uploaded_at).toLocaleString('fr-FR')} avec l'ID ${source.source_id}.`;
  }
  
  if (lowerMessage.includes('type') || lowerMessage.includes('format') || lowerMessage.includes('mimetype')) {
    return `Le document "${source.filename}" est de type ${source.mimetype}. Il s'agit d'un fichier PDF standard.`;
  }
  
  if (lowerMessage.includes('aide') || lowerMessage.includes('help') || lowerMessage.includes('commandes')) {
    return `Je peux répondre à des questions sur le titre, le contenu, la taille, la date d'upload, ou le type du document "${source.filename}". En mode production, Ollama analyserait le contenu réel du PDF.`;
  }
  
  // Réponse générique améliorée
  return `J'ai reçu votre question "${message}" concernant le document "${source.filename}" (${Math.round(source.size / 1024)} KB). En mode simulation, je peux confirmer que le document a été traité et est disponible pour analyse. L'intégration complète avec Ollama permettrait des réponses plus précises basées sur le contenu réel du PDF. Essayez de demander le titre, le contenu, la taille ou la date d'upload.`;
}

// Endpoint pour lister les sources
app.get('/sources', (req, res) => {
  try {
    const sourcesList = Array.from(sources.values()).map(source => ({
      source_id: source.source_id,
      filename: source.filename,
      size: source.size,
      uploaded_at: source.uploaded_at,
      processing_status: source.processing_status || 'uploaded'
    }));
    
    console.log(`[/sources] Listed ${sourcesList.length} sources`);
    
    res.json({ 
      sources: sourcesList,
      total_count: sourcesList.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[/sources] Error listing sources:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des sources',
      code: 'LIST_ERROR'
    });
  }
});

// Gestion des erreurs multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 10MB)' });
    }
  }
  
  if (error.message === 'Seuls les fichiers PDF sont acceptés') {
    return res.status(400).json({ error: error.message });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});
