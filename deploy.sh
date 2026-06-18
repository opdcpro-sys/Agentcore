#!/bin/bash
# ==========================================
# 🚀 Telegram Bot Auto-Deployment Script 🚀
# ==========================================
# This script prepares, installs, builds, and runs the bot on your VPS/Server automatically.
# Usage: chmod +x deploy.sh && ./deploy.sh

echo "=========================================="
echo "⚡ Starting Auto-Deployment Process..."
echo "=========================================="

# 1. Update system package index
echo "📦 Updating system packages..."
sudo apt-get update -y

# 2. Check if Node.js is installed, if not, install Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "🟢 Node.js not found. Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs build-essential
else
    echo "✅ Node.js is already installed: $(node -v)"
fi

# 3. Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "🟢 npm not found. Installing npm..."
    sudo apt-get install -y npm
fi

# 4. Install PM2 globally for production process management if not installed
if ! command -v pm2 &> /dev/null; then
    echo "⚡ Installing PM2 globally for 24/7 background process execution..."
    sudo npm install -g pm2
else
    echo "✅ PM2 is already installed"
fi

# 5. Package installation
echo "📦 Installing project dependencies..."
npm install --legacy-peer-deps

# 6. Build the application (React Client + Server Bundle)
echo "🛠️ Building React frontend and bundling Backend Server..."
npm run build

# 7. Start/Restart the app on PM2
echo "🚀 Deploying with PM2..."
# Stop old instance if exists to prevent port conflicts
pm2 stop telegram-bot &> /dev/null || true
pm2 delete telegram-bot &> /dev/null || true

# Start the built server.ts using the compiled CommonJS bundle
pm2 start dist/server.cjs --name "telegram-bot" --env production

# Save pm2 state and configure it to auto-start on boot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo "📱 App is now running in backend under PM2!"
echo "👉 Check status with: pm2 status"
echo "👉 View live logs with: pm2 logs telegram-bot"
echo "👉 Server URL port: http://YOUR_VPS_IP:3000"
echo "=========================================="
