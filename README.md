# 🎨🎲 Celebrations — Multiplayer Game Platform

A full-stack multiplayer game platform built with **React**, **Material UI**, **Framer Motion**, and **Firebase**. Currently ships with two games:

| Game | Players | Description |
|------|---------|-------------|
| 🎨 **Draw & Guess** | 2–12 | Skribbl.io-style: draw a word, others guess it |
| 🎲 **Ludo** | 2–4 | Classic race board game — get all 4 pieces home first |

---

## 📁 Project Structure

```
src/
├── App.js                          # Root router (home / lobby / game)
├── index.js
├── firebase/
│   ├── config.js                   # 🔑 Your Firebase config
│   ├── index.js                    # Firebase init
│   └── services.js                 # Shared DB ops (rooms, chat, auth)
├── context/
│   └── GameContext.js              # Global auth + room + chat state
├── core/
│   └── GameEngine.js               # Abstract base + GameRegistry + GAME_META
├── hooks/
│   ├── useCanvas.js                # Drawing + RTDB stroke sync
│   └── useRoom.js                  # Create / join / leave room
├── theme/
│   └── theme.js                    # MUI theme
├── components/
│   ├── HomeScreen.js               # Landing: game picker + create/join
│   └── Lobby.js                    # Waiting room (game-aware)
└── games/
    ├── drawing/                    # 🎨 Draw & Guess module
    │   ├── DrawingGameEngine.js
    │   ├── DrawingGame.js
    │   ├── Canvas.js
    │   ├── ChatPanel.js
    │   ├── PlayerListPanel.js
    │   ├── WordSelector.js
    │   ├── RoundTimer.js
    │   ├── RoundEndScreen.js
    │   └── FinalScores.js
    └── ludo/                       # 🎲 Ludo module
        ├── LudoGameEngine.js       # Extends GameEngine base class
        ├── ludoConstants.js        # Board layout, paths, coords
        ├── ludoFirebaseService.js  # All Ludo Firestore operations
        ├── LudoGame.js             # Main layout + orchestration
        ├── LudoBoard.js            # SVG board with animated pieces
        └── LudoDice.js             # Animated 3D-style dice
```

---

## 🚀 Setup & Deployment

### Step 1 — Firebase Project Setup

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable these services:
   - **Authentication → Anonymous sign-in**
   - **Firestore Database** (start in test mode)
   - **Realtime Database** (start in test mode)

### Step 2 — Add Your Config

Open `src/firebase/config.js` and replace with your project's config:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

Also update `.firebaserc`:
```json
{ "projects": { "default": "your-project-id" } }
```

### Step 3 — Run Locally

```bash
npm install
npm start
```

### Step 4 — Deploy

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```

---

## 🎲 Ludo Rules

- 2–4 players, each assigned a color (Red, Blue, Green, Yellow)
- Roll the dice on your turn — need a **6** to enter a piece from home base
- **Rolling 6** gives you an extra turn
- **Landing on an opponent** sends their piece back to base (safe cells ⭐ are protected)
- **3 consecutive sixes** forfeits your turn
- Get all **4 pieces** around the board and into the center to win!

---

## 🧩 Adding a New Game

1. **Create engine**: `src/games/mygame/MyGameEngine.js` extending `GameEngine`
2. **Register it**: Add to `GameRegistry` and `GAME_META` in `src/core/GameEngine.js`
3. **Add component**: `src/games/mygame/MyGame.js`
4. **Route it**: Add to `GAME_COMPONENTS` map in `src/App.js`
5. **Handle in Lobby**: `GAME_ENGINES` map in `src/components/Lobby.js`

---

## ⚙️ Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI | React 18 + MUI v5 | Components |
| Animation | Framer Motion | All transitions & game animations |
| Game state | Firestore | Room, players, game phase, Ludo state |
| Canvas/Chat | Realtime DB | Low-latency drawing strokes + chat |
| Auth | Anonymous Auth | Instant join, no signup |
| Hosting | Firebase Hosting | CDN deployment |

**Ludo state** is stored as a nested `ludoState` object inside the Firestore room document, updated atomically with `updateDoc`. All game logic runs client-side on the active players' browsers — the host's client drives turn management and win detection.
