FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx vite build
EXPOSE 3000
CMD ["node", "server.js"]
