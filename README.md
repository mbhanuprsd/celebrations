# 🎨 Pictionary — Multiplayer Draw & Guess Game

A full-stack skribbl.io-style multiplayer drawing game built with **React**, **Material UI**, **Framer Motion**, and **Firebase**. Supports **2–12 players**, real-time canvas sync, animated UI, and a modular architecture ready to add new games.

---

## 📁 Project Structure

```
celebrations/
├── public/
│   └── index.html
├── src/
│   ├── App.js                          # Root: routes between Home / Lobby / Game
│   ├── index.js                        # React entry point
│   │
│   ├── firebase/
│   │   ├── config.js                   # 🔑 YOUR Firebase config goes here
│   │   ├── index.js                    # Firebase app init (Firestore, RTDB, Auth)
│   │   └── services.js                 # All DB operations (rooms, canvas, chat)
│   │
│   ├── context/
│   │   └── GameContext.js              # Global state: auth, room, chat
│   │
│   ├── core/
│   │   └── GameEngine.js               # Abstract base class + GameRegistry
│   │
│   ├── hooks/
│   │   ├── useCanvas.js                # Drawing + RTDB stroke sync
│   │   └── useRoom.js                  # Create / join / leave room
│   │
│   ├── theme/
│   │   └── theme.js                    # MUI theme (colors, fonts, components)
│   │
│   ├── components/
│   │   ├── HomeScreen.js               # Landing page: create/join room
│   │   └── Lobby.js                    # Waiting room with settings
│   │
│   └── games/
│       └── drawing/                    # 🎮 Drawing game module
│           ├── DrawingGameEngine.js    # Game logic (scores, rounds, hints)
│           ├── DrawingGame.js          # Main game layout orchestrator
│           ├── Canvas.js               # Drawing canvas + toolbar + palette
│           ├── ChatPanel.js            # Chat + guess submission
│           ├── PlayerListPanel.js      # Sidebar scoreboard
│           ├── WordSelector.js         # Word choice overlay (drawer)
│           ├── RoundTimer.js           # Animated countdown bar
│           ├── RoundEndScreen.js       # Between-round scores overlay
│           └── FinalScores.js          # End-game podium screen
│
├── firebase.json                       # Firebase hosting + DB config
├── firestore.rules                     # Firestore security rules
├── database.rules.json                 # Realtime DB security rules
├── firestore.indexes.json
└── .firebaserc                         # Your project ID
```

---

## 🚀 Setup & Deployment (Step-by-Step)

### Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → give it a name → Continue
3. Enable Google Analytics (optional) → Create project

### Step 2 — Enable Firebase Services

In your project console:

**Authentication:**
- Go to **Build → Authentication → Get started**
- Click **Sign-in method** tab → Enable **Anonymous** → Save

**Firestore:**
- Go to **Build → Firestore Database → Create database**
- Choose **Start in test mode** (we'll add rules later)
- Pick a region (e.g. `europe-west3`) → Done

**Realtime Database:**
- Go to **Build → Realtime Database → Create database**
- Choose **Start in test mode**
- Pick a region → Done

### Step 3 — Get Your Config

- Go to **Project Settings** (gear icon) → **Your apps**
- Click **"Add app"** → Web (`</>`)
- Register app (any nickname) → Copy the `firebaseConfig` object

### Step 4 — Configure the App

Open `src/firebase/config.js` and paste your config:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-project.firebaseapp.com",
  databaseURL: "https://my-project-default-rtdb.firebaseio.com",
  projectId: "my-project",
  storageBucket: "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

Also update `.firebaserc`:
```json
{
  "projects": { "default": "my-project" }
}
```

### Step 5 — Install Dependencies

```bash
npm install
```

### Step 6 — Run Locally

```bash
npm start
# Opens at http://localhost:3000
```

### Step 7 — Deploy to Firebase Hosting

```bash
# Install Firebase CLI (once)
npm install -g firebase-tools

# Login
firebase login

# Deploy security rules + hosting
npm run build
firebase deploy
```

Your game will be live at: `https://YOUR_PROJECT_ID.web.app`

---

## 🔒 Deploying Security Rules

After testing, deploy the production rules:

```bash
firebase deploy --only firestore:rules
firebase deploy --only database
```

---

## 🎮 How to Play

1. **Create a Room** — Enter your name, set max players (2–12), rounds (1–5), and draw time (30–120s)
2. **Share the Code** — Send the 6-character room code to friends
3. **Wait in Lobby** — Host clicks "Start Game" when everyone joins
4. **Drawing Phase** — The drawer picks one of 3 secret words, then draws it
5. **Guessing Phase** — Others type guesses in the chat; correct guesses score points
6. **Scoring** — Faster guesses = more points; drawer earns bonus per correct guesser
7. **Repeat** — Each player draws once per round; after all rounds, final scores shown

---

## 🧩 Adding a New Game (Extension Guide)

The architecture uses an abstract `GameEngine` class and `GameRegistry`. Adding a game takes 4 steps:

### 1. Create your engine

```js
// src/games/trivia/TriviaGameEngine.js
import { GameEngine } from '../../core/GameEngine';

export class TriviaGameEngine extends GameEngine {
  static get name() { return 'Trivia'; }
  static get description() { return 'Answer trivia questions!'; }
  static get defaultSettings() { return { maxPlayers: 12, rounds: 5 }; }

  async onStartGame(playerOrder) {
    // Your logic here
  }
}
```

### 2. Register it

```js
// src/core/GameEngine.js
import { TriviaGameEngine } from '../games/trivia/TriviaGameEngine';

export const GameRegistry = {
  drawing: DrawingGameEngine,
  trivia: TriviaGameEngine,   // ← add this
};
```

### 3. Build your game component

```js
// src/games/trivia/TriviaGame.js
export function TriviaGame() { ... }
```

### 4. Route to it in App.js

```js
// Map room.gameType → component
const GameComponents = { drawing: DrawingGame, trivia: TriviaGame };
const GameComp = GameComponents[room.gameType] || DrawingGame;
```

---

## ⚙️ Game Settings Reference

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `maxPlayers` | 8 | 2–12 | Max players per room |
| `rounds` | 3 | 1–5 | Rounds per game |
| `drawTime` | 80s | 30–120s | Seconds per drawing turn |

---

## 🏗️ Architecture Notes

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + MUI v5 | UI components & routing |
| Animations | Framer Motion | Screen transitions, overlays, micro-interactions |
| Game State | Firebase Firestore | Room data, players, scores, game phase |
| Canvas Sync | Firebase Realtime DB | Low-latency stroke streaming |
| Auth | Firebase Anonymous Auth | Instant join, no signup needed |
| Hosting | Firebase Hosting | CDN-backed static hosting |

**Why two databases?**
- **Firestore** for game state (structured, queryable, consistent)
- **Realtime Database** for canvas strokes and chat (lower latency, ~50ms vs ~200ms)

---

## 📝 License

MIT — use it, extend it, ship it. Have fun! 🎨
