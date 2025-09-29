FROM node:lts-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY . .

EXPOSE 8080
# Démarrer l'application (un seul CMD)
CMD ["node", "src/server.js"]
