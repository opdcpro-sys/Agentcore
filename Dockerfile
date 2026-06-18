# Use official lightweight Node 20 image
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules if any
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json ./

# Install dependencies including devDependencies (for bundling)
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend and bundle Express backend
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

WORKDIR /app

# Create a non-root group and user for security in Hugging Face environment
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Only copy necessary run-time artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
# If database records or other files are stored locally, allow write permission
RUN touch bot_data.json && chown appuser:appuser bot_data.json

# Install only production dependencies
RUN npm ci --only=production

# Hugging Face Spaces executes on port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Switch to the non-root secure user
USER appuser

# Launch the production compiled bundle
CMD ["npm", "start"]
