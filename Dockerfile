# Use official lightweight Node 20 image as builder
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build Vite frontend and bundle backend
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

WORKDIR /app

# In node:20-slim, the 'node' user is already created with UID 1000.
# We make sure the files are owned by user 'node' (UID 1000) to comply with Hugging Face's security.
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/dist ./dist

# Create a writable bot_data.json owned by node
RUN touch bot_data.json && chown node:node bot_data.json

# Install only production dependencies
RUN npm ci --only=production

# Expose port and configure environment variables
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Switch to the pre-existing user 'node' (UID 1000) for security and Hugging Face compatibility
USER node

# Start the application
CMD ["npm", "start"]
