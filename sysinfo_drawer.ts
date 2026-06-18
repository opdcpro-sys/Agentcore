import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
import os from 'os';

export function generateSysinfoImage(uptimeSeconds: number): Buffer {
  const width = 960;
  const height = 620;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background Dark Matrix-Cyber Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060814');
  bgGrad.addColorStop(0.5, '#0d1124');
  bgGrad.addColorStop(1, '#050711');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Grid background
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw main cyberpunk container borders with neon glow
  ctx.strokeStyle = '#00ffb2';
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, width - 30, height - 30);

  // Subtle outer neon accent border
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  // Sci-fi Corner Bracket Details
  ctx.fillStyle = '#00ffb2';
  // Top-left corner
  ctx.fillRect(12, 12, 40, 5);
  ctx.fillRect(12, 12, 5, 40);
  // Top-right corner
  ctx.fillRect(width - 52, 12, 40, 5);
  ctx.fillRect(width - 17, 12, 5, 40);
  // Bottom-left corner
  ctx.fillRect(12, height - 17, 40, 5);
  ctx.fillRect(12, height - 52, 5, 40);
  // Bottom-right corner
  ctx.fillRect(width - 52, height - 17, 40, 5);
  ctx.fillRect(width - 17, height - 52, 5, 40);

  // Draw Top Bar/Header
  ctx.fillStyle = 'rgba(0, 255, 178, 0.08)';
  ctx.fillRect(20, 20, width - 40, 60);
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, width - 40, 60);

  // LED Status on top left
  ctx.fillStyle = '#00ffb2';
  ctx.beginPath();
  ctx.arc(45, 50, 8, 0, Math.PI * 2);
  ctx.fill();

  // Status pulse effect (glowing arc)
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(45, 50, 14, 0, Math.PI * 2);
  ctx.stroke();

  // "SERVER ONLINE" Text
  ctx.fillStyle = '#00ffb2';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('⚡ OWNER: DEBJYOTI CHAKRABORTY (@IM_HINDU)', 70, 55);

  // Centered Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TADAKEDAR ADVANCED SYSTEM SUPERINTENDENT', width / 2, 56);
  ctx.textAlign = 'left'; // Reset

  // Top Right Info
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '11px monospace';
  ctx.fillText('LOC: TW-01-CLOUD-INGRESS', width - 230, 46);
  ctx.fillText('SYSADMIN: @im_hindu', width - 230, 62);

  // LEFT COLUMN: Visual Server Rack representation & Logs (Width: 320px)
  const leftX = 25;
  const leftY = 95;
  const leftW = 320;
  const leftH = 500;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.7)';
  ctx.fillRect(leftX, leftY, leftW, leftH);
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
  ctx.strokeRect(leftX, leftY, leftW, leftH);

  // Draw Shelf Title
  ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
  ctx.fillRect(leftX, leftY, leftW, 30);
  ctx.fillStyle = '#00d4ff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('💾 HARDWARE CABINET (EPYC-RACK)', leftX + 15, leftY + 20);

  // Server Slots drawings (Draw 4 blade servers)
  for (let i = 0; i < 4; i++) {
    const slotY = leftY + 45 + i * 55;
    ctx.fillStyle = 'rgba(15, 25, 45, 0.9)';
    ctx.fillRect(leftX + 15, slotY, leftW - 30, 45);
    ctx.strokeStyle = i === 0 ? '#00ffb2' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX + 15, slotY, leftW - 30, 45);

    // Bullet indicator
    ctx.fillStyle = i === 0 ? '#00ffb2' : (i === 1 ? '#00d4ff' : '#555555');
    ctx.beginPath();
    ctx.arc(leftX + 35, slotY + 22, 5, 0, Math.PI * 2);
    ctx.fill();

    // Slot labels
    ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`BLADE_NODE_0${i + 1} [${i === 0 ? 'ACTIVE/MASTER' : (i === 1 ? 'STANDBY' : 'SHADOW')}]`, leftX + 55, slotY + 20);

    // Vent grills (small lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    for (let g = 0; g < 10; g++) {
      ctx.beginPath();
      ctx.moveTo(leftX + 230 + g * 5, slotY + 15);
      ctx.lineTo(leftX + 230 + g * 5, slotY + 30);
      ctx.stroke();
    }
  }

  // Mini Terminal Output in Left Column bottom half
  const termY = leftY + 280;
  const termH = 205;
  ctx.fillStyle = '#02040a';
  ctx.fillRect(leftX + 15, termY, leftW - 30, termH);
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.2)';
  ctx.strokeRect(leftX + 15, termY, leftW - 30, termH);

  ctx.fillStyle = '#3bc400';
  ctx.font = '10px monospace';
  ctx.fillText('debjyoti@im_hindu:~# telemetry --live', leftX + 25, termY + 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('[syst] Initializing core drivers...', leftX + 25, termY + 40);
  ctx.fillText('[gpus] Mapping CUDA context on GPU_0...', leftX + 25, termY + 55);
  ctx.fillText('[gpus] NVLink 600GB/s interlink: OK', leftX + 25, termY + 70);
  ctx.fillText('[mem ] Allocating 128GB ECC memory blocks', leftX + 25, termY + 85);
  ctx.fillStyle = '#00ffb2';
  ctx.fillText('[okay] System is currently 100% stable', leftX + 25, termY + 110);
  ctx.fillText('>> Active agents sync: ONLINE', leftX + 25, termY + 125);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillText('[log ] process.id: ' + process.pid + ' | port: 3000', leftX + 25, termY + 150);
  ctx.fillText('[log ] connection: Telegram MTProto Secure', leftX + 25, termY + 165);
  ctx.fillStyle = '#00d4ff';
  ctx.fillText('>>> SYSTEM SHIELD IS FULLY LOADED', leftX + 25, termY + 190);


  // RIGHT COLUMN: Beautiful Dashboard meters (Width: 575px)
  const rightX = 365;
  const rightY = 95;
  const rightW = 570;
  const rightH = 500;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.6)';
  ctx.fillRect(rightX, rightY, rightW, rightH);
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.1)';
  ctx.strokeRect(rightX, rightY, rightW, rightH);

  // Title for right side
  ctx.fillStyle = 'rgba(0, 255, 178, 0.08)';
  ctx.fillRect(rightX, rightY, rightW, 30);
  ctx.fillStyle = '#00ffb2';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('⚙️ ADVANCED PROMETHEUS ULTRA TELEMETRY', rightX + 15, rightY + 20);

  // Define some high tech metrics
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  const telemetryData = [
    {
      title: '🖥️ PROCESSOR / CPU (AMD Ryzen Threadripper / EPYC Cluster)',
      value: 'Dual AMD EPYC 9654 (192 Cores, 384 Threads @ 3.70 GHz)',
      usagePercent: 24, // simulated dynamic load
      color: '#00ffb2',
      details: 'High-Performance Computing AI Threads • Cache: 768MB L3'
    },
    {
      title: '🧠 SYSTEM VOLATILE MEMORY (DDR5 Server ECC Memory)',
      value: '128.00 GB DDR5 Server-Grade ECC Architecture',
      usagePercent: 42, // simulated dynamic load (approx 54GB used)
      color: '#00d4ff',
      details: 'Active: 54.32 GiB  |  Free: 73.68 GiB  |  Total: 128.00 GiB'
    },
    {
      title: '🎮 ACCELERATOR / Dedicated GPU (AI & Video Encoding)',
      value: 'NVIDIA Tensor Core H100 SXM5 Super-GPU (80GB VRAM)',
      usagePercent: 35, // GPU Workload
      color: '#e5ff00',
      details: 'VRAM: 28.16 GB / 80.00 GB (High Performance Mode Active)'
    },
    {
      title: '📁 SECURE PERSISTENT STORAGE (Enterprise NVMe RAID-0 Array)',
      value: '2,048.00 GB NVMe PCIe Gen 5 Ultra Speed SSD',
      usagePercent: 7, // disk usage simulated
      color: '#ff2f76',
      details: 'Allocated Saved Logs: 142.50 GB  |  Readable Speed: 14,000 MB/s'
    }
  ];

  // Draw meters
  let cardY = rightY + 45;
  for (const item of telemetryData) {
    // Card background
    ctx.fillStyle = 'rgba(20, 30, 55, 0.5)';
    ctx.fillRect(rightX + 15, cardY, rightW - 30, 95);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeRect(rightX + 15, cardY, rightW - 30, 95);

    // Left indicator bar
    ctx.fillStyle = item.color;
    ctx.fillRect(rightX + 15, cardY, 4, 95);

    // Text Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(item.title, rightX + 30, cardY + 20);

    // Spec value in bright white
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(item.value, rightX + 30, cardY + 38);

    // Progress bar outline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(rightX + 30, cardY + 52, rightW - 75, 12);

    // Fill Progress Bar
    const gradBar = ctx.createLinearGradient(rightX + 30, 0, rightX + 250, 0);
    gradBar.addColorStop(0, item.color);
    gradBar.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradBar;
    ctx.fillRect(rightX + 30, cardY + 52, (rightW - 75) * (item.usagePercent / 100), 12);

    // Draw grid ticks inside bar
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let tick = rightX + 30; tick < rightX + 30 + (rightW - 75); tick += 14) {
      ctx.beginPath();
      ctx.moveTo(tick, cardY + 52);
      ctx.lineTo(tick, cardY + 64);
      ctx.stroke();
    }

    // Write percent text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`${item.usagePercent}% LOAD`, rightX + rightW - 100, cardY + 20);

    // Details text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(item.details, rightX + 30, cardY + 80);

    cardY += 105;
  }

  // Draw Uptime, Node Status Summary at the bottom
  const footerY = rightY + 450;
  ctx.fillStyle = 'rgba(0, 255, 178, 0.04)';
  ctx.fillRect(rightX + 15, footerY, rightW - 30, 35);
  ctx.strokeStyle = 'rgba(0, 255, 178, 0.2)';
  ctx.strokeRect(rightX + 15, footerY, rightW - 30, 35);

  ctx.fillStyle = '#00ffb2';
  ctx.font = '11px monospace';
  ctx.fillText('UPTIME:', rightX + 30, footerY + 22);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${hours} Hours, ${minutes} Minutes, ${seconds} Seconds (Continuously Online)`, rightX + 85, footerY + 22);

  // Status OK node text
  ctx.fillStyle = '#00d4ff';
  ctx.fillText('HEALTH: 100% EXCELLENT', rightX + rightW - 180, footerY + 22);

  return canvas.toBuffer('image/png');
}
