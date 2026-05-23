# StudyMate VU - Dockerfile for Railway deployment
# Uses Puppeteer's bundled Chrome for version compatibility

FROM node:20-slim

# Install Chrome runtime dependencies (not Chrome itself - Puppeteer downloads its own)
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2t64 \
    libxshmfence1 \
    libxss1 \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Let Puppeteer download its own compatible Chrome
# Do NOT set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the app
CMD ["node", ".next/standalone/server.js"]
