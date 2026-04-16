// src/App.js
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { theme } from './theme/theme';
import { GameProvider, useGameContext } from './context/GameContext';
import { LoginScreen } from './components/LoginScreen';
import { HomeScreen } from './components/HomeScreen';
import { Lobby } from './components/Lobby';
import { DrawingGame } from './games/drawing/DrawingGame';
import { LudoGame } from './games/ludo/LudoGame';
import { SnakeLadderGame } from './games/snakeladder/SnakeLadderGame';
import { UnoGame } from './games/uno/UnoGame';
import { MiniGolfGame } from './games/minigolf/MiniGolfGame';
import { Box, CircularProgress } from '@mui/material';

const GAME_COMPONENTS = {
  drawing: DrawingGame,
  ludo: LudoGame,
  snakeladder: SnakeLadderGame,
  uno: UnoGame,
  minigolf: MiniGolfGame,
};

function AppContent() {
  const { state } = useGameContext();
  const { isAuthReady, isLoggedIn, roomId, room } = state;

  if (!isAuthReady) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#080c12' }}>
        <CircularProgress sx={{ color: '#4CC9F0' }} />
      </Box>
    );
  }

  if (!isLoggedIn) {
    return (
      <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100dvh' }}>
        <LoginScreen />
      </motion.div>
    );
  }

  const screen = !roomId ? 'home'
    : !room ? 'home'
    : room.status === 'waiting' ? 'lobby'
    : 'game';

  const GameComp = GAME_COMPONENTS[room?.gameType] || DrawingGame;

  return (
    <AnimatePresence mode="wait">
      {screen === 'home' && (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <HomeScreen />
        </motion.div>
      )}
      {screen === 'lobby' && (
        <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Lobby />
        </motion.div>
      )}
      {screen === 'game' && (
        <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ height: '100dvh' }}>
          <GameComp />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GameProvider>
        <AppContent />
      </GameProvider>
    </ThemeProvider>
  );
}
