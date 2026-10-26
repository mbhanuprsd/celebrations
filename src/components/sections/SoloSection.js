import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { RacingGame } from '../../games/solo/RacingGame';
import { TetrisGame } from '../../games/solo/TetrisGame';
import { FlappyBirdGame } from '../../games/solo/FlappyBirdGame';
import { HangmanGame } from '../../games/solo/HangmanGame';
import { WordleGame } from '../../games/solo/WordleGame';
import { listenSoloLeaderboard, getLocalSoloBest } from '../../firebase/services';

function SoloLeaderboard({ gameId, gameLabel, gameColor, userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const localBest = getLocalSoloBest(userId, gameId);

  useEffect(() => {
    setLoading(true);
    const unsub = listenSoloLeaderboard(gameId, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [gameId]);

  const MEDAL = { 0: '🥇', 1: '🥈', 2: '🥉' };
  const myEntry = entries.find(e => e.uid === userId);
  const myRank = entries.findIndex(e => e.uid === userId);

  return (
    <Box sx={{ mt: 2.5 }}>
      {/* Header row */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.2}>
        <Box display="flex" alignItems="center" gap={0.8}>
          <Box sx={{ width: 3, height: 14, borderRadius: 2, bgcolor: gameColor }} />
          <Typography sx={{ fontWeight: 900, fontSize: '0.78rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {gameLabel} · Top Scores
          </Typography>
        </Box>
        {localBest > 0 && !myEntry && (
          <Typography sx={{ fontSize: '0.68rem', color: '#484f58', fontFamily: 'monospace', fontWeight: 700 }}>
            Your best: {localBest.toLocaleString()}
          </Typography>
        )}
      </Box>

      <Box sx={{
        borderRadius: '16px', overflow: 'hidden',
        border: `1px solid ${gameColor}18`,
        background: `linear-gradient(135deg, ${gameColor}05, rgba(14,18,27,0.95))`,
      }}>
        {loading ? (
          <Box sx={{ py: 2.5, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[0, 1, 2].map(i => (
                <Box key={i} sx={{
                  width: 6, height: 6, borderRadius: '50%', bgcolor: gameColor,
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`, opacity: 0.6,
                  '@keyframes pulse': { '0%,100%': { transform: 'scale(0.8)', opacity: 0.4 }, '50%': { transform: 'scale(1.2)', opacity: 1 } },
                }} />
              ))}
            </Box>
          </Box>
        ) : entries.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>🏁</Typography>
            <Typography sx={{ color: '#484f58', fontSize: '0.78rem', fontWeight: 600 }}>No scores yet — be the first!</Typography>
          </Box>
        ) : (
          entries.map((entry, i) => {
            const isMe = entry.uid === userId;
            const medal = MEDAL[i];
            return (
              <Box
                key={entry.uid}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  px: 1.6, py: 1,
                  borderBottom: i < entries.length - 1 ? `1px solid ${gameColor}10` : 'none',
                  background: isMe ? `${gameColor}10` : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Rank */}
                <Box sx={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                  {medal
                    ? <Typography sx={{ fontSize: '0.9rem' }}>{medal}</Typography>
                    : <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#484f58', fontFamily: 'monospace' }}>#{i + 1}</Typography>
                  }
                </Box>

                {/* Name */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    fontWeight: isMe ? 900 : 700, fontSize: '0.82rem',
                    color: isMe ? gameColor : '#c9d1d9',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.name}
                    {isMe && (
                      <Typography component="span" sx={{
                        fontSize: '0.56rem', fontWeight: 800, color: gameColor,
                        bgcolor: `${gameColor}15`, px: 0.6, py: 0.1,
                        borderRadius: '4px', border: `1px solid ${gameColor}30`, ml: 0.7,
                      }}>YOU</Typography>
                    )}
                  </Typography>
                </Box>

                {/* Score */}
                <Typography sx={{
                  fontFamily: 'monospace', fontWeight: 900,
                  fontSize: i === 0 ? '1rem' : '0.85rem',
                  color: i === 0 ? gameColor : '#8b949e',
                  flexShrink: 0,
                }}>
                  {entry.score.toLocaleString()}
                </Typography>
              </Box>
            );
          })
        )}

        {/* Your rank if outside top list */}
        {!loading && myRank === -1 && localBest > 0 && (
          <>
            <Box sx={{ px: 1.6, py: 0.6, borderTop: `1px dashed ${gameColor}15` }}>
              <Typography sx={{ fontSize: '0.62rem', color: '#484f58', fontWeight: 700, textAlign: 'center' }}>
                · · ·
              </Typography>
            </Box>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.2,
              px: 1.6, py: 1, background: `${gameColor}08`,
            }}>
              <Box sx={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#484f58', fontFamily: 'monospace' }}>
                  —
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: gameColor }}>
                  You
                  <Typography component="span" sx={{
                    fontSize: '0.56rem', fontWeight: 800, color: gameColor,
                    bgcolor: `${gameColor}15`, px: 0.6, py: 0.1,
                    borderRadius: '4px', border: `1px solid ${gameColor}30`, ml: 0.7,
                  }}>YOU</Typography>
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.85rem', color: '#8b949e' }}>
                {localBest.toLocaleString()}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

// ─── Single Player Panel ──────────────────────────────────────────────────────

export const SINGLE_PLAYER_GAMES = [
  {
    id: 'racing',
    label: 'Endless Racing',
    icon: '🏎️',
    description: 'Dodge traffic and survive as long as you can!',
    howToPlay: 'Steer between lanes to avoid traffic and keep driving for as long as possible. Use the arrow keys, swipe, or the on-screen controls.',
    color: '#FF9F1C',
    gradient: 'linear-gradient(135deg, #FF9F1C 0%, #EF476F 100%)',
  },
  {
    id: 'tetris',
    label: 'Tetris',
    icon: '🧩',
    description: 'Clear lines before the stack reaches the top!',
    howToPlay: 'Move the falling pieces left or right and rotate them to complete horizontal lines. Use the down arrow to soft drop and Space for a hard drop. On touch screens, use the on-screen controls.',
    color: '#c77dff',
    gradient: 'linear-gradient(135deg, #c77dff 0%, #7209B7 100%)',
  },
  {
    id: 'flappy',
    label: 'Flappy Bird',
    icon: '🐦',
    description: 'Tap to flap through pipes and set a new high score!',
    howToPlay: 'Tap the screen or press Space or the Up arrow to flap. Fly through the gaps between pipes without hitting them.',
    color: '#06D6A0',
    gradient: 'linear-gradient(135deg, #06D6A0 0%, #4CC9F0 100%)',
  },
  {
    id: 'hangman',
    label: 'Hangman',
    icon: '🪢',
    description: 'Guess the word before the hangman is complete!',
    howToPlay: 'Choose letters from the on-screen keyboard to reveal the hidden word. Each incorrect guess adds a part to the hangman, so solve the word before you run out of chances.',
    color: '#c77dff',
    gradient: 'linear-gradient(135deg, #c77dff 0%, #7209B7 100%)',
  },
  {
    id: 'wordle',
    label: 'Wordle',
    icon: '🔠',
    description: 'Guess the 5-letter word in 6 tries!',
    howToPlay: 'Enter a five-letter guess and submit it. The tile colors show which letters are correct and in the right place, present in the word elsewhere, or not in the word. Solve it in six guesses.',
    color: '#6aaa64',
    gradient: 'linear-gradient(135deg, #6aaa64 0%, #4a7a42 100%)',
  },
];

function SoloGamesPanel({ onLaunch, userId }) {
  return (
    <Box>
      {/* ── Game List (top) ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg,#FF9F1C,#EF476F)' }} />
        <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Pick Your Game
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3.5 }}>
        {SINGLE_PLAYER_GAMES.map((game) => (
          <motion.div key={game.id} whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.96 }}>
            <Box
              onClick={() => onLaunch(game.id)}
              sx={{
                border: `1px solid ${game.color}28`, borderRadius: '18px',
                background: `linear-gradient(145deg, ${game.color}10, rgba(14,18,27,0.97))`,
                p: '16px 14px', cursor: 'pointer',
                boxShadow: `0 4px 20px ${game.color}10`,
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.18s', height: '100%',
                '&:hover': { border: `1px solid ${game.color}55`, boxShadow: `0 6px 30px ${game.color}22` },
              }}
            >
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: game.gradient, borderRadius: '18px 18px 0 0' }} />
              <Box sx={{
                position: 'absolute', top: 10, right: 10,
                width: 22, height: 22, borderRadius: '50%',
                background: `${game.color}18`, border: `1px solid ${game.color}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.55rem', color: game.color, lineHeight: 1 }}>▶</Typography>
              </Box>
              <Typography sx={{ fontSize: '2rem', mb: 1, display: 'block' }}>{game.icon}</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '0.88rem', color: game.color, mb: 0.4, lineHeight: 1.2 }}>
                {game.label}
              </Typography>
              <Typography sx={{ fontSize: '0.67rem', color: '#6b7280', lineHeight: 1.4 }}>
                {game.description}
              </Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* ── Score Dashboard (bottom) ─────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg,#FFD166,#c77dff)' }} />
        <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Score Dashboard
        </Typography>
        <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.05)', ml: 0.5 }} />
        <Typography sx={{ fontSize: '0.65rem', color: '#484f58', fontWeight: 700 }}>All Games</Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SINGLE_PLAYER_GAMES.map((game) => (
          <SoloLeaderboard
            key={game.id}
            gameId={game.id}
            gameLabel={game.label}
            gameColor={game.color}
            userId={userId}
          />
        ))}
      </Box>

      <Typography sx={{ color: '#2d3340', fontSize: '0.68rem', fontWeight: 700, mt: 3, textAlign: 'center' }}>
        🎮 More solo games dropping soon...
      </Typography>
    </Box>
  );
}

// ─── Main HomeScreen ───────────────────────────────────────────────────────────

export function SoloSection({ onLaunch, userId }) {
  return <SoloGamesPanel onLaunch={onLaunch} userId={userId} />;
}

export function SoloGameOverlay({ gameId, onExit, userId, playerName }) {
  const gameProps = { onExit, userId, playerName };
  switch (gameId) {
    case 'racing': return <RacingGame {...gameProps} />;
    case 'tetris': return <TetrisGame {...gameProps} />;
    case 'flappy': return <FlappyBirdGame {...gameProps} />;
    case 'hangman': return <HangmanGame {...gameProps} />;
    case 'wordle': return <WordleGame {...gameProps} />;
    default: return null;
  }
}
