---
title: Agentcore
emoji: 🤖
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Agentcore Telegram Userbot

A powerful Telegram Userbot with a web dashboard for setup and management.

## Deployment on Hugging Face Spaces

This app is configured to run out-of-the-box as a Docker space on Hugging Face.

1. Ensure the space is set to the **Docker** SDK.
2. Upload all files (including `Dockerfile`, `package.json`, `server.ts`, and the `src` folder) to your Space repository.
3. In your Space's **Settings**, add your environment variables under **Variables and secrets**:
   - `GROQ_API_KEY` (Your Groq API key)
   - `GEMINI_API_KEY` (Optional)
   - `OPENAI_API_KEY` (Optional)
