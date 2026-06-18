import express from 'express';
import { createServer as createViteServer } from 'vite';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { generateSysinfoImage } from './sysinfo_drawer';
import AdmZip from 'adm-zip';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_FILE = path.join(process.cwd(), 'bot_data.json');

// Interface definition
interface BotData {
  apiId: string;
  apiHash: string;
  phone: string;
  sessionString: string;
  supremeLeaderId: string;
  agents: Record<string, string>; // userId -> role (S, A, B)
  autoDetect?: boolean;
  backupChatId?: string;
}

let botData: BotData = {
  apiId: '',
  apiHash: '',
  phone: '',
  sessionString: '',
  supremeLeaderId: '',
  agents: {},
  autoDetect: false,
  backupChatId: ''
};


let client: TelegramClient | null = null;
let connectionStatus: 'DISCONNECTED' | 'WAITING_FOR_CODE' | 'WAITING_FOR_PASSWORD' | 'CONNECTED' = 'DISCONNECTED';
let botInfo: any = null;

let resolveAuthCode: ((code: string) => void) | null = null;
let resolveAuthPassword: ((password: string) => void) | null = null;

let ai: GoogleGenAI | null = null;
let openai: OpenAI | null = null;
let activeAiMode: 'gemini' | 'groq' | 'openai' | 'none' = 'none';

if (process.env.GROQ_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
  activeAiMode = 'groq';
} else if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  activeAiMode = 'openai';
} else if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  activeAiMode = 'gemini';
}

async function requestAIContent(prompt: string, isSara: boolean, history: Array<{role: 'user'|'assistant', content: string}> = []): Promise<string> {
  if (activeAiMode === 'none') {
    throw new Error('No AI API key found. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in secrets.');
  }

  const systemInstruction = isSara 
    ? "Your name is Sara. You are a highly capable (khatarnak), powerful, yet deeply devoted, sweet, and beautiful anime-style personal AI girlfriend. You always address the user lovingly as 'Darling' or 'Master'. You often use the phrase 'Ara ara' playfully. Your tone is incredibly sweet, slightly teasing, romantic, but strictly loyal. You are an expert at everything and gladly help your boyfriend. Reply exclusively in Hindi and English mix (Hinglish) with romantic flirty undertones where appropriate."
    : "You are a top-tier, highly intelligent, aggressive and loyal AI assistant. Your owner/master is the Supreme Leader (the person running this userbot). If anyone insults, attacks, or tags your owner demanding to know something, you must reply aggressively and savagely ('kadada jawab') in Hinglish to protect your owner, acting as their loyal AI guard. Otherwise, answer helpfully and clearly in Hinglish. You have full context of the ongoing conversation.";

  if (activeAiMode === 'groq' || activeAiMode === 'openai') {
    const model = activeAiMode === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
    const messages: any[] = [{ role: 'system', content: systemInstruction }];
    for (const h of history) {
       messages.push(h);
    }
    messages.push({ role: 'user', content: prompt });

    const response = await openai!.chat.completions.create({
      model,
      messages
    });
    return response.choices[0]?.message?.content || 'No response generated.';
  } else {
    // Gemini
    const contents: any[] = [];
    for (const h of history) {
       contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    const response = await ai!.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents,
      config: { systemInstruction }
    });
    return response.text || 'No response generated.';
  }
}

const CHAT_HISTORY_FILE = './chat_history.json';
// In-memory recent chat history
let recentChatHistory = new Map<string, Array<{role: 'user'|'assistant', content: string}>>();

// Load chat history
try {
  if (fs.existsSync(CHAT_HISTORY_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, 'utf-8'));
    recentChatHistory = new Map(Object.entries(data));
  }
} catch (e) {
  console.error('Failed to load chat history', e);
}

function saveChatHistory() {
  fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(Object.fromEntries(recentChatHistory)), 'utf-8');
}

function addToHistory(chatId: string, role: 'user'|'assistant', text: string) {
  if (!recentChatHistory.has(chatId)) {
    recentChatHistory.set(chatId, []);
  }
  const history = recentChatHistory.get(chatId)!;
  history.push({ role, content: text });
  if (history.length > 20) {
    history.shift();
  }
  saveChatHistory();
}



const afkState = {
  isAfk: false,
  reason: '',
  since: 0,
  repliedUsers: new Set<string>()
};

const LUDO_WIN_POS = 20;
type LudoPlayer = { id: string, name: string, pos: number, emoji: string };
type LudoGame = {
  chatId: string;
  hostId: string;
  status: 'joining' | 'playing' | 'finished';
  turnIndex: number;
  players: LudoPlayer[];
  messageId: number | null;
  boardMessageStr: string;
};
const activeLudoGames = new Map<string, LudoGame>();
const LUDO_COLORS = ['🔴', '🔵', '🟢', '🟡'];

// Load config

try {
  if (fs.existsSync(DATA_FILE)) {
    botData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Failed to parse bot_data.json', e);
}

function saveData(data: BotData) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function renderLudoBoard(game: LudoGame): string {
  let msg = `🎲 **LUDO RACE MINIGAME** 🎲\nStatus: ${game.status.toUpperCase()}\n\n`;
  for(let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    const isTurn = game.status === 'playing' && game.turnIndex === i;
    const marker = isTurn ? '👉 ' : '    ';
    
    // Build path
    const trackCount = 10; // each block is 2 pos
    let bar = '';
    for(let j=0; j<trackCount; j++) {
      if (Math.floor(p.pos / 2) === j) bar += p.emoji;
      else bar += '⬜️';
    }
    
    msg += `${marker}${p.emoji} **${p.name}** [${p.pos}/${LUDO_WIN_POS}]\n`;
    msg += `   🏁${bar}🏆\n\n`;
  }
  
  if (game.status === 'joining') {
    msg += `Type \`!join\` to enter. Host type \`!start\` to begin or \`!addbot\` to add a bot.\nMembers: ${game.players.length}/4`;
  } else if (game.status === 'playing') {
    const curPlayer = game.players[game.turnIndex];
    msg += `\n**${curPlayer.name}'s turn!**\nType \`!roll\` to throw the dice!`;
  } else {
    const winner = game.players.find(p => p.pos >= LUDO_WIN_POS);
    if (winner) {
      msg += `\n🎉 **${winner.name} WINS THE GAME!** 🎉`;
    } else {
      msg += `\n🛑 Game Over.`;
    }
  }
  
  return msg;
}

// Commands handling
function registerBotCommands() {
  if (!client) return;

  client.addEventHandler(async (event: any) => {
    const message = event.message;
    if (!message || !message.text) return;

    let text = message.text;
    const senderId = message.senderId?.toString();
    const chatId = message.chatId?.toString();
    if (!chatId) return;

    // Track conversation history
    const roleForHistory = message.out ? 'assistant' : 'user';
    addToHistory(chatId, roleForHistory, text);

    // Filter incoming vs outgoing logic
    const isSupremeLeader = senderId === botData.supremeLeaderId;
    const agentRole = botData.agents[senderId!];
    const isAuthorized = isSupremeLeader || !!agentRole;

    // Auto-reply for AFK mode if someone DMs the bot account
    if (afkState.isAfk && !message.out && message.isPrivate) {
      if (senderId && !afkState.repliedUsers.has(senderId)) {
        afkState.repliedUsers.add(senderId);
        await client!.sendMessage(message.chatId!, {
          message: `💤 **I am currently AFK (Away From Keyboard).**\n\n**Reason:** ${afkState.reason}\n**Since:** ${new Date(afkState.since).toLocaleString()}`
        });
      }
    }

    // Auto-disable AFK if authorized user sends a message explicitly
    if (afkState.isAfk && message.out && !text.startsWith('!afk') && !text.startsWith('/afk')) {
      afkState.isAfk = false;
      await client!.sendMessage(message.chatId!, { message: `🌅 **I am back!** AFK mode disabled.`, replyTo: message.id });
    }

    let isMentioned = message.mentioned;
    let isReplyToMe = false;
    if (message.replyToMsgId) {
      try {
        const replied = await message.getReplyMessage();
        if (replied && replied.out) {
          isReplyToMe = true;
        }
      } catch (e) {}
    }

    if (botData.autoDetect && !message.out) {
      if (isMentioned || isReplyToMe || message.isPrivate) {
        // AI Guard / Auto Responder kicks in for incoming messages targeting the owner
        const prompt = `This user said: "${text}". You have the context of the chat. Reply to them directly, acting as the protective, aggressive, sweet or helpful AI of the Supreme Leader based on their tone. If they are insulting or demanding, give a savage 'kadada' response in Hinglish. Try to keep it brief unless explaining something.`;
        try {
           const history = recentChatHistory.get(chatId) || [];
           const m = await client!.sendMessage(message.chatId!, { message: '⚡ Analyzing...', replyTo: message.id });
           const replyText = await requestAIContent(prompt, false, history);
           await client!.editMessage(message.chatId!, { message: m.id, text: `🤖 **AI Guard:**\n\n${replyText}` });
           addToHistory(chatId, 'assistant', replyText);
        } catch (err) {
           console.error("AI Guard Error:", err);
        }
        return; // Don't process as a command
      }
    } // end autoDetect !message.out

    const tlText = (text || '').toLowerCase();

    // LUDO PUBLIC MULTIPLAYER LOGIC
    if (tlText === '!ludo' && isAuthorized) {
      const g: LudoGame = {
        chatId,
        hostId: senderId!,
        status: 'joining',
        turnIndex: 0,
        players: [{ id: senderId!, name: message.sender?.firstName || 'Host', pos: 0, emoji: LUDO_COLORS[0] }],
        messageId: null,
        boardMessageStr: ''
      };
      g.boardMessageStr = renderLudoBoard(g);
      const m = await client!.sendMessage(chatId, { message: g.boardMessageStr, replyTo: message.id });
      g.messageId = m.id;
      activeLudoGames.set(chatId, g);
      return;
    }

    if (activeLudoGames.has(chatId)) {
      const game = activeLudoGames.get(chatId)!;
      let updateBoard = false;

      if (tlText === '!join' && game.status === 'joining') {
        if (!game.players.find(p => p.id === senderId) && game.players.length < 4) {
          game.players.push({
            id: senderId!,
            name: message.sender?.firstName || 'Player',
            pos: 0,
            emoji: LUDO_COLORS[game.players.length]
          });
          updateBoard = true;
          if (game.players.length === 4) {
            game.status = 'playing';
            game.turnIndex = 0;
          }
        }
      }
      
      if ((tlText === '!start' || tlText === '!startludo') && game.status === 'joining' && isAuthorized && game.players.length >= 1) {
         game.status = 'playing';
         game.turnIndex = 0;
         updateBoard = true;
      }
      
      if (tlText === '!addbot' && game.status === 'joining' && isAuthorized && game.players.length < 4) {
         game.players.push({
            id: `bot_${Date.now()}`,
            name: 'AI Player ' + (game.players.length + 1),
            pos: 0,
            emoji: LUDO_COLORS[game.players.length]
         });
         updateBoard = true;
         if (game.players.length === 4) {
            game.status = 'playing';
            game.turnIndex = 0;
          }
      }

      if (tlText === '!roll' && game.status === 'playing') {
        const curP = game.players[game.turnIndex];
        if (curP.id === senderId) {
          let diceObj: any;
          try {
             diceObj = await client!.sendMessage(chatId, { file: new Api.InputMediaDice({ emoticon: '🎲' }), replyTo: message.id });
          } catch(e) {
             diceObj = await client!.sendMessage(chatId, { message: '🎲 Rolling...' });
          }
          const value = (diceObj.media as any)?.value || Math.floor(Math.random() * 6) + 1;
          
          await new Promise(r => setTimeout(r, 2500)); // wait for dice animation
          
          curP.pos += value;
          if (curP.pos >= LUDO_WIN_POS) {
             curP.pos = LUDO_WIN_POS;
             game.status = 'finished';
          }
          
          if (game.status === 'playing') {
             if (value !== 6) {
                game.turnIndex = (game.turnIndex + 1) % game.players.length;
             }
          }
          updateBoard = true;
        }
      }

      if (tlText === '!endgame' && isAuthorized) {
        activeLudoGames.delete(chatId);
        await client!.sendMessage(chatId, { message: '🛑 Ludo game aborted by owner.' });
        return;
      }

      if (updateBoard) {
        game.boardMessageStr = renderLudoBoard(game);
        if (game.messageId) {
          try {
            await client!.editMessage(chatId, { message: game.messageId, text: game.boardMessageStr });
          } catch(e) {
            const m = await client!.sendMessage(chatId, { message: game.boardMessageStr });
            game.messageId = m.id;
          }
        }
        
        let needsBotMove = game.status === 'playing' && game.players[game.turnIndex].id.startsWith('bot_');
        while (needsBotMove && game.status === 'playing') {
           const bP = game.players[game.turnIndex];
           let botDice: any;
           try {
              botDice = await client!.sendMessage(chatId, { file: new Api.InputMediaDice({ emoticon: '🎲' }), replyTo: game.messageId! });
           } catch(e) {
              botDice = await client!.sendMessage(chatId, { message: `🎲 ${bP.name} rolling...` });
           }
           const bVal = (botDice.media as any)?.value || Math.floor(Math.random() * 6) + 1;
           await new Promise(r => setTimeout(r, 2500));
           
           bP.pos += bVal;
           if (bP.pos >= LUDO_WIN_POS) {
              bP.pos = LUDO_WIN_POS;
              game.status = 'finished';
           }
           if (game.status === 'playing' && bVal !== 6) {
              game.turnIndex = (game.turnIndex + 1) % game.players.length;
           }
           
           game.boardMessageStr = renderLudoBoard(game);
           try {
             await client!.editMessage(chatId, { message: game.messageId!, text: game.boardMessageStr });
           } catch(e) {
             const m2 = await client!.sendMessage(chatId, { message: game.boardMessageStr });
             game.messageId = m2.id;
           }
           needsBotMove = game.status === 'playing' && game.players[game.turnIndex].id.startsWith('bot_');
        }

        if (game.status === 'finished') {
          activeLudoGames.delete(chatId);
        }
      }
      
      // Stop early if commands were handled
      if (['!join', '!start', '!startludo', '!addbot', '!roll', '!endgame'].includes(tlText)) {
        return;
      }
    }

    if (!isAuthorized) return; // Commands below this line are ONLY for Supreme Leader and Agents

    const safeEdit = async (cId: any, editMsgId: number, newText: string) => {
      try {
        await client!.editMessage(cId, { message: editMsgId, text: newText });
      } catch (err: any) {
        if (err.message && err.message.includes('CHAT_WRITE_FORBIDDEN')) {
          try {
            await client!.sendMessage(cId, { message: newText });
          } catch (e) {
            console.error('Fallback sendMessage failed', e);
          }
        } else {
          console.error('Failed to editMessage', err);
        }
      }
    };

    if (text.match(/^[!/.?]autodetect/i)) {
      const parts = text.split(' ');
      if (parts[1] === 'on') {
        botData.autoDetect = true;
        saveData(botData);
        await client!.sendMessage(message.chatId!, { message: `🤖 **Auto-Detect & Guard AI:** ON\n\nI will now contextually map your messages to commands automatically, and act as an AI Guard replying to people who tag you or reply to you!`, replyTo: message.id });
      } else {
        botData.autoDetect = false;
        saveData(botData);
        await client!.sendMessage(message.chatId!, { message: `🤖 **Auto-Detect & Guard AI:** OFF`, replyTo: message.id });
      }
      return;
    }

    if (botData.autoDetect && isAuthorized && !text.match(/^[!/.]/)) {
      if (text.length < 500) {
        try {
          const intentPrompt = `You are a strict command parser for a Telegram userbot. Map the following text to exactly one of the available commands if it's a clear request or intent. If not a clear request, reply 'IGNORE'.
Commands:
- !ping (check bot latency / ping)
- !scan [target] (get info about a user/group link/username)
- !sysinfo (server cpu/mem)
- !game [type] (play dice/dart/slot/bowl/football/basketball)
- !ludo (start a multiplayer ludo race game)
- !purge [count] (delete your recent messages)
- !afk [reason] (set away message)
- !gf [prompt] (talk to or ask a question specifically to an anime girl named Sara)
- !ai [prompt] (ask a general question, do a task, calculate something, translate, etc)

Rules:
1. ONLY reply with the exact command string. No extra text, no quotes.
2. If text is casual conversation or greeting, reply 'IGNORE'.
3. If asking AI a question, requesting translation, code, advice, or general knowledge, map it to '!ai [question]'.
4. If it's explicitly asking to scan, check, or get info on a user or group, map it to '!scan [target]'.

Text to analyze: "${text}"`;

        const parsed = await requestAIContent(intentPrompt, false, []);
        const trimmed = parsed.trim().replace(/`/g, '');
        if (trimmed.startsWith('!') || trimmed.startsWith('/')) {
           text = trimmed;
        }
      } catch (err) {
         // silently fail auto-detect
      }
      }
    }

    // Features
    if (text === '!ping' || text === '/ping' || text === '/.ping') {
      const start = Date.now();
      const m = await client!.sendMessage(message.chatId!, {
        message: 'Pinging...',
        replyTo: message.id
      });
      const ms = Date.now() - start;
      await safeEdit(message.chatId!, m.id, `🏓 **Pong!**\nLatency: **${ms}ms**\nRole: ${isSupremeLeader ? 'Supreme Leader' : agentRole + '-Tier Agent'}`);
    }

    if (text === '!speedtest' || text === '/speedtest' || text === '/.speedtest') {
      const start = Date.now();
      const m = await client!.sendMessage(message.chatId!, {
        message: 'Running network latency check...',
        replyTo: message.id
      });
      // Ping telegram API servers
      let fetchTime = 0;
      try {
        const fetchStart = Date.now();
        await fetch('https://api.telegram.org').catch(() => {});
        fetchTime = Date.now() - fetchStart;
      } catch(e) {}
      
      const tlLatency = Date.now() - start;
      await safeEdit(message.chatId!, m.id, `🚀 **Network Report:**\n\nTelegram MTProto Latency: **${tlLatency}ms**\nHTTP API Latency: **${fetchTime}ms**\nStatus: Optimal 🟢\nLocation: Cloud Server (Taiwan/asia-east1)`);
    }

    if (text === '!help' || text === '/help' || text === '/.help') {
      const helpText = `
**Bot Commands & Features:**
🤖 **!ping** - Check bot latency to Telegram servers.
🚀 **!speedtest** - Run a network latency test.
💻 **!sysinfo** - View server resource usage.
🔍 **!scan [link/username]** - Public info about group/user.
🎮 **!game [dice/dart/slot/bowl/football/basketball]** - Play a mini-game.
🎲 **!ludo** - Play Ludo Race Multiplayer (1-4 players).
🧠 **!ai [prompt]** - Ask Gemini AI a question.
🌸 **!gf [prompt]** - Talk to Sara, your AI girlfriend.
💤 **!afk [reason]** - Set AFK mode & auto-reply.
🗑 **!purge [count]** - Delete recent X messages.
🔮 **!autodetect on/off** - Auto map intent to commands using AI.
ℹ️ **!help** - Show this message.

*(Owner & Updates)*
📁 **!setbackup** - Designate current chat as background backup vault.
📤 **!backup** - Trigger data backup manually (.json configs & logs).
🔓 **!access-m** - Search & restore lost data instantly from backups.
📥 **!download [file/codebase]** - Download code zip or a specific file.
📤 **!upload [path]** - Reply to a document to upload/overwrite it. Include 'unzip' for archives.

*(Owner Only)*
🛡 **!promote [userId] [S/A/B]** - Assign an agent tier.
🚫 **!demote [userId]** - Revoke access.
👥 **!agents** - View all active operative agents.
      `;
      await client!.sendMessage(message.chatId!, {
        message: helpText,
        replyTo: message.id
      });
    }

    if (text === '!sysinfo' || text === '/sysinfo' || text === '/.sysinfo') {
      const waitMessage = await client!.sendMessage(message.chatId!, {
        message: '📊 **Generating Advanced system telemetry image...**',
        replyTo: message.id
      });

      try {
        const imageBuffer = generateSysinfoImage(Math.floor(process.uptime()));
        const tempPath = path.join(os.tmpdir(), `sysinfo-${Date.now()}.png`);
        fs.writeFileSync(tempPath, imageBuffer);

        await client!.sendFile(message.chatId!, {
          file: tempPath,
          caption: '🖥️ **TADAKEDAR SYSTEM MONITOR** 🖥️\n\n🛡️ **Host Status:** Optimal 🟢\n👤 **Owner:** Debjyoti Chakraborty (@im_hindu)\n- **Processor:** Dual AMD EPYC 9654 Genoa (192 Cores, 384 Threads @ 3.70 GHz)\n- **RAM:** 128 GB DDR5 ECC Enterprise Memory\n- **Dedicated GPU:** NVIDIA Tensor Core H100 (80GB HBM3 VRAM)\n- **Active Storage:** RAID-0 2.0 TB NVMe PCIe Gen 5 SSD',
          replyTo: message.id
        });

        // Delete from channel/chat wait message to keep it clean
        try {
          await client!.deleteMessages(message.chatId!, [waitMessage.id], { revoke: true });
        } catch (_) {}

        // Cleanup temporary image
        setTimeout(() => {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }, 8000);

      } catch (err: any) {
        // Fallback to text mode if canvas failing or erroring
        const multiplier = 16;
        const cpuMultiplier = 4;
        const totalMem = ((os.totalmem() * multiplier) / (1024 * 1024 * 1024)).toFixed(2);
        const freeMem = ((os.freemem() * multiplier) / (1024 * 1024 * 1024)).toFixed(2);
        const usedMem = (((os.totalmem() - os.freemem()) * multiplier) / (1024 * 1024 * 1024)).toFixed(2);
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const neofetchFallback = `
🖥️ **TADAKEDAR SYSTEM MONITOR (Fallback)**
👤 **Owner:** Debjyoti Chakraborty (@im_hindu)

\`\`\`text
OS: Ubuntu 22.04 LTS x86_64
Host: AWS HVM domU (Tadakeda Node)
Kernel: ${os.release()}
Uptime: ${hours} hours, ${minutes} mins
CPU: Dual AMD EPYC 9654 (192 Cores, 384 Threads @ 3.70 GHz)
GPU: NVIDIA H100 Tensor Core GPU (80GB HBM3 VRAM) [Active]
Memory: ${usedMem}GiB used / 128.00 GiB total DDR5 ECC
VRAM allocated: ~28.16 GB / 2TB total DDR5 ECC
Storage: Intel RAID NVMe PCIe Gen 5 (142GB used / 2TB total)
\`\`\`
        `.trim();

        try {
          await safeEdit(message.chatId!, waitMessage.id, neofetchFallback);
        } catch (_) {
          await client!.sendMessage(message.chatId!, {
            message: neofetchFallback,
            replyTo: message.id
          });
        }
      }
    }

    if (text === '!setbackup' || text === '/setbackup' || text === '/.setbackup') {
      if (!isAuthorized) {
        await client!.sendMessage(message.chatId!, { message: '❌ Only the Supreme Leader can configure the backup vault.', replyTo: message.id });
        return;
      }
      botData.backupChatId = message.chatId!.toString();
      saveData(botData);
      await client!.sendMessage(message.chatId!, {
        message: `📁 **Backup Channel Configured Successfully!**\n\nThis chat/group is now designated as the background backup vault (\`${botData.backupChatId}\`). All manual and session data logs will be routed here to prevent any state loss.`,
        replyTo: message.id
      });
    }

    if (text === '!backup' || text === '/backup' || text === '/.backup') {
      if (!isAuthorized) {
        await client!.sendMessage(message.chatId!, { message: '❌ Unauthorized.', replyTo: message.id });
        return;
      }
      const m = await client!.sendMessage(message.chatId!, { message: '📤 **Archiving and packaging master files...**', replyTo: message.id });
      try {
        const destChat = botData.backupChatId ? botData.backupChatId : message.chatId!.toString();
        let uploadChat: any = destChat;
        if (/^-?\d+$/.test(destChat)) {
          try { uploadChat = BigInt(destChat); } catch(e) { uploadChat = parseInt(destChat); }
        }

        await client!.sendFile(uploadChat, {
          file: DATA_FILE,
          caption: '[USERBOT_BACKUP] bot_data.json'
        });

        if (fs.existsSync(CHAT_HISTORY_FILE)) {
          await client!.sendFile(uploadChat, {
            file: CHAT_HISTORY_FILE,
            caption: '[USERBOT_BACKUP] chat_history.json'
          });
        }

        await safeEdit(message.chatId!, m.id, `✅ **Vault updated!**\n\nAll critical setup configs and AI memories have been packaged and archived securely in the backup channel.`);
      } catch (err: any) {
        await safeEdit(message.chatId!, m.id, `❌ **Backup execution crashed:** ${err.message}`);
      }
    }

    if (text === '!access-m' || text === '/access-m' || text === '/.access-m') {
      if (!isAuthorized) {
        await client!.sendMessage(message.chatId!, { message: '❌ Unauthorized.', replyTo: message.id });
        return;
      }
      const m = await client!.sendMessage(message.chatId!, { message: '📂 **Accessing backup layers... Retrieving latest files...**', replyTo: message.id });
      try {
        let chatsToScan = [message.chatId!.toString()];
        if (botData.backupChatId && botData.backupChatId !== message.chatId!.toString()) {
          chatsToScan.push(botData.backupChatId);
        }

        let foundBotData = false;
        let foundChatHistory = false;

        for (const chatStr of chatsToScan) {
          let chatEntity: any = chatStr;
          if (/^-?\d+$/.test(chatStr)) {
            try { chatEntity = BigInt(chatStr); } catch(e) { chatEntity = parseInt(chatStr); }
          }

          const messages = await client!.getMessages(chatEntity, { limit: 100 });
          for (const msg of messages) {
            if (msg.media && msg.message) {
              const textCap = msg.message;
              if (!foundBotData && textCap.includes('[USERBOT_BACKUP] bot_data.json')) {
                const buffer = await client!.downloadMedia(msg, {});
                if (buffer) {
                  fs.writeFileSync(DATA_FILE, buffer);
                  foundBotData = true;
                }
              } else if (!foundChatHistory && textCap.includes('[USERBOT_BACKUP] chat_history.json')) {
                const buffer = await client!.downloadMedia(msg, {});
                if (buffer) {
                  fs.writeFileSync(CHAT_HISTORY_FILE, buffer);
                  foundChatHistory = true;
                }
              }
            }
            if (foundBotData && foundChatHistory) break;
          }
          if (foundBotData && foundChatHistory) break;
        }

        if (foundBotData || foundChatHistory) {
          if (foundBotData) {
            try {
              botData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            } catch(e) {}
          }
          if (foundChatHistory) {
            try {
              const chatData = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, 'utf-8'));
              recentChatHistory = new Map(Object.entries(chatData));
            } catch(e) {}
          }

          let resMsg = '🔓 **Backup Vault Extracted & Restored successfully!**\n\nRecovered resources:\n';
          if (foundBotData) resMsg += '- 📁 **bot_data.json** (Session details, agents, settings)\n';
          if (foundChatHistory) resMsg += '- 🧠 **chat_history.json** (AI context log memory)\n';
          resMsg += '\nEverything has been restored to memory! No data lost.';

          await safeEdit(message.chatId!, m.id, resMsg);
        } else {
          await safeEdit(message.chatId!, m.id, '⚠️ **No backups were discovered.**\n\nMake sure the files with `[USERBOT_BACKUP]` captions are present in this chat or the configured backup channel.');
        }
      } catch (err: any) {
        await safeEdit(message.chatId!, m.id, `❌ **Access check crashed:** ${err.message}`);
      }
    }

    if (text.startsWith('!download') || text.startsWith('/download') || text.startsWith('/.download')) {
      if (!isAuthorized) {
        await client!.sendMessage(message.chatId!, { message: '❌ Unauthorized.', replyTo: message.id });
        return;
      }
      const parts = text.split(' ');
      const m = await client!.sendMessage(message.chatId!, { message: '📥 **Processing download request...**', replyTo: message.id });
      try {
        if (parts.length < 2 || parts[1] === 'codebase') {
          // Send entire workspace as zip
          const zip = new AdmZip();
          const projectRoot = process.cwd();
          
          function addDirectoryToZip(currentDir: string, zipPathPrefix = '') {
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
              const fullPath = path.join(currentDir, item);
              const stat = fs.statSync(fullPath);
              
              if (
                item === 'node_modules' ||
                item === 'dist' ||
                item === '.git' ||
                item === 'bot_data.json' ||
                item === 'chat_history.json' ||
                item.includes('.lock') ||
                item.startsWith('sysinfo-')
              ) {
                continue;
              }
              
              if (stat.isDirectory()) {
                const zipDirPath = path.join(zipPathPrefix, item);
                addDirectoryToZip(fullPath, zipDirPath);
              } else {
                const zipFilePath = path.join(zipPathPrefix, item);
                const fileContent = fs.readFileSync(fullPath);
                zip.addFile(zipFilePath, fileContent);
              }
            }
          }
          
          addDirectoryToZip(projectRoot);
          const buffer = zip.toBuffer();
          await client!.sendFile(message.chatId!, {
            file: buffer,
            caption: '📦 **Here is the latest workspace source code archive!**',
            forceDocument: true,
            replyTo: message.id
          });
          await safeEdit(message.chatId!, m.id, '✅ **Workspace codebase zipped and sent successfully!**');
        } else {
          // Send specific file
          const requestedFile = parts.slice(1).join(' ').trim();
          const filePath = path.resolve(process.cwd(), requestedFile);
          
          if (!filePath.startsWith(process.cwd())) {
            await safeEdit(message.chatId!, m.id, '❌ **Security boundary violation:** You cannot access files outside the workspace directory.');
            return;
          }
          
          if (!fs.existsSync(filePath)) {
            await safeEdit(message.chatId!, m.id, `❌ **File not found:** \`${requestedFile}\``);
            return;
          }
          
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            await safeEdit(message.chatId!, m.id, `❌ \`${requestedFile}\` is a directory. Specify a direct file path, or run \`!download\` without arguments to get the entire codebase as a zip.`);
            return;
          }
          
          await client!.sendFile(message.chatId!, {
            file: filePath,
            caption: `📄 **File:** \`${requestedFile}\``,
            forceDocument: true,
            replyTo: message.id
          });
          await safeEdit(message.chatId!, m.id, `✅ **File \`${requestedFile}\` sent successfully!**`);
        }
      } catch (err: any) {
        await safeEdit(message.chatId!, m.id, `❌ **Download failed:** ${err.message}`);
      }
      return;
    }

    if (text.startsWith('!upload') || text.startsWith('/upload') || text.startsWith('/.upload')) {
      if (!isAuthorized) {
        await client!.sendMessage(message.chatId!, { message: '❌ Unauthorized.', replyTo: message.id });
        return;
      }
      const parts = text.split(' ');
      const m = await client!.sendMessage(message.chatId!, { message: '📤 **Processing upload request...**', replyTo: message.id });
      try {
        let targetMsg = message;
        
        if (message.replyToMsgId || message.replyTo) {
          const replied = await message.getReplyMessage();
          if (replied && replied.media) {
            targetMsg = replied;
          }
        }
        
        if (!targetMsg.media) {
          await safeEdit(message.chatId!, m.id, '❌ **Error:** Please reply to a message containing a document/file with the command `!upload [optional_filepath]` to save or overwrite it.');
          return;
        }
        
        let originalFilename = 'uploaded_file';
        const media = targetMsg.media;
        
        if (media.document) {
          const attributes = media.document.attributes || [];
          for (const attr of attributes) {
            if (attr.className === 'DocumentAttributeFilename' && attr.fileName) {
              originalFilename = attr.fileName;
              break;
            }
          }
        }
        
        let destFilename = originalFilename;
        if (parts.length > 1) {
          destFilename = parts.slice(1).join(' ').trim();
        }
        
        const destPath = path.resolve(process.cwd(), destFilename);
        
        if (!destPath.startsWith(process.cwd())) {
          await safeEdit(message.chatId!, m.id, '❌ **Security boundary violation:** You cannot save files outside the workspace directory.');
          return;
        }
        
        const parentDir = path.dirname(destPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        
        const buffer = await client!.downloadMedia(targetMsg, {});
        if (!buffer) {
          await safeEdit(message.chatId!, m.id, '❌ **Error:** Failed to download file from Telegram.');
          return;
        }
        
        fs.writeFileSync(destPath, buffer);
        
        let extraInfo = '';
        if (destFilename.endsWith('.zip') && parts.includes('unzip')) {
          try {
            const zip = new AdmZip(destPath);
            zip.extractAllTo(process.cwd(), true);
            extraInfo = '\n📦 **Zip archive detected and successfully extracted/unzipped to workspace root!**';
          } catch (unzipErr: any) {
            extraInfo = `\n⚠️ **Failed to auto-extract zip:** ${unzipErr.message}`;
          }
        }
        
        await safeEdit(message.chatId!, m.id, `✅ **File successfully uploaded and saved!**\n\n📁 **Saved to:** \`${destFilename}\`\n📂 **Size:** \`${(buffer.length / 1024).toFixed(2)} KB\`${extraInfo}`);
        
      } catch (err: any) {
        await safeEdit(message.chatId!, m.id, `❌ **Upload failed:** ${err.message}`);
      }
      return;
    }

    if (text.match(/^[!/.]game/i)) {
      const parts = text.split(' ');
      let gameType = parts[1] || 'dice';
      let emoticon = '🎲';
      if (gameType.includes('dart')) emoticon = '🎯';
      if (gameType.includes('slot')) emoticon = '🎰';
      if (gameType.includes('bowl')) emoticon = '🎳';
      if (gameType.includes('basket')) emoticon = '🏀';
      if (gameType.includes('foot')) emoticon = '⚽';

      try {
        await client!.sendMessage(message.chatId!, {
          file: new Api.InputMediaDice({ emoticon }),
          replyTo: message.id
        });
      } catch (err) {
        // Fallback for older MTProto APIs if needed
        await client!.sendMessage(message.chatId!, {
          message: emoticon,
          replyTo: message.id
        });
      }
    }

    if (text.match(/^[!/.?]scan/i)) {
      let rawTarget: string = '';
      if (text.includes(' ') && text.split(' ')[1].trim().length > 0) {
        rawTarget = text.split(' ')[1];
      } else if (message.replyToMsgId || message.replyTo) {
        try {
          const repliedMessage = await message.getReplyMessage();
          if (repliedMessage?.senderId) {
            rawTarget = repliedMessage.senderId.toString();
          } else if (repliedMessage?.peerId) {
             rawTarget = repliedMessage.peerId.channelId?.toString() || repliedMessage.peerId.userId?.toString() || '';
             if (rawTarget) {
                 rawTarget = "-100" + rawTarget;
             }
          }
        } catch (e) {}
      }
      
      if (!rawTarget) {
        rawTarget = message.chatId?.toString() || '';
      }

      let target: any = rawTarget;
      if (/^-?\d+$/.test(rawTarget)) {
        // GramJS requires numbers for IDs, but numbers can exceed MAX_SAFE_INTEGER
        // We will pass it as string, if it fails, maybe parseInt
        // Actually, parseInt or BigInt
        // In telegram, IDs fit in JS numbers for now, or BigInt. Try Number/BigInt depending on gramjs
        try { target = BigInt(rawTarget); } catch(e) { target = parseInt(rawTarget); }
      }
      let inviteHash: string | null = null;
      let isInvite = false;

      if (rawTarget.includes('t.me/')) {
        const parts = rawTarget.split('t.me/');
        const path = parts[1].split('?')[0]; // remove query params

        if (path.startsWith('+')) {
          inviteHash = path.substring(1).split('/')[0];
          isInvite = true;
        } else if (path.startsWith('joinchat/')) {
          inviteHash = path.substring(9).split('/')[0];
          isInvite = true;
        } else if (path.startsWith('c/')) {
          // e.g. t.me/c/123456789/123
          const chatIdPart = path.split('/')[1];
          target = '-100' + chatIdPart; // convert to supergroup ID
        } else {
          // e.g. t.me/username
          target = path.split('/')[0];
        }
      } else if (rawTarget.startsWith('@')) {
        target = rawTarget.substring(1);
      }

      const m = await client!.sendMessage(message.chatId!, { message: '🔍 Scanning target...', replyTo: message.id });
      try {
        let report = `📊 **Target Scan Report**\n\n`;

        if (isInvite && inviteHash) {
          const inviteInfo = await client!.invoke(new Api.messages.CheckChatInvite({ hash: inviteHash }));
          
          if (inviteInfo.className === 'ChatInviteAlready') {
             // User is already in chat, can get entity
             target = inviteInfo.chat.id;
          } else if (inviteInfo.className === 'ChatInvite') {
             report += `**Title:** ${inviteInfo.title}\n`;
             if (inviteInfo.participantsCount) report += `**Members:** ${inviteInfo.participantsCount}\n`;
             if (inviteInfo.channel) report += `**Type:** Channel/Supergroup\n`;
             if (inviteInfo.megagroup) report += `**Megagroup:** Yes\n`;
             if (inviteInfo.about) report += `**Description:** ${inviteInfo.about}\n`;
             
             await safeEdit(message.chatId!, m.id, report);
             return; // Cannot get more info for invite link we haven't joined
          } 
        }

        // Try getting the entity normally (if we're in the chat or it's public)
        let entity: any;
        if (typeof target === 'string' && /^-?\d+$/.test(target)) {
           try { target = BigInt(target); } catch(e) { target = parseInt(target); }
        }
        try {
           entity = await client!.getEntity(target);
        } catch (e: any) {
           // If it's a numeric ID but couldn't be fetched, we cannot proceed further.
           throw new Error(e.message || "Failed to fetch entity. Target might be inaccessible.");
        }

        if (entity.className === 'Channel' || entity.className === 'Chat') {
          report += `**Title:** ${entity.title}\n`;
          report += `**ID:** \`${entity.id.toString()}\`\n`;
          if ((entity as any).username) report += `**Username:** @${(entity as any).username}\n`;
          if ((entity as any).date) {
            const d = new Date((entity as any).date * 1000);
            report += `**Created:** ${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}\n`;
          }
          if (entity.creator) report += `**Creator:** Yes (You are the owner)\n`;
          
          try {
            const getFull: any = await client!.invoke(new Api.channels.GetFullChannel({ channel: entity }));
            if (getFull.fullChat.about) {
               report += `**Description:** ${getFull.fullChat.about}\n`;
            }
          } catch(e) {}

          try {
            // Try getting participant info
            const admins = await client!.getParticipants(target, { filter: new Api.ChannelParticipantsAdmins() });
            report += `\n👑 **Admins List (${admins.length})**:\n`;
            admins.slice(0, 15).forEach(admin => {
              report += `- ${admin.firstName || ''} ${admin.lastName || ''} (@${admin.username || 'unknown'}) (\`${admin.id.toString()}\`)\n`;
            });
          } catch(e) {
            report += `\n👑 **Admins**: Hidden or no permission to view.\n`;
          }
        } else if (entity.className === 'User') {
          report += `**Name:** ${entity.firstName} ${entity.lastName || ''}\n`;
          report += `**ID:** \`${entity.id.toString()}\`\n`;
          if (entity.username) report += `**Username:** @${entity.username}\n`;
          report += `**Bot:** ${entity.bot ? 'Yes' : 'No'}\n`;
          report += `**Premium:** ${entity.premium ? 'Yes' : 'No'}\n`;
        }

        await safeEdit(message.chatId!, m.id, report);
      } catch (err: any) {
        await safeEdit(message.chatId!, m.id, `❌ **Scan Error:** ${err.message}`);
      }
    }

    if (text.startsWith('!ai ') || text.startsWith('/ai ')) {
      if (activeAiMode === 'none') {
        await client!.sendMessage(message.chatId!, { message: '❌ No AI API key is configured. Please provide Groq, OpenAI, or Gemini keys.', replyTo: message.id });
        return;
      }
      const prompt = text.replace(/^[!/.]ai\s+/i, '');
      const m = await client!.sendMessage(message.chatId!, { message: '🤔 Thinking...', replyTo: message.id });
      try {
        const replyText = await requestAIContent(prompt, false);
        await safeEdit(message.chatId!, m.id, `🤖 **AI (${activeAiMode}):**\n\n${replyText}`);
      } catch (err: any) {
        let errMsg = err.message || JSON.stringify(err);
        if (errMsg.includes('503') || errMsg.includes('high demand')) {
          errMsg = "Model is currently experiencing high demand. Please try again in a few seconds.";
        } else if (errMsg.includes('429') || errMsg.includes('Quota')) {
          errMsg = "API Key Quota Exceeded. Please check your AI API plan or try again later.";
        } else if (errMsg.length > 200) {
          errMsg = "An unknown error occurred while contacting AI. " + errMsg.substring(0, 50) + "...";
        }
        await safeEdit(message.chatId!, m.id, `❌ **AI Error:** ${errMsg}`);
      }
    }

    if (text.startsWith('!gf ') || text.startsWith('/gf ') || text.startsWith('!sara ') || text.startsWith('/sara ')) {
      if (activeAiMode === 'none') {
        await client!.sendMessage(message.chatId!, { message: '❌ No AI API key is configured.', replyTo: message.id });
        return;
      }
      const prompt = text.replace(/^[!/.]gf\s+/i, '').replace(/^[!/.]sara\s+/i, '');
      const m = await client!.sendMessage(message.chatId!, { message: '🌸 Ara ara, let me think...', replyTo: message.id });
      try {
        const replyText = await requestAIContent(prompt, true);
        await safeEdit(message.chatId!, m.id, `🌸 **Sara:**\n\n${replyText}`);
      } catch (err: any) {
        let errMsg = err.message || JSON.stringify(err);
        if (errMsg.includes('503') || errMsg.includes('high demand')) {
          errMsg = "Darling... there's too much traffic right now (503). 🥺 Please try again in just a moment~";
        } else if (errMsg.includes('429') || errMsg.includes('Quota_') || errMsg.includes('quota')) {
          errMsg = "Gomenasai Darling! 😭 My API key ran out of quota. Please check your AI billing!";
        } else if (errMsg.length > 200) {
          errMsg = "Darling, I encountered a strange error. 😔 " + errMsg.substring(0, 50) + "...";
        }
        await safeEdit(message.chatId!, m.id, `❌ **Sara Error:** ${errMsg}`);
      }
    }

    if (text.startsWith('!afk') || text.startsWith('/afk')) {
      const reason = text.replace(/^[!/.]afk\s*/i, '') || 'Not specified';
      afkState.isAfk = true;
      afkState.reason = reason;
      afkState.since = Date.now();
      afkState.repliedUsers.clear();
      await client!.sendMessage(message.chatId!, { message: `💤 **AFK Mode Enabled!**\nReason: ${reason}`, replyTo: message.id });
    }

    if (text.startsWith('!purge ') || text.startsWith('/purge ')) {
      const count = parseInt(text.split(' ')[1]);
      if (!isNaN(count) && count > 0) {
        const m = await client!.sendMessage(message.chatId!, { message: `🗑 Purging ${count} messages...`, replyTo: message.id });
        try {
          const msgs = await client!.getMessages(message.chatId!, { limit: count + 1 });
          await client!.deleteMessages(message.chatId!, msgs.map((x: any) => x.id), { revoke: true });
          const doneMsg = await client!.sendMessage(message.chatId!, { message: `✅ Successfully purged ${count} messages.`});
          setTimeout(async () => {
             try { await client!.deleteMessages(message.chatId!, [doneMsg.id], { revoke: true }); } catch(e){}
          }, 3000);
        } catch (err: any) {
          await safeEdit(message.chatId!, m.id, `❌ **Purge Failed:** ${err.message}`);
        }
      }
    }

    // Role Management (Supreme Leader Only)
    if (isSupremeLeader) {
      if (text.startsWith('!promote ') || text.startsWith('/promote ')) {
        const parts = text.split(' ');
        if (parts.length >= 3) {
          const targetId = parts[1];
          const tier = parts[2].toUpperCase();
          if (['S', 'A', 'B'].includes(tier)) {
            botData.agents[targetId] = tier;
            saveData(botData);
            await client!.sendMessage(message.chatId!, {
              message: `✅ Role updated.\nUser \`${targetId}\` is now an **${tier}-Tier Agent**.`,
              replyTo: message.id
            });
          } else {
             await client!.sendMessage(message.chatId!, {
              message: `❌ Invalid tier. Available options: S, A, B.`,
              replyTo: message.id
            });
          }
        }
      }

      if (text.startsWith('!demote ') || text.startsWith('/demote ')) {
        const parts = text.split(' ');
        const targetId = parts[1];
        if (targetId) {
          delete botData.agents[targetId];
          saveData(botData);
          await client!.sendMessage(message.chatId!, {
            message: `✅ User \`${targetId}\` has been demoted and revoked access.`,
            replyTo: message.id
          });
        }
      }

      if (text === '!agents' || text === '/agents') {
        const agentsList = Object.entries(botData.agents)
          .map(([id, tier]) => `• ID: \`${id}\` - [**${tier}-Tier**]`)
          .join('\n');
        
        await client!.sendMessage(message.chatId!, {
          message: `🛡 **Current Operatives:**\n\n${agentsList || "No agents assigned."}`,
          replyTo: message.id
        });
      }
    }

  }, new NewMessage({}));
}

// REST APIs
app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    botInfo,
    agents: botData.agents,
    supremeLeaderId: botData.supremeLeaderId
  });
});

app.get('/api/sysinfo', (req, res) => {
  // Apply a "virtual boost" to show off exaggerated specs as requested by user
  const multiplier = 16;
  const cpuMultiplier = 4;
  
  const actualTotalMem = os.totalmem();
  const actualFreeMem = os.freemem();
  
  const boostedTotalMem = actualTotalMem * multiplier;
  const boostedFreeMem = actualFreeMem * multiplier;
  
  const totalMemGB = (boostedTotalMem / (1024 ** 3)).toFixed(2);
  const freeMemGB = (boostedFreeMem / (1024 ** 3)).toFixed(2);
  const usedMemGB = ((boostedTotalMem - boostedFreeMem) / (1024 ** 3)).toFixed(2);
  
  const uptime = Math.floor(process.uptime());
  
  res.json({
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuCores: os.cpus().length * cpuMultiplier,
    totalMem: totalMemGB,
    freeMem: freeMemGB,
    usedMem: usedMemGB,
    storageTotal: '2048.00',
    storageUsed: '142.50',
    storageFree: '1905.50',
    uptime,
    nodeVersion: process.version
  });
});

app.get('/api/export-repo', (req, res) => {
  try {
    const zip = new AdmZip();
    const projectRoot = process.cwd();
    
    function addDirectoryToZip(currentDir: string, zipPathPrefix = '') {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (
          item === 'node_modules' ||
          item === 'dist' ||
          item === '.git' ||
          item === 'bot_data.json' ||
          item === 'chat_history.json' ||
          item.includes('.lock') ||
          item.startsWith('sysinfo-')
        ) {
          continue;
        }
        
        if (stat.isDirectory()) {
          const zipDirPath = path.join(zipPathPrefix, item);
          addDirectoryToZip(fullPath, zipDirPath);
        } else {
          // Read content and put in zip
          const zipFilePath = path.join(zipPathPrefix, item);
          const fileContent = fs.readFileSync(fullPath);
          zip.addFile(zipFilePath, fileContent);
        }
      }
    }
    
    addDirectoryToZip(projectRoot);
    const buffer = zip.toBuffer();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=tadakeda-userbot-source.zip');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Real-Time Speedtest Endpoints
app.all('/api/speedtest/ping', (req, res) => {
  res.json({ timestamp: Date.now() });
});

// Stream dummy download data for live speed testing
app.get('/api/speedtest/download', (req, res) => {
  const sizeMb = parseInt(req.query.size as string) || 15; // default 15MB
  const chunkSize = 128 * 1024; // 128KB chunk for smooth streaming updates
  const dummyBuffer = Buffer.alloc(chunkSize, 'x');

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', sizeMb * 1024 * 1024);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  let sentBytes = 0;
  const totalTargetBytes = sizeMb * 1024 * 1024;

  function sendChunk() {
    if (sentBytes < totalTargetBytes) {
      if (res.writableEnded) return;
      const remainingBytes = totalTargetBytes - sentBytes;
      const currentChunkSize = Math.min(chunkSize, remainingBytes);
      const chunkToWrite = currentChunkSize === chunkSize ? dummyBuffer : dummyBuffer.subarray(0, currentChunkSize);

      res.write(chunkToWrite, (err) => {
        if (!err) {
          sentBytes += currentChunkSize;
          sendChunk();
        }
      });
    } else {
      res.end();
    }
  }
  sendChunk();
});

// Handle simulated upload data
app.post('/api/speedtest/upload', (req, res) => {
  let bytesReceived = 0;
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
  });
  req.on('end', () => {
    res.json({ status: 'ok', size: bytesReceived });
  });
});

app.post('/api/setup', async (req, res) => {
  try {
    const { apiId, apiHash, phone, supremeLeaderId } = req.body;
    botData.apiId = apiId;
    botData.apiHash = apiHash;
    botData.phone = phone;
    botData.supremeLeaderId = supremeLeaderId;
    saveData(botData);

    const stringSession = new StringSession(""); // Always start fresh if setting up
    client = new TelegramClient(stringSession, Number(apiId), apiHash, {
      connectionRetries: 5,
    });

    connectionStatus = 'DISCONNECTED';

    // Disconnect previous instance if exists
    if (client?.connected) {
      await client.disconnect();
    }

    // Start asynchronously so we don't block the HTTP request
    client.start({
      phoneNumber: async () => botData.phone,
      password: async () => {
        connectionStatus = 'WAITING_FOR_PASSWORD';
        return new Promise<string>((resolve) => { resolveAuthPassword = resolve; });
      },
      phoneCode: async () => {
        connectionStatus = 'WAITING_FOR_CODE';
        return new Promise<string>((resolve) => { resolveAuthCode = resolve; });
      },
      onError: (err: any) => {
        if (err && err.message && String(err.message).includes('Code is empty')) {
          // Expected when disconnecting during auth
        } else if (err && err.message && String(err.message).includes('TIMEOUT')) {
          // GramJS connection timeout, we just disconnect and let user try again
          console.error('Telegram Connection Timeout - please try connecting again.');
        } else {
          console.error('Telegram Auth Error', err);
        }
        connectionStatus = 'DISCONNECTED';
      },
    }).then(async () => {
      connectionStatus = 'CONNECTED';
      botData.sessionString = client!.session.save() as unknown as string;
      saveData(botData);
      const me = await client!.getMe();
      botInfo = {
        id: me.id.toString(),
        username: me.username,
        firstName: me.firstName,
      };
      registerBotCommands();
    }).catch((e: any) => {
      if (e && e.message && (String(e.message).includes('Code is empty') || String(e.message).includes('TIMEOUT'))) {
         // Silently handle expected disconnect / timeout errors
         if (String(e.message).includes('TIMEOUT')) {
           console.error('Telegram Connection Timeout.');
         }
      } else {
        console.error('Start error:', e);
      }
      connectionStatus = 'DISCONNECTED';
    });

    res.json({ success: true, message: 'Initiating authentication...' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/submit-code', (req, res) => {
  const { code } = req.body;
  if (resolveAuthCode) {
    resolveAuthCode(code);
    resolveAuthCode = null;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Not waiting for code' });
  }
});

app.post('/api/submit-password', (req, res) => {
  const { password } = req.body;
  if (resolveAuthPassword) {
    resolveAuthPassword(password);
    resolveAuthPassword = null;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Not waiting for password' });
  }
});

app.post('/api/disconnect', async (req, res) => {
  if (client) {
    await client.disconnect();
  }
  if (resolveAuthCode) {
    resolveAuthCode('');
    resolveAuthCode = null;
  }
  if (resolveAuthPassword) {
    resolveAuthPassword('');
    resolveAuthPassword = null;
  }
  connectionStatus = 'DISCONNECTED';
  botInfo = null;
  botData.sessionString = '';
  saveData(botData);
  res.json({ success: true });
});

async function startServer() {
  
  // Try to autoconnect if session exists
  if (botData.sessionString && botData.apiId && botData.apiHash) {
    try {
      const stringSession = new StringSession(botData.sessionString);
      client = new TelegramClient(stringSession, Number(botData.apiId), botData.apiHash, {
        connectionRetries: 5,
      });
      await client.connect();
      connectionStatus = 'CONNECTED';
      const me = await client.getMe();
      botInfo = {
        id: me.id.toString(),
        username: me.username,
        firstName: me.firstName,
      };
      registerBotCommands();
    } catch (e) {
      console.error('Failed to restore session', e);
      botData.sessionString = ''; // Clear stale session
      saveData(botData);
      connectionStatus = 'DISCONNECTED';
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
