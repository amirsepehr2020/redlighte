# 🔴 Redlighte

> **A modern, Persian-first AI experience built to feel fast, personal, and human.**

<p align="center">
  <strong>Redlighte AI</strong><br>
  Your conversations. Your space. Your AI.
</p>

---

## ✨ What is Redlighte?

**Redlighte** is an AI platform focused on making everyday conversations with AI feel simpler, faster, and more natural — especially for Persian-speaking users.

Redlighte is designed around one idea:

> **AI shouldn't feel like a machine translating a machine. It should feel like an intelligent assistant that actually understands you.**

From casual Persian conversations to technical questions, Redlighte is built to understand intent, context, colloquial language, mixed Persian-English messages, and the way people actually communicate online.

---

## 🧠 Redlighte AI

At the heart of Redlighte is **Redlighte AI**, the platform's dedicated AI assistant.

It is powered through **Cloudflare Workers AI** and currently uses:

- 🤖 `@cf/qwen/qwen3-30b-a3b-fp8`
- ⚡ Cloudflare Workers for the API layer
- 💬 Context-aware conversations
- 🇮🇷 Persian-first language behavior
- 🧩 Up to 20 recent conversation messages sent as context
- 📝 Up to 4096 generated tokens per response

Redlighte's AI behavior is intentionally tuned to prioritize **natural Iranian Persian**, while still handling English, code, technical terminology, URLs, filenames, and mixed-language conversations correctly.

---

## 🔥 Built for real conversations

Redlighte isn't just an API wrapper with a chat box on top.

The project includes a growing client experience with features such as:

- 💬 AI chat interface
- 🔎 Chat/history search
- 🧑‍💻 Account creation and login
- 👤 Personal user profiles
- ⚙️ Per-user settings
- 🌓 Theme support
- 🎨 Accent customization
- 🌍 Multi-language interface
- 🧾 Conversation history
- 🖥️ Code rendering inside AI responses
- 📱 Responsive web experience

The goal is to make the interface disappear into the experience — so the user can focus on the conversation.

---

## 🏗️ Architecture

Redlighte is built as a lightweight web application with a serverless backend:

```text
┌──────────────────────────┐
│       Redlighte UI       │
│   HTML / CSS / JavaScript│
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Cloudflare Worker     │
│                          │
│  /api/chat               │
│  /api/auth/*             │
│  /api/account/data       │
└───────┬───────────┬──────┘
        │           │
        ▼           ▼
┌─────────────┐  ┌──────────────────┐
│ Workers AI  │  │ GitHub Data Repo │
│ Qwen 3      │  │ User data/chats  │
└─────────────┘  └──────────────────┘
```

### 🔐 Authentication & data

Redlighte includes its own session-based authentication flow.

- Passwords are protected with **PBKDF2 + SHA-256**.
- Sessions are signed using **HMAC-SHA-256**.
- Authentication cookies are `HttpOnly` and `Secure`.
- User data and chat data are stored separately from the main application in the `redlighte-data` repository.
- Server credentials are kept in the Worker environment rather than exposed to the frontend.

Security is treated as part of the architecture — not as an afterthought.

---

## 🇮🇷 Persian-first by design

Persian isn't an afterthought in Redlighte.

The AI is specifically instructed to understand:

- محاوره و زبان روزمره
- اصطلاحات و اسلنگ اینترنتی
- غلط‌های تایپی و فاصله‌گذاری‌های ناقص
- پیام‌های ترکیبی فارسی و انگلیسی
- نیم‌فاصله و نشانه‌گذاری فارسی
- لحن دوستانه، رسمی و فنی

The objective is simple: **understand Persian as people actually write it.**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| AI Runtime | Cloudflare Workers AI |
| AI Model | Qwen 3 30B A3B FP8 |
| Backend | Cloudflare Workers |
| Authentication | Custom session-based auth |
| Password Hashing | PBKDF2 + SHA-256 |
| Session Signing | HMAC-SHA-256 |
| Data Storage | GitHub repository (`redlighte-data`) |
| Hosting / Edge | Cloudflare |

---

## 🚀 Project philosophy

Redlighte is being built around a few principles:

**Fast.**  
Don't make users wait for unnecessary infrastructure.

**Natural.**  
Especially in Persian, robotic answers aren't good enough.

**Private by architecture.**  
Keep secrets on the server and keep user data separated from the public application code.

**Simple to use.**  
Powerful technology should still feel effortless.

**Always improving.**  
Redlighte is an evolving project — the architecture and experience continue to grow with it.

---

## 🌐 Redlighte

**Website:** [redlighte.ir](https://redlighte.ir)

**Telegram:** [@redlighte_ai](https://t.me/redlighte_ai)

**Instagram:** [@redlighte.ai](https://instagram.com/redlighte.ai)

---

## ❤️ Created by Sepehr

Redlighte is created and developed by **Sepehr**.

What started as an idea is becoming a real AI platform — one commit at a time. 🔴

---

<p align="center">
  <strong>Redlighte — Light up your conversations.</strong>
</p>
