import React, { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { motion } from 'framer-motion';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { useGameContext } from '../../context/GameContext';
import { listenGlobalChat, sendGlobalMessage } from '../../firebase/services';
import { nameColor } from './sectionUtils';
import { GuestGateMessage } from './GuestGateMessage';

function getDateLabel(ts) {
  if (!ts) return null;
  const ms   = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null);
  if (!ms) return null;
  const d    = new Date(ms);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function isSameDay(tsA, tsB) {
  const toMs = t => t?.toMillis ? t.toMillis() : (typeof t === 'number' ? t : null);
  const a = toMs(tsA), b = toMs(tsB);
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function ChatTick({ double = false, read = false }) {
  const color = read ? '#4CC9F0' : 'rgba(255,255,255,0.55)';
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.4, verticalAlign: 'middle' }}>
      <svg width={double ? 16 : 10} height={10} viewBox={double ? '0 0 16 10' : '0 0 10 10'}>
        <polyline points="1,5 4,8 9,1" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {double && <polyline points="7,5 10,8 15,1" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </Box>
  );
}

// ─── Guest Gate ───────────────────────────────────────────────────────────────

function GlobalChatPanel({ userId, playerName }) {
  const [messages, setMessages]   = useState([]);
  const [input,    setInput]      = useState('');
  const [sending,  setSending]    = useState(false);
  const [chatError, setChatError] = useState('');
  const { count: onlineCount }    = useOnlineUsers();
  const { notify } = useGameContext();
  const inputRef   = useRef(null);
  const messagesRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const unsub = listenGlobalChat(
      nextMessages => {
        setMessages(nextMessages);
        setChatError('');
      },
      error => {
        console.error('Global chat listener failed:', error);
        setChatError('Could not load chat messages. Please try again later.');
      }
    );
    return unsub;
  }, []);

  // Keep the latest messages in view without pulling users away from older messages.
  useEffect(() => {
    if (stickToBottomRef.current) {
      const messagesElement = messagesRef.current;
      messagesElement?.scrollTo({
        top: messagesElement.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSend = async () => {
    const draft = input;
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendGlobalMessage(userId, playerName, text);
      setInput(current => current === draft ? '' : current);
      setChatError('');
      inputRef.current?.focus();
    } catch (e) {
      console.error('Global chat send failed:', e);
      notify('Could not send your message. Your draft has been kept.', 'error');
    }
    finally { setSending(false); }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now());
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Pre-process: figure out first/last of each run for tail rendering
  const processed = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isFirstOfRun = !prev || prev.userId !== msg.userId || !isSameDay(prev.timestamp, msg.timestamp);
    const isLastOfRun  = !next || next.userId !== msg.userId || !isSameDay(next.timestamp, msg.timestamp);
    const showDateSep  = !prev || !isSameDay(prev.timestamp, msg.timestamp);
    return { ...msg, isFirstOfRun, isLastOfRun, showDateSep };
  });

  return (
    // Full-height container that bleeds to page edges (negative mx to cancel parent padding)
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100dvh - 80px)',
      minHeight: 0, boxSizing: 'border-box',
      mx: { xs: -1.5, sm: -2 },       // cancel parent horizontal padding
      borderRadius: '0 0 22px 22px',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── WhatsApp-style header bar ───────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.2,
        px: 2, py: 1.2,
        background: 'rgba(14,18,27,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        zIndex: 2,
      }}>
        {/* Group avatar */}
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 2px rgba(247,37,133,0.3)',
          fontSize: '1.2rem',
        }}>
          🌐
        </Box>

        {/* Name + online */}
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#e6edf3', lineHeight: 1.2 }}>
            Global Chat
          </Typography>
          <Box display="flex" alignItems="center" gap={0.6}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 5px #22C55E' }} />
            </motion.div>
            <Typography sx={{ fontSize: '0.65rem', color: '#22C55E', fontWeight: 700 }}>
              {onlineCount} online
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Chat wallpaper + messages ────────────────────────────────────── */}
      <Box sx={{
        flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        // subtle dot-grid wallpaper like WhatsApp
        bgcolor: '#0a0f1a',
        backgroundImage: [
          'radial-gradient(circle, rgba(76,201,240,0.06) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '22px 22px',
        px: 1.5, py: 1,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
      }}
        ref={messagesRef}
        onScroll={event => {
          const element = event.currentTarget;
          stickToBottomRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        }}>
        {chatError && (
          <Alert severity="error" sx={{ mb: 1, fontSize: '0.78rem' }}>
            {chatError}
          </Alert>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.2, opacity: 0.45 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F72585, #7209B7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem',
            }}>💬</Box>
            <Typography sx={{ color: '#8b949e', fontSize: '0.85rem', fontWeight: 800 }}>No messages yet</Typography>
            <Typography sx={{ color: '#484f58', fontSize: '0.72rem' }}>Be the first to say hello 👋</Typography>
          </Box>
        )}

        {/* Messages */}
        {processed.map((msg) => {
          const mine  = msg.userId === userId;
          const color = nameColor(msg.name);

          return (
            <React.Fragment key={msg.id}>
              {/* Date separator pill */}
              {msg.showDateSep && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                  <Box sx={{
                    px: 1.6, py: 0.35, borderRadius: '12px',
                    bgcolor: 'rgba(14,18,27,0.82)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b949e', letterSpacing: '0.04em' }}>
                      {getDateLabel(msg.timestamp)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Row */}
              <Box sx={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 0.7,
                mb: msg.isLastOfRun ? 0.9 : 0.25,
                px: { xs: 0.25, sm: 0.5 },
              }}>
                {/* Avatar — only show at end of other's run */}
                {!mine && (
                  <Box sx={{ width: 28, flexShrink: 0, alignSelf: 'flex-end', mb: 0.25 }}>
                    {msg.isLastOfRun ? (
                      <Avatar sx={{ width: 28, height: 28, bgcolor: color, fontSize: '0.6rem', fontWeight: 900, boxShadow: `0 0 0 2px ${color}30` }}>
                        {(msg.name || '?').slice(0, 2).toUpperCase()}
                      </Avatar>
                    ) : null}
                  </Box>
                )}

                {/* Bubble */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  style={{
                    maxWidth: 'min(82%, 420px)', minWidth: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  {/* Sender name (first of their run, not mine) */}
                  {!mine && msg.isFirstOfRun && (
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, color, mb: 0.3, ml: 0.5 }}>
                      {msg.name}
                    </Typography>
                  )}

                  {/* The bubble itself */}
                  <Box sx={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'end',
                    columnGap: 0.8,
                    width: 'fit-content',
                    maxWidth: '100%',
                    px: 1.3, pt: 0.75, pb: 0.5,
                    borderRadius: mine
                      ? msg.isLastOfRun ? '18px 18px 4px 18px' : '18px'
                      : msg.isLastOfRun ? '18px 18px 18px 4px' : '18px',

                    // Mine: themed gradient; others: dark card
                    background: mine
                      ? 'linear-gradient(135deg, #1a5f7a 0%, #2d1b69 100%)'
                      : 'rgba(22,28,40,0.95)',
                    border: mine
                      ? '1px solid rgba(76,201,240,0.25)'
                      : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: mine
                      ? '0 2px 12px rgba(76,201,240,0.15)'
                      : '0 2px 8px rgba(0,0,0,0.3)',

                    // Tail using CSS clip on the last bubble of a run
                    ...(msg.isLastOfRun && mine && {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        right: -6,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 0 10px 8px',
                        borderColor: 'transparent transparent rgba(76,201,240,0.25) transparent',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: 1,
                        right: -5,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 0 9px 7px',
                        borderColor: 'transparent transparent #2d1b69 transparent',
                        zIndex: 1,
                      },
                    }),
                    ...(msg.isLastOfRun && !mine && {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        left: -6,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 8px 10px 0',
                        borderColor: 'transparent rgba(255,255,255,0.08) transparent transparent',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: 1,
                        left: -4,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 6px 9px 0',
                        borderColor: 'transparent rgba(22,28,40,0.95) transparent transparent',
                        zIndex: 1,
                      },
                    }),
                  }}>
                    {/* Message text */}
                    <Typography sx={{
                      fontSize: '0.87rem', fontWeight: 500, lineHeight: 1.5,
                      color: mine ? '#dff3fb' : '#c9d1d9',
                      wordBreak: 'break-word', overflowWrap: 'anywhere',
                    }}>
                      {msg.text}
                    </Typography>

                    {/* Timestamp stays in its own grid column to avoid overlapping text. */}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.3,
                      whiteSpace: 'nowrap', pb: 0.1,
                    }}>
                      <Typography sx={{ fontSize: '0.58rem', color: mine ? 'rgba(223,243,251,0.5)' : 'rgba(139,148,158,0.7)', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                      {mine && <ChatTick double read />}
                    </Box>
                  </Box>
                </motion.div>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', gap: { xs: 0.75, sm: 1 },
        px: 1.5, py: 1.2,
        background: 'rgba(14,18,27,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {/* Text input — pill-shaped like WhatsApp */}
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'flex-end',
          bgcolor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          minWidth: 0, px: { xs: 1.4, sm: 1.8 }, py: 0.6,
          transition: 'border-color 0.2s',
          '&:focus-within': { borderColor: 'rgba(247,37,133,0.5)' },
        }}>
          <TextField
            inputRef={inputRef}
            fullWidth multiline maxRows={4}
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            inputProps={{ maxLength: 300 }}
            variant="standard"
            sx={{
              '& .MuiInputBase-root': {
                color: '#e6edf3', fontSize: '0.9rem', lineHeight: 1.5,
                '&:before': { display: 'none' },
                '&:after':  { display: 'none' },
              },
              '& .MuiInputBase-input::placeholder': { color: '#484f58', opacity: 1 },
            }}
          />
        </Box>

        {/* Send button */}
        <motion.div whileTap={!sending && !!input.trim() ? { scale: 0.88 } : {}}
          whileHover={!sending && !!input.trim() ? { scale: 1.05 } : {}}>
          <IconButton
            aria-label="Send message"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            sx={{
              width: 46, height: 46, flexShrink: 0, borderRadius: '50%',
              background: input.trim()
                ? 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)'
                : 'rgba(255,255,255,0.07)',
              cursor: input.trim() && !sending ? 'pointer' : 'default',
              boxShadow: input.trim() ? '0 4px 18px rgba(247,37,133,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {sending
              ? <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.6)' }} />
              : <SendIcon sx={{ fontSize: 19, color: input.trim() ? 'white' : '#484f58', ml: '2px', transition: 'color 0.2s' }} />
            }
          </IconButton>
        </motion.div>
      </Box>
    </Box>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

export function ChatSection({ state, playerName }) {
  return state.isAnonymous
    ? <GuestGateMessage feature="Global Chat" />
    : <GlobalChatPanel userId={state.userId} playerName={playerName} />;
}
