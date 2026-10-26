# Celebrations

Celebrations is a browser-based multiplayer and solo game platform built with React, Firebase, and LiveKit voice chat.

## What you can play

### Multiplayer games

| Game | Players | What it’s about |
|---|---:|---|
| Draw & Guess | 2–12 | Draw a secret word while the other players guess in chat. |
| Ludo | 2–4 | Race your pieces around the board and into the center. |
| Snake & Ladder | 2–12 | Roll the dice, climb ladders, avoid snakes, and reach square 100. |
| UNO | 2–10 | Play matching cards and action cards; draw-card stacking is enabled as a house rule. |
| Mini Golf | 2–10 | Aim and putt through the course; the lowest stroke count wins. |
| Quiz | 2–12 | Answer timed multiple-choice questions; faster correct answers earn more points. |
| Boggle Party | 2–12 | Find words by tracing adjacent letters on a shared 4×4 board. The host chooses a 3–6 letter minimum and a 30–120 second round length. Longer words score more; a unique word earns its finder a bonus. |

Active multiplayer games have optional, audio-only voice chat. Players join explicitly, allow microphone access, and can mute or leave voice at any time. Voice media uses LiveKit; Firebase manages sign-in, game rooms, chat, and the secure endpoint that issues LiveKit access tokens.

### Solo games

Play **Racing**, **Tetris**, **Flappy Bird**, **Hangman**, and **Wordle** in the Solo Zone.

## Clone and configure Firebase + LiveKit

This section sets up your own Firebase and LiveKit projects. The Firebase project ID, Firebase web-app settings, LiveKit URL, and LiveKit credentials are yours; do not reuse another developer’s project credentials.

### 1. Install prerequisites and clone the app

- Install Node.js 20 or later and npm.
- Create your own Firebase project and LiveKit project (steps below).
- Install Git if it is not already available.

```bash
git clone https://github.com/mbhanuprsd/celebrations.git
cd celebrations
npm ci
npm ci --prefix functions
```

The Firebase Functions runtime is configured for Node.js 20. For predictable local Functions tooling, use Node.js 20 for that package.

### 2. Create and configure your Firebase project

In the [Firebase Console](https://console.firebase.google.com/):

1. Create a Firebase project.
2. Enable **Authentication** and enable **Anonymous** sign-in. Enable **Google** sign-in too if you want Google accounts.
3. Create a **Cloud Firestore** database.
4. Create a **Realtime Database** and choose its location. Copy its database URL.
5. Register a **Web app** in Project settings and copy its Firebase configuration values.
6. Enable billing for the project. Cloud Functions and Secret Manager require billing to deploy and store LiveKit credentials. Review Firebase and Google Cloud pricing for your expected usage.

Create `.env.local` in the repository root using your web-app values:

```dotenv
REACT_APP_FIREBASE_API_KEY=your-firebase-web-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your-database-url
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=your-firebase-app-id
```

Use the exact values shown for your Firebase web app and Realtime Database; the examples above are placeholders. These Firebase web configuration values are used by the browser app and are not server secrets. `.env.local` is ignored by Git and must not be committed.

Update `.firebaserc` so its `default` project is your Firebase project ID:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

The Firebase app uses the Cloud Functions region `europe-west3` (Frankfurt), matching the included LiveKit project’s European region. If you choose another Firebase Functions region, update the region in both `src/firebase/index.js` and `functions/index.js` to the same supported region before deployment.

### 3. Create a LiveKit project and configure its URL

1. Create a project in [LiveKit Cloud](https://cloud.livekit.io/) or set up your own LiveKit server.
2. In the project settings, open **API keys** and create an API key. Keep its API key and secret private. If a credential has been shared or exposed, revoke it and create a replacement.
3. Copy the project’s WebSocket server URL. It should use `wss://` (for example, `wss://your-project.livekit.cloud`), not the dashboard URL.
4. Create a local Functions environment file named `functions/.env.<your-project-id>`, replacing the suffix with the Firebase project ID from `.firebaserc`:

   ```dotenv
   LIVEKIT_URL=wss://your-project.livekit.cloud
   ```

   Keep only the non-secret server URL in this file. It is ignored by Git. Do **not** put the LiveKit API key or secret in this file, the React app, or any variable prefixed with `REACT_APP_`.

The callable token function is configured to run in `europe-west3` (Frankfurt). A LiveKit project in another region can still connect, but choose a Functions region appropriate for your users and keep the client and function region settings in sync.

### 4. Sign in to Firebase and store LiveKit credentials securely

From the repository root, sign in to the Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools use your-project-id
```

Set each secret using its **name** as the command argument. The CLI prompts for the corresponding value; enter the LiveKit API key for the first command and its matching API secret for the second:

```bash
npx firebase-tools functions:secrets:set LIVEKIT_API_KEY
npx firebase-tools functions:secrets:set LIVEKIT_API_SECRET
```

Never put the credential itself in the command, commit it to the repository, or send it in chat. The Firebase callable function uses these secrets to create short-lived tokens and only grants microphone publishing and audio subscription.

### 5. Deploy Firebase rules, the token function, and the website

Install dependencies if you have not already, then build and deploy:

```bash
npm ci
npm ci --prefix functions
npm run build
npx firebase-tools deploy --only firestore:rules,database,functions,hosting
```

This deploys the repository’s Firestore rules, Realtime Database rules, Cloud Function, and Hosting site to the Firebase project selected in `.firebaserc`. To deploy only the function and website later, use:

```bash
npx firebase-tools deploy --only functions,hosting
```

For local frontend development, run `npm start` after creating `.env.local`. Voice chat still needs the callable function deployed to your Firebase project (or a Functions emulator configured for local development).

### 6. Test the game and voice chat

1. Open the deployed site over HTTPS, or use `localhost`.
2. Sign in from two separate browsers or devices, create a multiplayer room, and start a game.
3. In both clients, select **Join voice** and allow microphone access.
4. Confirm that both clients show the voice participants and can hear one another. Test mute and leave as well.

If voice fails, check the browser’s microphone permission, the `LIVEKIT_URL`, Firebase Function logs, and whether the users are still members of an active room. LiveKit media needs network access for WebRTC; strict firewalls may prevent calls from connecting.

## Project notes

### Boggle dictionary

Boggle loads [`public/dictionaries/words.txt`](./public/dictionaries/words.txt), filters it to lowercase alphabet-only words of 3–16 letters, and applies each room’s minimum word length separately. Use only a word list that you have permission to redistribute.

### Optional AI-generated quiz questions

Without an API key, Quiz uses its built-in question bank. The optional `REACT_APP_GROQ_API_KEY` setting is included in the browser bundle and therefore is not suitable for private production credentials. Use a server-side proxy if you need to protect an AI provider key.

### Project structure

```text
public/
└── dictionaries/
    └── words.txt
functions/
└── index.js                       # Callable Firebase Functions, including voice tokens
src/
├── App.js                         # Root screen and multiplayer game routing
├── components/
│   ├── HomeScreen.js              # Home, game picker, room creation and Solo Zone
│   ├── Lobby.js                   # Waiting room and game start
│   ├── GameSharedUI.js            # Shared game overlays and controls
│   └── GameVoiceChat.js           # LiveKit game voice controls and audio
├── context/
│   └── GameContext.js             # Authentication, room and chat state
├── core/
│   └── GameEngine.js              # Game registry and game metadata
├── firebase/
│   ├── config.js                  # Firebase environment configuration
│   ├── index.js                   # Firebase app, Auth and database instances
│   └── services.js                # Shared room, chat, profile and score services
├── hooks/                         # Room, canvas, presence and session hooks
└── games/                         # Multiplayer and solo game implementations
```

Each multiplayer game has its own UI and engine. Firestore snapshots carry room/game state; Realtime Database handles presence, drawing strokes, and room chat. LiveKit carries voice audio.

### Adding a multiplayer game

1. Add the game implementation and engine under `src/games/<game>/`.
2. Register the game metadata in `GameRegistry` and `GAME_META` in [src/core/GameEngine.js](./src/core/GameEngine.js).
3. Add room-creation settings and game-picker styling in [src/components/HomeScreen.js](./src/components/HomeScreen.js), and its engine and lobby display in [src/components/Lobby.js](./src/components/Lobby.js).
4. Add the game component and readiness check in [src/App.js](./src/App.js).
5. Add focused tests and update this README.

## Security and operating costs

The LiveKit API secret stays in Firebase Secret Manager; the browser receives only a short-lived room token after the callable function checks Firebase authentication, active-game status, and room membership. However, the current Firestore room rules allow any authenticated user to update room documents, so client-controlled room membership is not a strong authorization boundary. Review and restrict room writes before relying on room membership as a production security control. Client-side game rules are not a security boundary.

LiveKit’s server and client SDKs are open source, but voice hosting is not necessarily free. LiveKit Cloud usage may incur charges, while self-hosting requires you to provide and operate the server and bandwidth. Firebase Cloud Functions and related Google Cloud services can also incur costs. Check both providers’ current pricing and configure usage alerts or limits before inviting users.
