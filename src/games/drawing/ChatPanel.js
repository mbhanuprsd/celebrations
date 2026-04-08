// src/games/drawing/ChatPanel.js
import React, { useState, useRef, useEffect } from 'react';
import {
  Box, TextField, IconButton, Typography, Paper, Avatar, Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { sendChatMessage, submitGuess } from '../../firebase/services';
import { DrawingGameEngine } from './DrawingGameEngine';

export function ChatPanel({ roomId, userId, playerName, room, chat, isDrawer }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const hasGuessedCorrectly = !!room.guessedPlayers?.[userId];
  const isPlaying = room.status === 'playing';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');

    if (isDrawer) {
      await sendChatMessage(roomId, userId, playerName, text, 'chat');
      return;
    }

    if (isPlaying && room.currentWord && !hasGuessedCorrectly) {
      const isCorrect = await submitGuess(roomId, userId, playerName, text, room.currentWord);
      if (isCorrect) {
        const now = Date.now();
        const startTime = room.roundStartTime?.seconds
          ? room.roundStartTime.seconds * 1000
          : room.roundStartTime;
        const elapsed = (now - startTime) / 1000;
        const timeRemaining = Math.max(0, room.settings.drawTime - elapsed);
        const currentGuessers = room.guessedPlayers || {};
        const engine = new DrawingGameEngine(roomId, userId, room);
        await engine.onCorrectGuess(userId, playerName, timeRemaining, room.settings.drawTime, currentGuessers);

        // Check if all non-drawers guessed
        const nonDrawers = Object.keys(room.players).filter(id => id !== room.currentDrawer);
        const newGuessers = { ...currentGuessers, [userId]: true };
        if (nonDrawers.every(id => newGuessers[id])) {
          await engine.onAllGuessed(room.currentWord);
        }
      }
    } else {
      await sendChatMessage(roomId, userId, playerName, text, 'chat');
    }
  };

  const getMessageStyle = (msg) => {
    switch (msg.type) {
      case 'correct': return { bgcolor: '#06D6A015', border: '1px solid #06D6A060', borderRadius: 2 };
      case 'system': return { bgcolor: 'rgba(67,97,238,0.06)', borderRadius: 2 };
      default: return {};
    }
  };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: '1px solid rgba(67,97,238,0.1)', borderRadius: 4,
      overflow: 'hidden', bgcolor: 'white',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5, borderBottom: '1px solid rgba(67,97,238,0.08)',
        background: 'linear-gradient(135deg, #4361EE08, #F7258508)',
      }}>
        <Typography variant="body2" fontWeight={700} color="text.secondary">
          💬 CHAT & GUESSES
        </Typography>
        {hasGuessedCorrectly && (
          <Chip icon={<CheckCircleIcon />} label="You guessed it!" size="small"
            color="success" sx={{ mt: 0.5, height: 22, fontSize: '0.7rem' }} />
        )}
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1,
        display: 'flex', flexDirection: 'column', gap: 0.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(67,97,238,0.2)', borderRadius: 4 },
      }}>
        <AnimatePresence initial={false}>
          {chat.map(msg => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ px: 1, py: 0.5, ...getMessageStyle(msg) }}>
                {msg.type === 'system' ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', fontStyle: 'italic' }}>
                    {msg.text}
                  </Typography>
                ) : msg.type === 'correct' ? (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                    <Typography variant="caption" fontWeight={700} color="success.main">
                      {msg.playerName} guessed it!
                    </Typography>
                  </Box>
                ) : (
                  <Box display="flex" gap={0.5} alignItems="baseline">
                    <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ whiteSpace: 'nowrap' }}>
                      {msg.userId === userId ? 'You' : msg.playerName}:
                    </Typography>
                    <Typography variant="caption" color="text.primary" sx={{ wordBreak: 'break-word' }}>
                      {/* Hide the actual word if it's in a guess and they got it wrong */}
                      {msg.text}
                    </Typography>
                  </Box>
                )}
              </Box>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Box
        component="form"
        onSubmit={handleSend}
        sx={{
          px: 1.5, py: 1, borderTop: '1px solid rgba(67,97,238,0.08)',
          display: 'flex', gap: 1, alignItems: 'center',
          bgcolor: hasGuessedCorrectly && isPlaying ? 'rgba(6,214,160,0.05)' : 'white',
        }}
      >
        <TextField
          fullWidth size="small" variant="outlined"
          placeholder={
            isDrawer ? "You're drawing! (no guessing 🤫)" :
            hasGuessedCorrectly ? "You guessed it! Chat freely 🎉" :
            "Type your guess..."
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDrawer && isPlaying}
          inputProps={{ maxLength: 60 }}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: '0.85rem' },
          }}
        />
        <IconButton type="submit" color="primary" size="small"
          disabled={!input.trim() || (isDrawer && isPlaying)}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
            borderRadius: 2, p: 0.8,
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
