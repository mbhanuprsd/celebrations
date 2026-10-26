import React, { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, CircularProgress, Collapse, IconButton, Skeleton, TextField, Tooltip, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import { GAME_META } from '../../core/GameEngine';
import { getUserGameHistory } from '../../firebase/services';
import { GAME_GRADIENTS, GAME_GLOW, RANK_MEDAL, nameColor, timeAgo } from './sectionUtils';
import { GuestGateMessage } from './GuestGateMessage';

function PastGamesSection({ games, loading, error, onRetry, isAnonymous }) {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState(null);

  if (isAnonymous) return <GuestGateMessage feature="Past Games" />;

  if (loading) return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.2}>
        <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Past Games</Typography>
      </Box>
      {[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 0.9, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }} />)}
    </Box>
  );

  if (error) return (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}
      sx={{ mb: 2, borderRadius: '14px' }}
    >
      Could not load game history: {error}
    </Alert>
  );

  if (games.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 5, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>🎮</Typography>
      <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 700 }}>No games played yet</Typography>
      <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mt: 0.3 }}>Join a room to start playing!</Typography>
    </Box>
  );

  // Show 3 initially; "show more" reveals everything fetched
  const visible = expanded ? games : games.slice(0, 3);

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Past Games</Typography>
          <Chip label={games.length} size="small" sx={{ height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(76,201,240,0.14)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.28)' }} />
        </Box>
        {games.length > 3 && (
          <Typography onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.66rem', color: '#4CC9F0', cursor: 'pointer', fontWeight: 700, '&:hover': { opacity: 0.8 } }}>
            {expanded ? 'Show less' : `+${games.length - 3} more`}
          </Typography>
        )}
      </Box>
      <AnimatePresence initial={false}>
        {visible.map((game, i) => {
          const glow = GAME_GLOW[game.gameType] || '#4CC9F0';
          const grad = GAME_GRADIENTS[game.gameType] || GAME_GRADIENTS.drawing;
          const meta = GAME_META[game.gameType] || {};
          const myRank = game.myRank || game.rank || 0;
          const isWin = typeof game.isWinner === 'boolean' ? game.isWinner : myRank === 1;
          const isOpen = openId === game.id;
          const rankedPlayers = game.rankedPlayers || [];
          const opponents = (Array.isArray(game.opponents) && game.opponents.length
            ? game.opponents
            : rankedPlayers.filter(player => !player.isMe).map(player => player.name))
            .map(player => typeof player === 'string' ? player : player?.name)
            .filter(Boolean);
          const hasBotCount = Number.isInteger(game.botsPlayed);
          const hasScores = rankedPlayers.some(p => p.score != null && p.score > 0);
          const winnerName = game.winnerName || game.winner || '';
          return (
            <motion.div key={game.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
              <Box
                onClick={() => setOpenId(isOpen ? null : game.id)}
                sx={{
                  border: `1px solid ${glow}${isWin ? '40' : '1a'}`, borderRadius: '16px',
                  background: isWin ? `linear-gradient(135deg, ${glow}10, rgba(14,18,27,0.97))` : 'rgba(255,255,255,0.025)',
                  mb: 0.9, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isWin ? `0 4px 20px ${glow}14` : 'none',
                  '&:hover': { borderColor: `${glow}40` }, transition: 'border-color 0.15s',
                }}
              >
                <Box sx={{ height: 2, background: grad, opacity: isWin ? 1 : 0.4 }} />
                <Box display="flex" alignItems="center" gap={1.4} px={1.6} py={1.2}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '11px', flexShrink: 0, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', opacity: isWin ? 1 : 0.7, boxShadow: isWin ? `0 3px 12px ${glow}40` : 'none' }}>
                    {meta.icon || '🎮'}
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Box display="flex" alignItems="center" gap={0.7} flexWrap="wrap">
                      <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: isWin ? glow : '#c9d1d9' }}>
                        {GAME_META[game.gameType]?.label || game.gameType}
                      </Typography>
                      <Chip
                        label={`${RANK_MEDAL[myRank] || `#${myRank}`} ${isWin ? 'Winner!' : `${myRank}/${game.totalPlayers}`}`}
                        size="small"
                        sx={{
                          height: 17, fontSize: '0.6rem', fontWeight: 900,
                          bgcolor: isWin ? 'rgba(255,215,0,0.13)' : myRank === 2 ? 'rgba(192,192,192,0.1)' : myRank === 3 ? 'rgba(205,127,50,0.1)' : 'rgba(255,255,255,0.06)',
                          color: isWin ? '#FFD700' : myRank === 2 ? '#C0C0C0' : myRank === 3 ? '#CD7F32' : '#8b949e',
                          border: isWin ? '1px solid rgba(255,215,0,0.32)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    </Box>
                    {!isWin && winnerName && <Typography sx={{ fontSize: '0.63rem', color: '#FFD700', mt: 0.15, fontWeight: 700 }}>🏆 {winnerName} won</Typography>}
                    {!isOpen && rankedPlayers.length > 0 && (
                      <Box display="flex" alignItems="center" gap={0.4} mt={0.35} flexWrap="wrap">
                        {rankedPlayers.slice(0, 5).map((p, j) => (
                          <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.55, py: 0.1, borderRadius: '7px', bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.05)', border: p.isMe ? `1px solid ${glow}35` : '1px solid rgba(255,255,255,0.07)' }}>
                            <Typography sx={{ fontSize: '0.58rem' }}>{RANK_MEDAL[p.rank] || `#${p.rank}`}</Typography>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: p.isMe ? 900 : 600, color: p.isMe ? glow : '#8b949e', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.isMe ? 'You' : p.name}
                            </Typography>
                            {hasScores && p.score != null && <Typography sx={{ fontSize: '0.58rem', color: '#484f58' }}>{p.score}pt</Typography>}
                          </Box>
                        ))}
                        {rankedPlayers.length > 5 && <Typography sx={{ fontSize: '0.57rem', color: '#484f58' }}>+{rankedPlayers.length - 5}</Typography>}
                      </Box>
                    )}
                  </Box>
                  <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.3} flexShrink={0}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#484f58' }}>{timeAgo(game.playedAt)}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#484f58', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</Typography>
                  </Box>
                </Box>
                <Collapse in={isOpen}>
                  <Box sx={{ px: 1.6, pb: 1.4, pt: 0.2 }}>
                    <Box sx={{ height: '1px', bgcolor: 'rgba(255,255,255,0.06)', mb: 1.2 }} />
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.8 }}>
                      Played with
                    </Typography>
                    {opponents.length > 0 || (hasBotCount && game.botsPlayed > 0) ? (
                      <Box display="flex" gap={0.6} flexWrap="wrap" mb={1.4}>
                        {opponents.map((name, index) => (
                          <Chip
                            key={`${name}-${index}`}
                            avatar={<Avatar sx={{ bgcolor: nameColor(name), color: '#fff !important', fontSize: '0.58rem !important', fontWeight: 900 }}>{name.slice(0, 2).toUpperCase()}</Avatar>}
                            label={name}
                            size="small"
                            sx={{ color: '#c9d1d9', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                        ))}
                        {hasBotCount && game.botsPlayed > 0 && (
                          <Chip
                            key="bots-played"
                            label={`${game.botsPlayed} bot${game.botsPlayed === 1 ? '' : 's'} played`}
                            size="small"
                            sx={{ color: '#c4b5fd', bgcolor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.72rem', color: '#484f58', mb: 1.4 }}>
                        {hasBotCount
                          ? 'No bots played in this game.'
                          : 'Opponent and bot details weren’t saved for this game.'}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.8 }}>Final Standings</Typography>
                    {rankedPlayers.map((p, j) => {
                      const rowColor = nameColor(p.name);
                      const isFirst = p.rank === 1;
                      return (
                        <motion.div key={j} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: j * 0.045 }}>
                          <Box display="flex" alignItems="center" gap={1.2} sx={{ p: '7px 10px', mb: 0.5, borderRadius: '10px', bgcolor: p.isMe ? `${glow}12` : isFirst ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.03)', border: p.isMe ? `1px solid ${glow}30` : isFirst ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography sx={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{RANK_MEDAL[p.rank] || `#${p.rank}`}</Typography>
                            <Avatar sx={{ width: 24, height: 24, bgcolor: rowColor, fontSize: '0.55rem', fontWeight: 900, flexShrink: 0 }}>{(p.name || '?').slice(0, 2).toUpperCase()}</Avatar>
                            <Typography sx={{ flex: 1, fontWeight: p.isMe ? 900 : 700, fontSize: '0.78rem', color: p.isMe ? glow : isFirst ? '#FFD700' : '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.isMe ? `${p.name} (You)` : p.name}
                            </Typography>
                            {hasScores && p.score != null && (
                              <Chip label={`${p.score} pts`} size="small" sx={{ height: 17, fontSize: '0.6rem', fontWeight: 900, flexShrink: 0, bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.06)', color: p.isMe ? glow : '#8b949e', border: p.isMe ? `1px solid ${glow}30` : '1px solid rgba(255,255,255,0.08)' }} />
                            )}
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}

function ProfileSection({ state, updateUsername, logout }) {
  const { playerName, userId, userEmail, isAnonymous } = state;
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState('');
  const [historyRequest, setHistoryRequest] = useState(0);
  const [stats, setStats] = useState({ played: 0, wins: 0, top3: 0 });

  useEffect(() => {
    let active = true;
    setGames([]);
    setStats({ played: 0, wins: 0, top3: 0 });
    setGamesError('');
    if (!userId || isAnonymous) {
      setGamesLoading(false);
      return () => { active = false; };
    }

    setGamesLoading(true);
    getUserGameHistory(userId).then(data => {
      if (!active) return;
      setGames(data);
      setStats({
        played: data.length,
        wins: data.filter(game => (game.myRank || game.rank) === 1).length,
        top3: data.filter(game => {
          const rank = game.myRank || game.rank;
          return rank > 0 && rank <= 3;
        }).length,
      });
    }).catch(error => {
      if (!active) return;
      console.error('Could not load game history:', error);
      setGamesError(error.message || 'Could not load your game history.');
    }).finally(() => {
      if (active) setGamesLoading(false);
    });

    return () => { active = false; };
  }, [userId, isAnonymous, historyRequest]);

  const startEdit = () => { setNameInput(playerName || ''); setNameError(''); setEditingName(true); };
  const cancelEdit = () => { setEditingName(false); setNameError(''); };
  const saveEdit = async () => {
    if (nameInput.trim() === playerName) { cancelEdit(); return; }
    setNameSaving(true); setNameError('');
    try { await updateUsername(nameInput); setEditingName(false); }
    catch (err) { setNameError(err.message || 'Could not update'); }
    finally { setNameSaving(false); }
  };

  const STAT_CARDS = [
    { label: 'Played', value: stats.played, icon: '🎮', color: '#4CC9F0' },
    { label: 'Wins',   value: stats.wins,   icon: '🏆', color: '#FFD700' },
    { label: 'Top 3',  value: stats.top3,   icon: '🎖️', color: '#F72585' },
  ];

  return (
    <Box>
      {/* Card */}
      <Box sx={{
        p: 2.5, mb: 2.5, borderRadius: '22px',
        background: 'rgba(14,18,27,0.93)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 70px rgba(0,0,0,0.6)',
      }}>
        {/* Avatar + name */}
        <Box display="flex" alignItems="center" gap={2} mb={2.5}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar sx={{ width: 58, height: 58, background: 'linear-gradient(135deg, #4CC9F0, #7209B7)', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 0 24px rgba(76,201,240,0.4)' }}>
              {playerName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', bgcolor: '#22C55E', border: '2.5px solid #080c12', boxShadow: '0 0 6px #22C55E' }} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography sx={{ color: '#484f58', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.3 }}>Your Profile</Typography>
            {editingName ? (
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TextField
                    value={nameInput}
                    onChange={e => { setNameInput(e.target.value); setNameError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    size="small" autoFocus inputProps={{ maxLength: 20 }} error={!!nameError}
                    sx={{
                      width: 140,
                      '& .MuiInputBase-input': { color: '#e6edf3', fontSize: '0.9rem', fontWeight: 700, py: '4px', px: '8px' },
                      '& .MuiOutlinedInput-root': { borderRadius: '8px', '& fieldset': { borderColor: 'rgba(76,201,240,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#4CC9F0' } },
                    }}
                  />
                  <Tooltip title="Save"><span>
                    <IconButton size="small" onClick={saveEdit} disabled={nameSaving} sx={{ color: '#22C55E', p: 0.4, '&:hover': { bgcolor: 'rgba(34,197,94,0.1)' } }}>
                      {nameSaving ? <CircularProgress size={13} sx={{ color: '#22C55E' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span></Tooltip>
                  <Tooltip title="Cancel"><span>
                    <IconButton size="small" onClick={cancelEdit} sx={{ color: '#8b949e', p: 0.4, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span></Tooltip>
                </Box>
                {nameError && <Typography sx={{ color: '#EF233C', fontSize: '0.6rem', mt: 0.4 }}>{nameError}</Typography>}
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography sx={{ color: '#4CC9F0', fontWeight: 900, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{playerName}</Typography>
                <Tooltip title="Edit username">
                  <IconButton size="small" onClick={startEdit} sx={{ color: '#30404f', p: 0.3, '&:hover': { color: '#4CC9F0', bgcolor: 'rgba(76,201,240,0.08)' } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {userEmail && !editingName && (
              <Typography sx={{ color: '#8b949e', fontSize: '0.6rem', mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{userEmail}</Typography>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2.5 }}>
          {STAT_CARDS.map(s => (
            <Box key={s.label} sx={{ textAlign: 'center', p: '10px 8px', borderRadius: '14px', bgcolor: `${s.color}0d`, border: `1px solid ${s.color}22` }}>
              <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{s.icon}</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: s.color, lineHeight: 1.1, mt: 0.2 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: '#484f58', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Sign out */}
        <Button fullWidth variant="outlined" onClick={logout} startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: '12px', fontWeight: 800, fontSize: '0.8rem', borderColor: 'rgba(239,35,60,0.25)', color: '#EF233C', background: 'rgba(239,35,60,0.05)', '&:hover': { borderColor: '#EF233C', background: 'rgba(239,35,60,0.1)' } }}>
          Sign Out
        </Button>
      </Box>

      <PastGamesSection
        games={games}
        loading={gamesLoading}
        error={gamesError}
        onRetry={() => setHistoryRequest(request => request + 1)}
        isAnonymous={isAnonymous}
      />
    </Box>
  );
}

// ─── Solo Leaderboard ─────────────────────────────────────────────────────────

export { ProfileSection };
