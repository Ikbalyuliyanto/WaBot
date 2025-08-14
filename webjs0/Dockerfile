FROM node:18

# Install dependencies untuk Chromium (Puppeteer)
RUN apt update && apt install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libasound2 \
    libx11-xcb1 \
    libxfixes3 \
    fonts-liberation \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends && \
    apt clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Biarkan PORT bisa dikontrol dari luar (Docker Compose)
ARG PORT=3000
ENV PORT=$PORT

EXPOSE $PORT

CMD ["node", "index.js"]
