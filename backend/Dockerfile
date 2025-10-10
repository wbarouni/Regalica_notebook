FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm install -g nodemon

COPY src ./src

EXPOSE 5200
CMD ["nodemon", "--watch", "src", "src/server.js"]
