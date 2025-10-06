# Gunakan base image yang relatif kecil tapi cukup untuk Puppeteer
FROM node:18-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Tentukan direktori kerja
WORKDIR /app

# Copy dan install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy semua file
COPY . .

# Buat port dapat diatur via ENV
ARG PORT=3001
ENV PORT=$PORT
EXPOSE $PORT

# Jalankan app
CMD ["node", "index.js"]
