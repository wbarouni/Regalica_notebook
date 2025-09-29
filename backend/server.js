const express = require('express');
const cors = require('cors');

const app = express();

// Configuration depuis les variables d'environnement
const PORT = process.env.PORT_BACKEND || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

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

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});
