FROM node:20-slim

# Chromium untuk whatsapp-web.js (Puppeteer memakai Chromium sistem, tidak mengunduh sendiri).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-liberation fonts-noto-color-emoji tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    DATA_DIR=/app/data

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src

VOLUME ["/app/data"]
EXPOSE 3100
CMD ["node", "src/index.js"]
