// src/games/uno/UnoGame.js  — Ocho (Plato) style
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, Avatar, Modal } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ReplayIcon from '@mui/icons-material/Replay';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import { playUnoCard, drawUnoCard, resetUnoGame } from './unoFirebaseService';
import { canPlayCard, getCardLabel, UNO_COLOR_META, PLAYABLE_COLORS } from './unoConstants';
import { saveGameHistory } from '../../firebase/services';
import { UnoErrorBoundary } from './ErrorBoundary';

const C = UNO_COLOR_META;

// ─── UNO card face ────────────────────────────────────────────────────────────
function UnoCard({ card, playable, highlighted, onClick, size = 'md', rotate = 0, zIndex, style = {} }) {
  if (!card) return null;
  const isWild = card.color === 'wild';
  const cm = isWild ? null : C[card.color];
  const label = getCardLabel(card);
  const dims = {
    xs: { w: 30, h: 44, r: '5px',  fs: '0.65rem', cfs: '0.35rem' },
    sm: { w: 40, h: 58, r: '7px',  fs: '0.9rem',  cfs: '0.4rem'  },
    md: { w: 54, h: 80, r: '9px',  fs: label.length > 1 ? '1.1rem' : '1.55rem', cfs: '0.48rem' },
    lg: { w: 64, h: 95, r: '11px', fs: label.length > 1 ? '1.3rem' : '1.8rem',  cfs: '0.55rem' },
  }[size];
  const bg = isWild
    ? 'conic-gradient(from 45deg,#E53935 0% 25%,#1E88E5 25% 50%,#43A047 50% 75%,#FDD835 75% 100%)'
    : `linear-gradient(158deg,${cm.hex} 0%,${cm.dark}e0 100%)`;
  const glowColor = isWild ? '#ffffff' : cm.hex;
  return (
    <motion.div
      whileHover={playable ? { y: -16, scale: 1.12, transition: { type: 'spring', stiffness: 420, damping: 18 } } : {}}
      whileTap={playable ? { scale: 0.9 } : {}}
      onClick={playable ? onClick : undefined}
      style={{ flexShrink: 0, cursor: playable ? 'pointer' : 'default', rotate: `${rotate}deg`, zIndex, ...style }}
    >
      <Box sx={{
        width: dims.w, height: dims.h, borderRadius: dims.r, background: bg,
        border: highlighted ? '3px solid #fff' : `2px solid rgba(255,255,255,${playable ? 0.65 : 0.15})`,
        boxShadow: highlighted
          ? `0 0 28px ${glowColor}aa, 0 8px 24px rgba(0,0,0,0.6)`
          : playable ? `0 6px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)` : `0 2px 8px rgba(0,0,0,0.45)`,
        opacity: (playable || highlighted) ? 1 : 0.42,
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '46%', background: 'linear-gradient(180deg,rgba(255,255,255,0.22) 0%,transparent 100%)', pointerEvents: 'none' }} />
        <Box sx={{ width: '72%', height: '66%', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.38)', background: 'rgba(0,0,0,0.12)', transform: 'rotate(-28deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: dims.fs, fontWeight: 900, color: 'white', transform: 'rotate(28deg)', textShadow: '0 2px 8px rgba(0,0,0,0.7)', lineHeight: 1 }}>{label}</Typography>
        </Box>
        <Typography sx={{ position: 'absolute', top: 2, left: 3, fontSize: dims.cfs, fontWeight: 900, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>{label}</Typography>
        <Typography sx={{ position: 'absolute', bottom: 2, right: 3, fontSize: dims.cfs, fontWeight: 900, color: 'rgba(255,255,255,0.9)', transform: 'rotate(180deg)', lineHeight: 1 }}>{label}</Typography>
      </Box>
    </motion.div>
  );
}

// ─── Card back ────────────────────────────────────────────────────────────────
function CardBack({ size = 'md', rotate = 0, onClick, disabled, style = {} }) {
  const dims = { xs:{w:30,h:44,r:'5px'}, sm:{w:40,h:58,r:'7px'}, md:{w:54,h:80,r:'9px'}, lg:{w:64,h:95,r:'11px'} }[size];
  return (
    <motion.div whileHover={!disabled?{scale:1.07,y:-3}:{}} whileTap={!disabled?{scale:0.93}:{}}
      onClick={!disabled?onClick:undefined} style={{ cursor:disabled?'default':'pointer', rotate:`${rotate}deg`, flexShrink:0, ...style }}>
      <Box sx={{
        width:dims.w, height:dims.h, borderRadius:dims.r,
        background:'linear-gradient(145deg,#1a1060 0%,#2e1472 50%,#1a1060 100%)',
        border:`2px solid ${disabled?'rgba(255,255,255,0.08)':'rgba(150,80,255,0.55)'}`,
        boxShadow:disabled?'none':'0 4px 18px rgba(100,40,220,0.4)',
        display:'flex', alignItems:'center', justifyContent:'center',
        opacity:disabled?0.45:1, overflow:'hidden', position:'relative',
      }}>
        <Box sx={{ position:'absolute', inset:3, borderRadius:'inherit', border:'1.5px solid rgba(160,100,255,0.3)', background:'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(160,100,255,0.04) 4px,rgba(160,100,255,0.04) 8px)' }} />
        <Typography sx={{ fontSize:size==='xs'||size==='sm'?'0.52rem':'0.65rem', fontWeight:900, color:'#c084fc', letterSpacing:'1.5px', zIndex:1 }}>UNO</Typography>
      </Box>
    </motion.div>
  );
}

// ─── Opponent slot (card fan + avatar) ───────────────────────────────────────
function OpponentSlot({ uid, cardCount, isCurrentTurn, player, isFinished, rank, position }) {
  const name = player?.name || '?';
  const count = Math.min(cardCount, 12);
  const isVertical = position === 'left' || position === 'right';
  const fanCount = Math.max(1, count);
  const spread = Math.min(10, count * 2.2);
  return (
    <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0.5 }}>
      {/* Stacked card fan */}
      <Box sx={{ position:'relative', width: isVertical ? 44 : Math.min(110,fanCount*9+36), height: isVertical ? Math.min(110,fanCount*9+36) : 52 }}>
        {Array.from({ length: Math.min(fanCount,7) }).map((_, i) => (
          <Box key={i} sx={{ position: i===0?'relative':'absolute', [isVertical?'top':'left']: i===0?'auto':`${i*(spread/fanCount)}px`, zIndex:i }}>
            <CardBack size="xs" rotate={isVertical ? (position==='left'?-90:90) : (i - fanCount/2)*2.5} />
          </Box>
        ))}
        {/* count badge */}
        <Box sx={{ position:'absolute', top:-7, right:-7, zIndex:20, width:20, height:20, borderRadius:'50%', bgcolor:cardCount===1?'#ef4444':'#6d28d9', border:'2px solid #0d1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Typography sx={{ fontSize:'0.5rem', fontWeight:900, color:'#fff' }}>{cardCount}</Typography>
        </Box>
      </Box>
      {/* Avatar + name */}
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0.2 }}>
        <Box sx={{ position:'relative' }}>
          {isCurrentTurn && (
            <motion.div animate={{ opacity:[1,0.3,1], scale:[1,1.08,1] }} transition={{ repeat:Infinity, duration:0.85 }}
              style={{ position:'absolute', inset:-4, borderRadius:'50%', border:'2.5px solid #a78bfa', boxShadow:'0 0 16px rgba(167,139,250,0.8)' }} />
          )}
          <Avatar sx={{ width:34, height:34, bgcolor:isCurrentTurn?'#7c3aed':'#12233d', fontSize:'0.8rem', fontWeight:900, border:`2px solid ${isCurrentTurn?'#a78bfa':'rgba(255,255,255,0.1)'}` }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          {isFinished && (
            <Box sx={{ position:'absolute', top:-5, right:-5, width:17, height:17, borderRadius:'50%', bgcolor:'#fbbf24', border:'2px solid #0d1a2e', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Typography sx={{ fontSize:'0.45rem', fontWeight:900, color:'#000' }}>{rank}</Typography>
            </Box>
          )}
          <Box sx={{ position:'absolute', bottom:1, right:1, width:8, height:8, borderRadius:'50%', bgcolor:'#22c55e', border:'1.5px solid #0d1a2e' }} />
        </Box>
        <Typography noWrap sx={{ fontSize:'0.58rem', fontWeight:800, color:isCurrentTurn?'#c4b5fd':'#64748b', maxWidth:64, textAlign:'center' }}>{name}</Typography>
      </Box>
    </Box>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────
function ColorPicker({ open, onPick }) {
  return (
    <Modal open={open} sx={{ display:'flex', alignItems:'center', justifyContent:'center', px:2 }}>
      <motion.div initial={{ scale:0.75, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:'spring', stiffness:340, damping:24 }}>
        <Box sx={{ bgcolor:'#0c1826', borderRadius:'24px', p:3, border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 32px 80px rgba(0,0,0,0.88)', textAlign:'center', minWidth:270 }}>
          <Typography sx={{ fontWeight:900, fontSize:'0.95rem', color:'#f0f6fc', mb:2 }}>Choose a color</Typography>
          <Box sx={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1.4 }}>
            {PLAYABLE_COLORS.map(color => {
              const cm = C[color];
              return (
                <motion.div key={color} whileHover={{ scale:1.07, y:-2 }} whileTap={{ scale:0.92 }}>
                  <Box onClick={() => onPick(color)} sx={{ background:`linear-gradient(155deg,${cm.hex},${cm.dark})`, borderRadius:'16px', py:1.8, display:'flex', alignItems:'center', justifyContent:'center', gap:0.8, cursor:'pointer', boxShadow:`0 6px 22px ${cm.hex}55`, border:'2px solid rgba(255,255,255,0.22)' }}>
                    <Typography sx={{ fontSize:'1.4rem' }}>{cm.emoji}</Typography>
                    <Typography sx={{ fontWeight:900, color:'white', fontSize:'0.88rem' }}>{cm.name}</Typography>
                  </Box>
                </motion.div>
              );
            })}
          </Box>
        </Box>
      </motion.div>
    </Modal>
  );
}

// ─── Pending draw warning ─────────────────────────────────────────────────────
function PendingAlert({ pendingDraw, pendingDrawType, isMyTurn }) {
  if (!pendingDraw || !isMyTurn) return null;
  const color = pendingDrawType === 'wild4' ? '#a855f7' : '#ef4444';
  return (
    <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} style={{ display:'flex', justifyContent:'center', marginBottom:4 }}>
      <Box sx={{ px:2.5, py:0.65, borderRadius:'20px', bgcolor:`${color}22`, border:`1.5px solid ${color}80`, display:'flex', alignItems:'center', gap:1, boxShadow:`0 4px 18px ${color}44` }}>
        <motion.span animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:0.65 }} style={{ fontSize:'1rem' }}>⚠️</motion.span>
        <Typography sx={{ fontSize:'0.78rem', fontWeight:900, color }}>
          Draw {pendingDraw} or stack {pendingDrawType === 'wild4' ? '+4' : '+2'}!
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── Game over overlay ────────────────────────────────────────────────────────
function GameOverScreen({ rankings, players, onRematch, isHost, onExit }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ position:'absolute', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Box sx={{ position:'absolute', inset:0, bgcolor:'rgba(4,8,16,0.93)', backdropFilter:'blur(14px)' }} />
      <motion.div initial={{ scale:0.72, y:28, opacity:0 }} animate={{ scale:1, y:0, opacity:1 }} transition={{ type:'spring', stiffness:250, damping:22, delay:0.1 }} style={{ position:'relative', zIndex:1 }}>
        <Box sx={{ bgcolor:'#0c1a2e', borderRadius:'28px', p:4, border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 40px 100px rgba(0,0,0,0.9)', textAlign:'center', minWidth:280 }}>
          <Typography sx={{ fontSize:'2.8rem', mb:0.5 }}>🃏</Typography>
          <Typography sx={{ fontWeight:900, fontSize:'1.5rem', color:'#a78bfa', mb:2.5 }}>Game Over!</Typography>
          <Box sx={{ display:'flex', flexDirection:'column', gap:1, mb:3 }}>
            {rankings.map((uid, i) => (
              <motion.div key={uid} initial={{ x:-16, opacity:0 }} animate={{ x:0, opacity:1 }} transition={{ delay:0.2+i*0.07 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1.5, p:'10px 16px', borderRadius:'14px', bgcolor:i===0?'rgba(251,191,36,0.1)':'rgba(255,255,255,0.04)', border:i===0?'1px solid rgba(251,191,36,0.3)':'1px solid rgba(255,255,255,0.07)' }}>
                  <Typography sx={{ fontSize:'1.3rem' }}>{['🥇','🥈','🥉'][i]||`#${i+1}`}</Typography>
                  <Typography sx={{ fontWeight:900, fontSize:'0.92rem', color:i===0?'#fbbf24':'#e2e8f0' }}>{players?.[uid]?.name||uid}</Typography>
                </Box>
              </motion.div>
            ))}
          </Box>
          {isHost ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box onClick={onRematch} sx={{ py:1.4, borderRadius:'14px', fontWeight:900, fontSize:'0.95rem', background:'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow:'0 8px 24px rgba(124,58,237,0.45)', display:'flex', alignItems:'center', justifyContent:'center', gap:1, cursor:'pointer', color:'white' }}>
                <ReplayIcon sx={{ fontSize:18 }} /> Play Again
              </Box>
              <Box onClick={onExit} sx={{ py:1.4, borderRadius:'14px', fontWeight:900, fontSize:'0.95rem', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', gap:1, cursor:'pointer', color:'#94a3b8', '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' } }}>
                <ExitToAppIcon sx={{ fontSize:18 }} /> Exit Game
              </Box>
            </Box>
          ) : (
            <Typography sx={{ fontSize:'0.78rem', color:'#475569' }}>Waiting for host to restart…</Typography>
          )}
        </Box>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function UnoGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, userId, isHost } = state;
  const [pendingWild, setPendingWild] = useState(null);
  const [busy, setBusy] = useState(false);

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId: state.roomId, userId, gameType: 'uno', leaveCallback: leave,
  });

  const u = room?.unoState;

  const myHand       = useMemo(() => u?.hands?.[userId] || [], [u, userId]);
  const isMyTurn     = !!u && u.playerOrder[u.currentIndex] === userId;
  const opponents    = useMemo(() => u?.playerOrder?.filter(id => id !== userId) || [], [u, userId]);
  const myRank       = u?.rankings?.indexOf(userId) ?? -1;
  const myFinished   = myRank >= 0;
  const gameOver     = !!u?.winner;
  const pendingDraw  = u?.pendingDraw || 0;
  const pendingDrawType = u?.pendingDrawType || null;

  // Save game history once when game ends
  const unoSavedRef = useRef(false);
  useEffect(() => {
    if (!gameOver || !userId || !room || unoSavedRef.current) return;
    unoSavedRef.current = true;
    const rankings = u?.rankings || [];
    const allPlayers = u?.playerOrder || [];
    const myFinalRank = myRank >= 0 ? myRank + 1 : allPlayers.length;
    const winnerPlayer = room.players?.[u?.winner];
    // rankings holds finish order; players not yet in rankings finished last
    const unfinished = allPlayers.filter(uid => !rankings.includes(uid));
    const orderedUids = [...rankings, ...unfinished];
    saveGameHistory(userId, {
      gameType: 'uno',
      roomId: room.id,
      myRank: myFinalRank,
      totalPlayers: allPlayers.length,
      winnerName: winnerPlayer?.name || '',
      rankedPlayers: orderedUids.map((uid, i) => ({
        name: room.players?.[uid]?.name || uid,
        score: null,
        rank: i + 1,
        isMe: uid === userId,
      })),
    });
  }, [gameOver]); // eslint-disable-line

  const playableIds  = useMemo(() => {
    if (!u || !isMyTurn || myFinished || gameOver) return new Set();
    return new Set(myHand.filter(c => canPlayCard(c, u.topCard, u.activeColor, pendingDraw, pendingDrawType)).map(c => c.id));
  }, [u, isMyTurn, myFinished, gameOver, myHand, pendingDraw, pendingDrawType]);

  const canDrawCard = isMyTurn && !myFinished && !gameOver;

  const turnMsg = useMemo(() => {
    if (!u) return '';
    if (myFinished) return `You finished #${myRank + 1}! 🎉`;
    if (gameOver)   return 'Game over!';
    if (isMyTurn) {
      if (pendingDraw > 0) return `Draw ${pendingDraw} or stack!`;
      if (playableIds.size === 0) return 'No plays — draw!';
      return 'Your turn!';
    }
    const cur = room?.players?.[u.playerOrder?.[u.currentIndex]];
    return `${cur?.name || '…'}'s turn`;
  }, [u, myFinished, myRank, gameOver, isMyTurn, pendingDraw, playableIds.size, room]);

  const handlePlay = useCallback(async (card) => {
    if (busy) return;
    if (!canPlayCard(card, u.topCard, u.activeColor, pendingDraw, pendingDrawType)) return;
    if (card.type === 'wild' || card.type === 'wild4') { setPendingWild(card); return; }
    setBusy(true);
    await playUnoCard(room.id, userId, card.id);
    setBusy(false);
  }, [busy, u, room?.id, userId, pendingDraw, pendingDrawType]);

  const handleColorPick = useCallback(async (color) => {
    if (!pendingWild || busy) return;
    const card = pendingWild; setPendingWild(null);
    setBusy(true);
    await playUnoCard(room.id, userId, card.id, color);
    setBusy(false);
  }, [pendingWild, busy, room?.id, userId]);

  const handleDraw = useCallback(async () => {
    if (!canDrawCard || busy) return;
    setBusy(true);
    await drawUnoCard(room.id, userId);
    setBusy(false);
  }, [canDrawCard, busy, room?.id, userId]);

  const handleRematch = useCallback(async () => { if (room) await resetUnoGame(room.id); }, [room]);

  const handleExit = useCallback(async () => {
    const playerName = state.me?.name || state.playerName;
    await leave(state.roomId, state.userId, playerName);
  }, [state, leave]);

  if (!room || !u) return null;

  const posSlots = ['top','right','left','topRight','topLeft'];
  const activeColorMeta = u.activeColor ? C[u.activeColor] : null;
  const cardGap = 4;

  return (
    <UnoErrorBoundary>
      <Box sx={{ height:'100dvh', background:'linear-gradient(160deg,#0d2137 0%,#071424 100%)', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative', userSelect:'none' }}>
        <OfflineBanner online={online} />

        {/* Header */}
        <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', px:1.8, pt:!online?4.5:1.2, pb:0.8, flexShrink:0, transition:'padding 0.3s' }}>
          <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <Box sx={{ px:1.3, py:0.35, borderRadius:'9px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow:'0 3px 12px rgba(220,38,38,0.5)' }}>
              <Typography sx={{ fontWeight:900, fontSize:'1rem', color:'white', letterSpacing:'1.5px' }}>UNO</Typography>
            </Box>
            {activeColorMeta && (
              <motion.div animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:1.6 }}>
                <Box sx={{ width:13, height:13, borderRadius:'50%', bgcolor:activeColorMeta.hex, boxShadow:`0 0 10px ${activeColorMeta.hex}cc`, border:'2px solid rgba(255,255,255,0.3)' }} />
              </motion.div>
            )}
            <Typography sx={{ fontSize:'0.62rem', color:'#334155', fontWeight:700 }}>{u.direction===1?'↻ CW':'↺ CCW'}</Typography>
          </Box>
          <Box sx={{ display:'flex', gap:0.8 }}>
            {isHost && (
              <Box onClick={handleRematch} sx={{ p:0.6, borderRadius:'9px', cursor:'pointer', color:'#64748b', bgcolor:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex' }}>
                <ReplayIcon sx={{ fontSize:15 }} />
              </Box>
            )}
            <Box onClick={requestLeave} sx={{ p:0.6, borderRadius:'9px', cursor:'pointer', color:'#ef4444', bgcolor:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.22)', display:'flex' }}>
              <ExitToAppIcon sx={{ fontSize:15 }} />
            </Box>
          </Box>
        </Box>

        {/* Table */}
        <Box sx={{ flex:1, position:'relative', overflow:'hidden' }}>
          {/* Felt circle */}
          <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-54%)', width:'min(84vw,340px)', aspectRatio:'1', borderRadius:'50%', background:'radial-gradient(ellipse at 35% 30%,#1a5c3a 0%,#0f3d25 55%,#082a18 100%)', border:'3px solid rgba(255,255,255,0.06)', boxShadow:'0 10px 56px rgba(0,0,0,0.8),inset 0 2px 0 rgba(255,255,255,0.05)', zIndex:0 }} />

          {/* Opponents */}
          {opponents.map((uid, i) => {
            const pos = posSlots[i] || 'top';
            const isFinished = (u.rankings?.indexOf(uid) ?? -1) >= 0;
            const rank = isFinished ? u.rankings.indexOf(uid) + 1 : null;
            const posStyles = {
              top:      { position:'absolute', top:4,   left:'50%',  transform:'translateX(-50%)' },
              right:    { position:'absolute', right:6,  top:'50%',   transform:'translateY(-60%)' },
              left:     { position:'absolute', left:6,   top:'50%',   transform:'translateY(-60%)' },
              topRight: { position:'absolute', top:4,    right:'14%' },
              topLeft:  { position:'absolute', top:4,    left:'14%'  },
            }[pos];
            return (
              <Box key={uid} sx={{ zIndex:10, ...posStyles }}>
                <OpponentSlot uid={uid} cardCount={u.hands?.[uid]?.length||0} position={pos}
                  isCurrentTurn={u.playerOrder[u.currentIndex]===uid}
                  player={room.players?.[uid]} rank={rank} isFinished={isFinished} />
              </Box>
            );
          })}

          {/* Center piles */}
          <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-54%)', display:'flex', alignItems:'center', justifyContent:'center', gap:'22px', zIndex:5 }}>
            {/* Draw pile */}
            <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0.7 }}>
              <Box sx={{ position:'relative' }}>
                <Box sx={{ position:'absolute', top:4, left:4, width:54, height:80, borderRadius:'9px', bgcolor:'#120840', opacity:0.55 }} />
                <Box sx={{ position:'absolute', top:2, left:2, width:54, height:80, borderRadius:'9px', bgcolor:'#1a0d52', opacity:0.7 }} />
                <CardBack size="md" onClick={handleDraw} disabled={!canDrawCard||busy} />
                <Box sx={{ position:'absolute', top:-8, right:-8, width:22, height:22, borderRadius:'50%', bgcolor:'#6d28d9', border:'2px solid #0d1a2e', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
                  <Typography sx={{ fontSize:'0.52rem', fontWeight:900, color:'#fff' }}>{u.deck?.length||0}</Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize:'0.56rem', color:'rgba(255,255,255,0.28)', fontWeight:800, letterSpacing:'1px' }}>DRAW</Typography>
            </Box>
            {/* Discard pile */}
            <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0.7 }}>
              <AnimatePresence mode="popLayout">
                <motion.div key={u.topCard?.id} initial={{ scale:0.45, rotate:-20, opacity:0, y:-40 }} animate={{ scale:1, rotate:0, opacity:1, y:0 }} exit={{ scale:0.75, opacity:0, y:28 }} transition={{ type:'spring', stiffness:310, damping:22 }}>
                  <UnoCard card={u.topCard} playable={false} size="md" highlighted />
                </motion.div>
              </AnimatePresence>
              <Typography sx={{ fontSize:'0.56rem', color:'rgba(255,255,255,0.28)', fontWeight:800, letterSpacing:'1px' }}>DISCARD</Typography>
            </Box>
          </Box>

          {/* Turn pill */}
          <Box sx={{ position:'absolute', bottom:6, left:0, right:0, display:'flex', justifyContent:'center', zIndex:5 }}>
            <AnimatePresence mode="wait">
              <motion.div key={turnMsg} initial={{ opacity:0, y:8, scale:0.94 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-6, scale:0.94 }} transition={{ duration:0.18 }}>
                <Box sx={{ px:2.5, py:0.65, borderRadius:'20px', bgcolor:isMyTurn&&!myFinished?'rgba(124,58,237,0.88)':'rgba(10,20,36,0.85)', border:`1px solid ${isMyTurn&&!myFinished?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.07)'}`, boxShadow:isMyTurn&&!myFinished?'0 6px 22px rgba(124,58,237,0.45)':'0 2px 10px rgba(0,0,0,0.5)', backdropFilter:'blur(10px)' }}>
                  <Typography sx={{ fontSize:'0.75rem', fontWeight:900, color:isMyTurn&&!myFinished?'#fff':'#64748b' }}>{turnMsg}</Typography>
                </Box>
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>

        {/* My area */}
        <Box sx={{ flexShrink:0, background:'linear-gradient(0deg,#04080f 0%,transparent 100%)', pb:'env(safe-area-inset-bottom,12px)', pt:0.5 }}>
          <PendingAlert pendingDraw={pendingDraw} pendingDrawType={pendingDrawType} isMyTurn={isMyTurn} />
          {/* Info bar */}
          <Box sx={{ px:2, mb:0.5, display:'flex', alignItems:'center', gap:0.8 }}>
            <Avatar sx={{ width:22, height:22, bgcolor:'#7c3aed', fontSize:'0.58rem', fontWeight:900 }}>
              {state.playerName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Typography sx={{ fontSize:'0.67rem', color:'#334155', fontWeight:800 }}>{state.playerName}</Typography>
            <Box sx={{ flex:1 }} />
            <Typography sx={{ fontSize:'0.6rem', color:'#1e3a5f', fontWeight:700 }}>{myHand.length} card{myHand.length!==1?'s':''}</Typography>
            {myHand.length===1&&!myFinished&&(
              <motion.div animate={{ scale:[1,1.14,1] }} transition={{ repeat:Infinity, duration:0.75 }}>
                <Box sx={{ px:0.8, py:0.15, borderRadius:'8px', bgcolor:'rgba(239,68,68,0.22)', border:'1px solid rgba(239,68,68,0.45)' }}>
                  <Typography sx={{ fontSize:'0.6rem', fontWeight:900, color:'#f87171' }}>UNO!</Typography>
                </Box>
              </motion.div>
            )}
          </Box>
          {/* Hand */}
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:`${cardGap}px`, px:1.8, pb:1.5, overflow:'hidden', alignItems:'center', justifyContent:'center', minHeight:96 }}>
            {myHand.map((card, i) => {
              const isPlayable = playableIds.has(card.id) && !busy && isMyTurn;
              return (
                <motion.div key={card.id} initial={{ y:50, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:i*0.025, type:'spring', stiffness:300, damping:24 }} style={{ flexShrink:0 }}>
                  <UnoCard card={card} size="md" playable={isPlayable} onClick={() => handlePlay(card)} />
                </motion.div>
              );
            })}
            {myHand.length===0&&!myFinished&&<Box sx={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Typography sx={{ color:'#1e3a5f', fontSize:'0.82rem', fontStyle:'italic' }}>No cards</Typography></Box>}
            {myFinished&&<Box sx={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Typography sx={{ color:'#a78bfa', fontSize:'0.9rem', fontWeight:900 }}>🎉 Finished #{myRank+1}!</Typography></Box>}
          </Box>
        </Box>

        <ColorPicker open={!!pendingWild} onPick={handleColorPick} />
        <AnimatePresence>{gameOver&&<GameOverScreen rankings={u.rankings||[]} players={room.players} onRematch={handleRematch} isHost={isHost} onExit={handleExit} />}</AnimatePresence>
        <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
      </Box>
    </UnoErrorBoundary>
  );
}