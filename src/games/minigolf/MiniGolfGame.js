// src/games/minigolf/MiniGolfGame.js
import React from 'react';
import { Box, Typography } from '@mui/material';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import { moveBall, endTurn } from './minigolfFirebaseService';
import { MINIGOLF_SETTINGS, HOLES } from './minigolfConstants';

export function MiniGolfGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, userId } = state;
  const u = room?.miniGolfState;

  const { online, confirmOpen, cancelLeave, confirmLeave } = useGameGuard({
    roomId: state.roomId, userId, gameType: 'minigolf', leaveCallback: leave,
  });

  if (!room || !u || !u.playerOrder) return null;

  const isMyTurn = u.playerOrder && u.playerOrder[u.currentIndex] === userId;
  const currentHole = HOLES[u.currentHoleIdx] || HOLES[0];

  const handleHit = async (vx, vy) => {
    if (!isMyTurn) return;
    await moveBall(room.id, userId, vx, vy);
    // In a real physics implementation, we'd wait for the ball to stop
    // For this MVP, we'll end turn after a delay or manually
    setTimeout(() => endTurn(room.id, userId), 3000);
  };

  return (
    <Box sx={{ height: '100dvh', bgcolor: '#1a472a', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10 }}>
        <Typography variant="h6">{currentHole.name}</Typography>
        <Typography variant="body2">Turn: {room.players[u.playerOrder[u.currentIndex]]?.name}</Typography>
      </Box>

      <Box sx={{ 
        position: 'relative', width: 800, height: 600, 
        bgcolor: '#2e7d32', mx: 'auto', mt: '10vh', 
        borderRadius: 4, border: '8px solid #5d4037',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Hole */}
        <Box sx={{ 
          position: 'absolute', left: currentHole.holePos.x, top: currentHole.holePos.y,
          width: MINIGOLF_SETTINGS.holeRadius * 2, height: MINIGOLF_SETTINGS.holeRadius * 2,
          bgcolor: 'black', borderRadius: '50%', zIndex: 1 
        }} />

        {/* Balls */}
        {Object.entries(u.balls).map(([uid, ball]) => (
          <Box key={uid} sx={{ 
            position: 'absolute', left: ball.x, top: ball.y,
            width: MINIGOLF_SETTINGS.ballRadius * 2, height: MINIGOLF_SETTINGS.ballRadius * 2,
            bgcolor: uid === userId ? 'white' : '#facc15',
            borderRadius: '50%', zIndex: 2,
            transition: 'all 0.1s linear',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <Typography sx={{ fontSize: '0.5rem', position: 'absolute', top: -15, left: 0, color: 'white' }}>
              {room.players[uid]?.name}
            </Typography>
          </Box>
        ))}
      </Box>

      {isMyTurn && (
        <Box sx={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <Typography sx={{ color: 'white', mb: 2, fontWeight: 900 }}>Drag to aim and shoot!</Typography>
          <Box 
            onClick={() => handleHit(0, -10)} 
            sx={{ px: 4, py: 2, bgcolor: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 900 }}
          >
            Shoot Up
          </Box>
        </Box>
      )}

      <OfflineBanner online={online} />
      <LeaveConfirmModal 
        open={confirmOpen} 
        onClose={cancelLeave} 
        onConfirm={confirmLeave} 
      />
    </Box>
  );
}
