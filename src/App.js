// src/App.js
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { theme } from './theme/theme';
import { GameProvider, useGameContext } from './context/GameContext';
import { HomeScreen } from './components/HomeScreen';
import { Lobby } from './components/Lobby';
import { DrawingGame } from './games/drawing/DrawingGame';
import { LudoGame } from './games/ludo/LudoGame';
import { SnakeLadderGame } from './games/snakeladder/SnakeLadderGame';
import { Box, CircularProgress } from '@mui/material';

const GAME_COMPONENTS = {
  drawing: DrawingGame,
  ludo: LudoGame,
  snakeladder: SnakeLadderGame,
};

function AppContent() {
  const { state } = useGameContext();
  const { isAuthReady, roomId, room } = state;

  if (!isAuthReady) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F0F4FF' }}>
        <CircularProgress color="primary" />
      </Box>
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
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <HomeScreen />
        </motion.div>
      )}
      {screen === 'lobby' && (
        <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <Lobby />
        </motion.div>
      )}
      {screen === 'game' && (
        <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ height: '100vh' }}>
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
