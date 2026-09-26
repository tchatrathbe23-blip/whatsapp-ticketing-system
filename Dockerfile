# Use Node.js 20 on Debian Bookworm Slim
FROM node:20-bookworm-slim

# Install Google Chrome stable, fonts for Indian languages/emojis, and required Puppeteer libraries
RUN apt-get update && apt-get install -y wget gnupg ca-certificates --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-freefont-ttf fonts-deva \
       libxss1 libasound2 libgbm1 libnss3 libatk-bridge2.0-0 libgtk-3-0 \
       --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's built-in Chromium download and point to installed Google Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start both Express server and WhatsApp chatbot
CMD ["npm", "start"]
