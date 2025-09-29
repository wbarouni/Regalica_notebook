FROM node:lts-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Construire l'application
RUN npm run build

# Installer un serveur web simple
RUN npm install -g http-server

# Exposer le port
EXPOSE 4200

# Démarrer l'application
CMD ["http-server", "dist/regalica-frontend", "-p", "4200", "-a", "0.0.0.0"]
