FROM node:22-alpine

WORKDIR /app

# Instala solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Copia el código fuente
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Healthcheck básico
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["npm", "start"]