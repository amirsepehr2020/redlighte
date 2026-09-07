# 🔴 Redlighte

> **A Persian-first AI platform and growing technology ecosystem — built to feel fast, natural, personal, and human.**

<p align="center">
  <strong>Redlighte AI</strong><br>
  Ask. Think. Create.
</p>

---

## ✨ What is Redlighte?

**Redlighte** is an AI-first web platform focused on making everyday work with AI simple, fast, and natural — with particular attention to how Persian-speaking users actually communicate.

The main AI experience lives at **Redlighte.ir**. Around it, the project is growing into a broader ecosystem of products and experiences under **Redlighte Inc.**

The core idea is simple:

> **AI should understand how people actually communicate — not force people to communicate like machines.**

Redlighte is designed to handle natural Persian, casual conversations, technical questions, coding, learning, brainstorming, content creation, and mixed Persian-English messages.

---

## 🧠 Redlighte AI

The main product is **Redlighte AI**, a conversational assistant served through a Cloudflare Worker.

Current implementation includes:

- 🤖 Cloudflare Workers AI
- 🧠 `@cf/qwen/qwen3-30b-a3b-fp8`
- 💬 Conversation context with up to **20 recent messages**
- 📝 User messages up to **12,000 characters**
- ⚡ Up to **4,096 generated tokens** per response
- 🧠 Optional long-term memory system
- 🔎 Conversation/history search on the client
- ✏️ Edit-and-resend messages
- 🔁 Retry and stop-generation controls
- 📋 Copyable AI and user messages
- 🌐 Multilingual interface
- 📱 Responsive, PWA-ready web experience

The frontend talks to the same-origin `/api/chat` endpoint, while the Worker handles the AI request and server-side logic.

---

## 🇮🇷 Persian-first by design

Persian is treated as a first-class language in both the product experience and the AI behavior.

Redlighte is specifically designed to understand:

- محاوره و زبان روزمره
- اصطلاحات و اسلنگ اینترنتی
- غلط‌های تایپی و فاصله‌گذاری ناقص
- پیام‌های ترکیبی فارسی و انگلیسی
- نیم‌فاصله و نشانه‌گذاری فارسی
- لحن دوستانه، رسمی و فنی

The AI is instructed to understand the meaning first and then produce **natural modern Iranian Persian**, rather than mechanically translating English sentence structure.

---

## 🧩 Redlighte ecosystem

Redlighte is not limited to the main chat. The current repository contains several connected branches of the ecosystem:

| Branch | Purpose |
|---|---|
| 🧠 **Redlighte AI** | Main conversational AI experience at `/` |
| 📰 **Redlighte Articles** | AI, technology, tutorials, Redlighte guides, and gaming news/content |
| ✦ **Redlighte Agents** | Specialized AI-agent experiences |
| ▣ **Redlighte Room** | Shared rooms and collaborative real-time experiences |
| ⚡ **Redlighte Now** | Public, timely view of Redlighte activity, branches, news, and development signals |
| 🎮 **Redlighte Game** | Browser-based games and gaming/social experiences |
| 🗃️ **Vault** | Authenticated personal storage for notes, links, code, bookmarks, checklists, ideas, and documents |

These are connected parts of the Redlighte ecosystem, not unrelated products or companies.

**Brand structure:**

```text
REDLIGHTE
│
└── Redlighte Inc.
    │
    ├── Redlighte.ir
    │   └── Redlighte AI — main AI product
    │
    ├── Redlighte Articles
    ├── Redlighte Agent
    ├── Redlighte Room
    ├── Redlighte Now
    └── Redlighte Game
```

---

## 📰 Redlighte Articles

The Articles branch is a static, data-driven editorial experience at `/articles/`.

It currently combines multiple article datasets and supports:

- 🔥 Newest/most recent articles first
- 🔎 Article search
- 🗂️ Category filtering
- 🇮🇷 Persian article presentation
- ⏱️ Reading-time metadata
- 📰 AI and technology news
- 🎮 Gaming content
- 📚 Tutorials and educational guides
- 🔴 Redlighte-focused articles

The article data is split across dedicated JSON sources for the general collection, additional articles, Redlighte-specific content, and gaming content.

---

## 🎮 Redlighte Game

The Game branch is a browser-based gaming area with multiple experiences and a shared social layer.

The repository currently contains games such as:

- **Red Rush** — arcade/high-score experience
- **Redlight** — reaction game
- **Grid** — puzzle experience
- **2048** — dedicated 2048 implementation

The gaming system also includes authenticated social functionality such as:

- 👥 Friends
- 🤝 Friend requests
- ⚔️ Challenges between friends
- 🏆 Leaderboards
- 🎯 Daily quests
- ⭐ XP and rewards
- 🏅 Achievements

Game account/social data is stored through the authenticated data repository rather than in the public frontend repository.

---

## ▣ Redlighte Room

**Redlighte Room** provides shared, real-time rooms using Cloudflare Durable Objects and WebSockets.

Current backend capabilities include:

- 👥 Multi-user rooms
- 🔐 Authenticated room access
- 📩 User invitations
- 🟢 Presence tracking
- 💬 Real-time room chat
- ▶️ Shared playback state
- 🌐 Shared content changes
- 👁️ Shared live-view state
- 🖥️ Shared fullscreen state
- ⏳ Automatic room cleanup/expiration

The Worker defines dedicated Durable Objects for rooms, presence, room indexing, and live sharing.

---

## ⚡ Redlighte Now

**Redlighte Now** is the public activity window of the ecosystem at `/now/`.

It provides a lightweight view of:

- Current local time
- Public Redlighte status
- Recent public repository signals
- Redlighte branches
- Recent Redlighte news
- Recent development activity
- Search and language controls

It is designed to expose **public project signals only**, without private user data.

---

## 🗃️ Vault

The authenticated Vault branch provides personal storage inside a user's Redlighte account.

Supported item types include:

- 📝 Notes
- 🔗 Links
- 💻 Code
- 🔖 Bookmarks
- ☑️ Checklists
- 💡 Ideas
- 📄 Documents

Vault also supports collections, tags, favorites, trash, restore, permanent deletion, and empty-trash operations.

---

## 👤 Accounts & authentication

Redlighte has a custom session-based authentication system.

### Account features

- Account creation
- Username/password login
- Logout
- Persistent authenticated sessions
- Account settings
- Chat synchronization
- Device-input logging for authenticated accounts
- Google authentication and Google-account linking

### Passwords & sessions

- Passwords use **PBKDF2 + SHA-256**.
- The current Worker configuration uses **100,000 PBKDF2 iterations**.
- Sessions are signed with **HMAC-SHA-256**.
- Session cookies use `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and the `redlighte.ir` domain.
- Session lifetime is seven days in the current implementation.

Credentials used by the Worker are kept server-side and are not intended to be exposed to frontend code.

---

## 🧠 Long-term memory

Redlighte includes a dedicated memory system separate from the normal answer pass.

The memory engine can store durable, user-specific information in categories such as:

- `profile`
- `preference`
- `communication`
- `skill`
- `goal`
- `project`
- `fact`

It supports:

- Automatic memory extraction
- Memory retrieval for relevant conversations
- Manual memory creation
- Memory editing
- Memory deletion
- Clearing all memories
- Enabling/disabling memory
- Deduplication and updating of existing memories
- Filtering of sensitive information from memory storage

The memory analyzer uses the same Qwen 3 model family through Cloudflare Workers AI.

---

## 🏗️ Architecture

Redlighte is a lightweight static frontend combined with a serverless Cloudflare backend.

```text
┌─────────────────────────────────────────┐
│              Redlighte Web              │
│       HTML / CSS / JavaScript / PWA     │
│                                         │
│  AI • Articles • Game • Agents • Room   │
│  Now • Vault • Account / Settings       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Cloudflare Worker              │
│                                         │
│ /api/chat                               │
│ /api/auth/*                             │
│ /api/account/data                       │
│ /api/memory*                            │
│ /api/game/*                             │
│ /api/room*                              │
│ /api/room-live/*                        │
│ /api/vault*                             │
│ /api/pulse*                             │
└───────────────┬───────────────┬─────────┘
                │               │
                ▼               ▼
       ┌────────────────┐  ┌──────────────────┐
       │ Cloudflare AI  │  │ GitHub Data Repo │
       │ Qwen 3         │  │ users / chats    │
       │                │  │ memory / vault   │
       └────────────────┘  │ game / auth data │
                           └──────────────────┘

        Cloudflare Durable Objects
        ├── Rooms
        ├── Presence
        ├── Room Index
        └── Live Share
```

The main Worker entry point routes requests between the core AI/auth service and the ecosystem-specific modules.

---

## 🔐 Data architecture

The public application repository is separated from the private data repository:

```text
Public application
amirsepehr2020/redlighte
        │
        │ server-side API access
        ▼
Private data
amirsepehr2020/redlighte-data
```

The current application uses the data repository for authenticated user information and related application data, including account records, chats, memory, game/social state, device-input logs, Google mappings, and Vault data.

The frontend does not directly receive the GitHub credentials used by the Worker.

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Cloudflare Workers |
| AI Runtime | Cloudflare Workers AI |
| AI Model | Qwen 3 30B A3B FP8 (`@cf/qwen/qwen3-30b-a3b-fp8`) |
| Authentication | Custom session-based authentication |
| Password Hashing | PBKDF2 + SHA-256 |
| Session Signing | HMAC-SHA-256 |
| Data Storage | GitHub repository (`redlighte-data`) |
| Real-time Backend | Cloudflare Durable Objects + WebSockets |
| PWA | Web App Manifest + Service Workers |
| Hosting / Edge | Cloudflare |
| Content Data | JSON datasets + static HTML/CSS/JS |

---

## 📁 Repository structure

The repository is intentionally lightweight and organized around the product branches rather than a large framework build system.

```text
redlighte/
│
├── index.html                 # Main Redlighte AI interface
├── app.js                    # Main chat/client application logic
├── auth.js                   # Account UI and authentication client logic
├── account-menu.js           # Account menu UI
├── memory-ui.js              # Memory UI
├── chat-search.js            # Chat/history search
├── history-search.*          # History search styling/logic
├── code-render.js             # Code rendering helpers
├── language*.js               # Language/localization logic
├── settings-ui.js             # Settings UI
├── share.*                    # Sharing functionality
├── pwa.js / sw.js             # PWA/service-worker support
│
├── about/                     # About page
├── app/                       # App download page + APK
├── fa/                        # Persian-facing main pages
├── agents/                    # Redlighte Agents
├── articles/                  # Redlighte Articles
├── game/                      # Redlighte Game
├── now/                       # Redlighte Now
├── room/                      # Redlighte Room frontend
├── vault/                     # Vault frontend
├── assets/                    # Icons and avatar assets
│
├── worker/
│   ├── index.js               # Worker entry/router
│   ├── index-core.js          # Core AI/auth/account/chat logic
│   ├── google-auth.js         # Google authentication
│   ├── memory.js              # Memory service
│   ├── memory-core.js         # Memory storage/retrieval core
│   ├── game-api.js            # Game/social API
│   ├── room.js                # Room + Durable Objects
│   ├── live-share.js          # Live-share functionality
│   ├── vault.js               # Vault API
│   ├── pulse.js               # Pulse service
│   └── pulse-auth.js          # Pulse authentication
│
├── wrangler.jsonc             # Cloudflare Worker configuration
├── robots.txt                 # Crawler rules
└── sitemap.xml                # Site sitemap
```

The repository also contains the individual article pages, article datasets, game implementations, localization assets, UI styles, icons, and supporting service-worker/PWA files.

---

## 🌐 Localization

The application contains a multilingual interface rather than being limited to Persian and English.

The current authentication localization includes:

- 🇬🇧 English
- 🇮🇷 Persian
- 🇸🇦 Arabic
- 🇰🇷 Korean
- 🇨🇳 Chinese
- 🇫🇷 French
- 🇪🇸 Spanish
- 🇮🇳 Hindi

Other branches also contain their own localized UI systems where implemented.

---

## 📱 PWA & mobile experience

Redlighte is built as a web application but is also prepared for app-like installation.

The main manifest configures:

- Standalone display
- Mobile-friendly viewport behavior
- App icons at 192×192 and 512×512
- Theme/background colors
- Portrait-primary orientation
- Service-worker support

The repository also contains an `/app/` download experience with the current Android APK file.

---

## ⚙️ Cloudflare configuration

The project is configured through `wrangler.jsonc` with:

- Worker entry: `worker/index.js`
- Cloudflare Workers AI binding: `AI`
- Static assets binding: `ASSETS`
- API routes executed by the Worker first
- Durable Objects for Room, Presence, Room Index, and Live Share
- Observability and tracing enabled
- Compatibility date: `2026-08-16`

No large frontend framework or conventional application build pipeline is required by the current repository structure.

---

## 🚀 Project philosophy

Redlighte is being built around a few principles:

**Fast.**  
Keep the experience lightweight and avoid unnecessary infrastructure.

**Natural.**  
Especially in Persian, understanding real communication matters more than sounding formally correct.

**Useful.**  
The ecosystem is designed to go beyond a single chat screen.

**Private by architecture.**  
Keep server credentials on the server and separate application code from user data.

**Simple.**  
Powerful technology should still feel easy to use.

**Evolving.**  
Redlighte is an active project whose products and infrastructure continue to grow.

---

## 🔗 Public endpoints

| Experience | Path |
|---|---|
| Redlighte AI | `/` |
| Persian Redlighte | `/fa/` |
| Articles | `/articles/` |
| Agents | `/agents/` |
| Game | `/game/` |
| Room | `/room/` |
| Now | `/now/` |
| Vault | `/vault/` |
| App download | `/app/` |
| About | `/about/` |

---

## 🌐 Redlighte

**Website:** https://redlighte.ir

**Telegram:** https://t.me/redlighte_ai

**Instagram:** https://instagram.com/redlighte.ai

---

## ❤️ Created by Sepehr

Redlighte is created and developed by **Sepehr**.

What started as an idea is growing into a real AI platform and ecosystem — one commit at a time. 🔴

---

<p align="center">
  <strong>Redlighte — Light up your conversations.</strong>
</p>
