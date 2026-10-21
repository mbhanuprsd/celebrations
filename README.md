# Celebrations

A React multiplayer and solo game platform built with Firebase, Material UI, and Framer Motion.

## Games

### Multiplayer

| Game | Players | How to play |
|---|---:|---|
| Draw & Guess | 2–12 | Draw the selected word while the other players guess in chat. |
| Ludo | 2–4 | Race four pieces around the board and into the center. Rolling a six lets you leave base and grants another turn; safe cells protect pieces from capture. |
| Snake & Ladder | 2–12 | Roll and race to square 100. Ladders move you forward and snakes move you back. |
| UNO | 2–10 | Play cards matching the active color or card, and use action cards to change the turn. Draw-card stacking is enabled as a house rule. |
| Mini Golf | 2–10 | Aim and putt through the course. The lowest total stroke count wins. |
| Quiz | 2–12 | Answer multiple-choice trivia before time runs out. Faster correct answers earn more points. |
| Boggle Party | 2–12 | Drag across adjacent letters on a shared 4×4 grid to submit words. The room creator sets the minimum length from 3 to 6 letters and round time from 30 to 120 seconds in 30-second increments. Each tile can be used only once per word. Unique words score 2 points; words found by multiple players score 1 point per finder. |

### Solo

The Solo Zone includes **Racing**, **Tetris**, **Flappy Bird**, **Hangman**, and **Wordle**.

## Requirements

- Node.js and npm
- A Firebase project with **Authentication**, **Cloud Firestore**, and **Realtime Database** enabled
- Anonymous sign-in enabled in Firebase Authentication; Google sign-in is also available

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a `.env.local` file in the project root with your Firebase web app configuration:

   ```dotenv
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

   These values are read by [src/firebase/config.js](./src/firebase/config.js). Do not commit `.env.local`.

3. Set the Firebase CLI project in `.firebaserc` to your project ID. Review and deploy the repository’s Firestore and Realtime Database rules before using the app.

4. Start the development server:

   ```bash
   npm start
   ```

To use AI-generated quiz questions, set `REACT_APP_GROQ_API_KEY` in `.env.local` before starting or building. Without it, Quiz uses its built-in question bank. Values with the `REACT_APP_` prefix are included in the browser bundle; do not use a private production API key here. Use a server-side proxy for production API credentials.

## Boggle dictionary

The Boggle game loads [`public/dictionaries/words.txt`](./public/dictionaries/words.txt) as a static asset. The list is loaded once per browser session and filtered to lowercase, alphabet-only words of 3–16 letters. The room’s minimum-word setting is applied separately during play.

Use only a word list that you have permission to redistribute with the app.

## Build and deploy

Create an optimized production build:

```bash
npm run build
```

Deploy Firebase Hosting and the configured database rules:

```bash
npx firebase-tools login
npx firebase-tools deploy
```

The Firebase CLI uses `.firebaserc` to select the project and [firebase.json](./firebase.json) for Hosting, Firestore, and Realtime Database configuration.

## Project structure

```text
public/
└── dictionaries/
    └── words.txt
src/
├── App.js                         # Root screen and multiplayer game routing
├── components/
│   ├── HomeScreen.js              # Home, game picker, room creation and Solo Zone
│   ├── Lobby.js                   # Waiting room and game start
│   └── GameSharedUI.js            # Shared game overlays and controls
├── context/
│   └── GameContext.js             # Authentication, room and chat state
├── core/
│   └── GameEngine.js              # Game registry and game metadata
├── firebase/
│   ├── config.js                  # Firebase environment configuration
│   ├── index.js                   # Firebase app, Auth and database instances
│   └── services.js                # Shared room, chat, profile and score services
├── hooks/                         # Room, canvas, presence and session hooks
└── games/
    ├── bots/                      # Bot player service and turn logic
    ├── boggle/                    # Boggle board, dictionary, game and Firebase logic
    ├── drawing/                   # Draw & Guess
    ├── ludo/                      # Ludo
    ├── minigolf/                  # Mini Golf
    ├── quiz/                      # Quiz, question bank and generation
    ├── snakeladder/               # Snake & Ladder
    ├── solo/                      # Racing, Tetris, Flappy Bird, Hangman and Wordle
    └── uno/                       # UNO
```

Each multiplayer game has its own game UI and engine. Firebase room state is shared through Firestore snapshots; drawing strokes, presence, and room chat use Realtime Database.

## Adding a multiplayer game

1. Add the game implementation and engine under `src/games/<game>/`.
2. Register the game metadata in `GameRegistry` and `GAME_META` in [src/core/GameEngine.js](./src/core/GameEngine.js).
3. Add its room-creation settings and game-picker styling in [src/components/HomeScreen.js](./src/components/HomeScreen.js), and its engine and lobby display in [src/components/Lobby.js](./src/components/Lobby.js).
4. Add the game component and readiness check in [src/App.js](./src/App.js).
5. Add focused tests and update this README.

## Security note

Review the Firebase rules in `firestore.rules` and `database.rules.json` before deployment. In particular, the current Firestore room rules allow any authenticated user to update room documents. Client-side game checks are not a security boundary; production scoring and game actions should be validated on a trusted backend and protected by appropriately restrictive database rules.
