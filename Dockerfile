# StudyMate VU - Dockerfile for Railway deployment
# Uses Puppeteer with its own downloaded Chrome

FROM node:20-slim

# Install Chrome runtime dependencies
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

# Install dependencies and let Puppeteer download its compatible Chrome
RUN npm ci

# Copy source code
COPY . .

# Build Next.js (creates .next/standalone/)
RUN npm run build

# Copy Puppeteer's Chrome binary into the standalone output
# Puppeteer stores Chrome in ~/.cache/puppeteer/ during npm ci
RUN CHROME_PATH=$(find /root/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1) && \
    if [ -n "$CHROME_PATH" ]; then \
      CHROME_DIR=$(dirname "$CHROME_PATH"); \
      mkdir -p /app/.next/standalone/puppeteer-chrome/; \
      cp -r "$CHROME_DIR"/ /app/.next/standalone/puppeteer-chrome/; \
      echo "Copied Chrome from $CHROME_DIR to standalone output"; \
    else \
      echo "WARNING: Chrome not found in puppeteer cache!"; \
    fi

# Set environment variable for Chrome path
ENV PUPPETEER_EXECUTABLE_PATH=/app/.next/standalone/puppeteer-chrome/chrome

# Remove dev dependencies after build
RUN npm prune --omit=dev

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the app using the standalone server
CMD ["node", ".next/standalone/server.js"]
