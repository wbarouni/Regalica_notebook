const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const sourceId = uuidv4();
    const sourceData = {
      source_id: sourceId,
      filename: req.file.originalname,
      filepath: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploaded_at: new Date().toISOString()
    };

    // Stocker les métadonnées de la source
    sources.set(sourceId, sourceData);

    console.log(`Source uploaded: ${sourceData.filename} (${sourceId})`);

    res.json({
      source_id: sourceId,
      filename: req.file.originalname,
      size: req.file.size,
      status: 'uploaded'
    });

  } catch (error) {
    console.error('Error uploading source:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Endpoint pour poser des questions sur les sources
app.post('/chat/ask', (req, res) => {
  try {
    const { message, source_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    if (!source_id) {
      return res.status(400).json({ error: 'source_id requis' });
    }

    // Vérifier que la source existe
    const source = sources.get(source_id);
    if (!source) {
      return res.status(404).json({ error: 'Source non trouvée' });
    }

    // Simulation d'une réponse basée sur le document
    // En production, ici on ferait appel à Ollama pour analyser le PDF
    const simulatedAnswer = generateSimulatedAnswer(message, source);

    console.log(`Chat question: "${message}" for source ${source_id}`);

    res.json({
      answer: simulatedAnswer,
      source_id: source_id,
      message: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing chat question:', error);
    res.status(500).json({ error: 'Erreur lors du traitement de la question' });
  }
});

// Fonction pour générer une réponse simulée
function generateSimulatedAnswer(message, source) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('titre') || lowerMessage.includes('title')) {
    return `Le document "${source.filename}" semble être un fichier PDF de test. Le titre exact nécessiterait une analyse plus approfondie du contenu.`;
  }
  
  if (lowerMessage.includes('contenu') || lowerMessage.includes('content')) {
    return `Ce document PDF contient du texte de test. Pour une analyse détaillée, l'intégration avec Ollama permettrait d'extraire et d'analyser le contenu complet.`;
  }
  
  if (lowerMessage.includes('taille') || lowerMessage.includes('size')) {
    return `Le document fait ${Math.round(source.size / 1024)} KB.`;
  }
  
  // Réponse générique
  return `J'ai reçu votre question "${message}" concernant le document "${source.filename}". En mode simulation, je peux confirmer que le document a été traité et est disponible pour analyse. L'intégration complète avec Ollama permettrait des réponses plus précises basées sur le contenu réel du PDF.`;
}

// Endpoint pour lister les sources
app.get('/sources', (req, res) => {
  const sourcesList = Array.from(sources.values()).map(source => ({
    source_id: source.source_id,
    filename: source.filename,
    size: source.size,
    uploaded_at: source.uploaded_at
  }));
  
  res.json({ sources: sourcesList });
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
