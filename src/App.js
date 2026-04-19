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
import { QuizGame } from './games/quiz/QuizGame';
import { Box, CircularProgress, Typography, Tooltip, IconButton } from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useRoom } from './hooks/useRoom';

const GAME_COMPONENTS = {
  drawing: DrawingGame,
  ludo: LudoGame,
  snakeladder: SnakeLadderGame,
  uno: UnoGame,
  minigolf: MiniGolfGame,
  quiz: QuizGame,
};

/** Small floating exit button — always visible while inside a game or lobby.
 *  Acts as an escape hatch if a player gets stuck on any screen. */
function GlobalExitButton() {
  const { state, leaveRoom } = useGameContext();
  const { leave } = useRoom();
  if (!state.roomId) return null;

  const handleExit = async () => {
    if (window.confirm('Leave game and return to home?')) {
      try { await leave(); } catch (_) {}
      leaveRoom();
    }
  };

  return (
    <Tooltip title="Leave game" placement="left">
      <IconButton
        onClick={handleExit}
        size="small"
        sx={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          bgcolor: 'rgba(14,21,32,0.85)', border: '1px solid rgba(239,68,68,0.35)',
          color: '#ef4444', backdropFilter: 'blur(6px)',
          width: 38, height: 38,
          '&:hover': { bgcolor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444' },
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        <ExitToAppIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}

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

  const isGameStateReady = () => {
    if (!room) return false;
    switch (room.gameType) {
      case 'drawing': return !!room.currentDrawer;
      case 'ludo': return !!room.ludoState;
      case 'snakeladder': return !!room.slState;
      case 'uno': return !!room.unoState;
      case 'minigolf': return !!room.miniGolfState;
      case 'quiz': return !!room.quizState;
      default: return true;
    }
  };

  return (
    <>
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
            {isGameStateReady() ? (
              <GameComp />
            ) : (
              <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#080c12', color: 'white' }}>
                <CircularProgress sx={{ color: '#4CC9F0', mb: 2 }} />
                <Typography sx={{ fontWeight: 700, color: '#8b949e' }}>Loading game state...</Typography>
              </Box>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global escape hatch — floats over any game screen */}
      <GlobalExitButton />
    </>
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

