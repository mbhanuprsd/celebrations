import React, { useState } from 'react';
import { Avatar, Box, Divider, Drawer, IconButton, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import MenuIcon from '@mui/icons-material/Menu';
import CelebrationIcon from '@mui/icons-material/Celebration';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import ForumIcon from '@mui/icons-material/Forum';
import BadgeIcon from '@mui/icons-material/Badge';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useGameContext } from '../context/GameContext';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import { ArenaSection } from './sections/ArenaSection';
import { ChatSection } from './sections/ChatSection';
import { HelpSection } from './sections/HelpSection';
import { ProfileSection } from './sections/ProfileSection';
import { SoloGameOverlay, SoloSection } from './sections/SoloSection';

const NAV_ITEMS = [
  { id: 'games',        label: 'Multiplayer Games', icon: CelebrationIcon,    color: '#4CC9F0' },
  { id: 'singleplayer', label: 'Solo Games',        icon: VideogameAssetIcon, color: '#FF9F1C' },
  { id: 'chat',         label: 'Global Chat',     icon: ForumIcon,           color: '#F72585' },
  { id: 'profile',      label: 'Profile',        icon: BadgeIcon,           color: '#FFD166' },
  { id: 'help',         label: 'About',          icon: AutoFixHighIcon,     color: '#06D6A0' },
];

function BgOrbs() {
  const orbs = [
    { color: '#4CC9F0', size: 240, top: '2%',  left: '-10%', delay: 0 },
    { color: '#F72585', size: 190, top: '55%',  right: '-8%', delay: 1.5 },
    { color: '#7209B7', size: 160, bottom: '3%', left: '8%',  delay: 0.8 },
    { color: '#FFD166', size: 120, top: '28%',  right: '3%',  delay: 2.2 },
  ];
  return (
    <>
      {orbs.map((o, i) => (
        <motion.div key={i} style={{
          position: 'fixed', width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color}20, transparent 70%)`,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          pointerEvents: 'none', zIndex: 0,
        }}
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 5 + i, repeat: Infinity, delay: o.delay }} />
      ))}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(76,201,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,1) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />
    </>
  );
}

// ─── Side Navigation Drawer ───────────────────────────────────────────────────

function SideNav({ open, onClose, activeSection, onSectionChange, playerName, isAnonymous, onLogout }) {
  // Items that need Google sign-in
  const GATED_IDS = ['chat', 'profile'];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 245,
          bgcolor: 'rgba(8,12,18,0.98)',
          backdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      ModalProps={{ keepMounted: true }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: '1.5rem',
            background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1,
          }}>
            Celebrations
          </Typography>
          <IconButton size="small" onClick={onClose}
            sx={{ color: '#484f58', '&:hover': { color: '#e6edf3', bgcolor: 'rgba(255,255,255,0.06)' }, borderRadius: '8px' }}>
            <CloseIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>

        {/* Player card */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          p: '10px 12px', borderRadius: '14px',
          bgcolor: 'rgba(76,201,240,0.07)', border: '1px solid rgba(76,201,240,0.15)',
        }}>
          <Avatar sx={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #4CC9F0, #7209B7)',
            fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
          }}>
            {playerName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box minWidth={0}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: '#4CC9F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playerName}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#484f58', fontWeight: 600 }}>Online</Typography>
              {isAnonymous && (
                <Typography sx={{ fontSize: '0.55rem', color: '#FFD166', fontWeight: 800,
                  bgcolor: 'rgba(255,209,102,0.1)', px: 0.7, py: 0.15, borderRadius: '5px',
                  border: '1px solid rgba(255,209,102,0.25)', ml: 0.3 }}>
                  Guest
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Nav items */}
      <Box sx={{ flex: 1, px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          const Icon = item.icon;
          const locked = isAnonymous && GATED_IDS.includes(item.id);
          return (
            <motion.div key={item.id} whileTap={{ scale: 0.97 }}>
              <Box
                onClick={() => { onSectionChange(item.id); onClose(); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.8, py: 1.3, borderRadius: '14px', cursor: 'pointer',
                  background: active ? `${item.color}14` : 'transparent',
                  border: `1px solid ${active ? item.color + '30' : 'transparent'}`,
                  opacity: locked ? 0.6 : 1,
                  transition: 'all 0.18s',
                  '&:hover': {
                    background: active ? `${item.color}18` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? item.color + '40' : 'rgba(255,255,255,0.1)'}`,
                  },
                }}
              >
                <Icon sx={{ fontSize: 20, color: active ? item.color : '#484f58', transition: 'color 0.18s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: active ? item.color : '#8b949e', flex: 1, transition: 'color 0.18s' }}>
                  {item.label}
                </Typography>
                {locked && (
                  <Typography sx={{ fontSize: '0.6rem', color: '#484f58', fontWeight: 700,
                    bgcolor: 'rgba(255,255,255,0.06)', px: 0.8, py: 0.2, borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.08)' }}>
                    🔒 Google
                  </Typography>
                )}
                {!locked && active && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                )}
              </Box>
            </motion.div>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Sign out / upgrade */}
      <Box sx={{ px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {isAnonymous && (
          <Box
            onClick={() => { onLogout(); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 1.8, py: 1.2, borderRadius: '14px', cursor: 'pointer',
              background: 'rgba(76,201,240,0.07)', border: '1px solid rgba(76,201,240,0.2)',
              transition: 'all 0.18s',
              '&:hover': { background: 'rgba(76,201,240,0.12)', border: '1px solid rgba(76,201,240,0.35)' },
            }}
          >
            <Typography sx={{ fontSize: '0.95rem' }}>🔑</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: '#4CC9F0', flex: 1 }}>
              Sign in with Google
            </Typography>
          </Box>
        )}
        <Box
          onClick={onLogout}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.8, py: 1.2, borderRadius: '14px', cursor: 'pointer',
            border: '1px solid transparent', transition: 'all 0.18s',
            '&:hover': { background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.2)' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 18, color: '#484f58' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#484f58' }}>
            {isAnonymous ? 'Exit Guest Session' : 'Sign Out'}
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export function HomeScreen() {
  const { state, logout, updateUsername } = useGameContext();
  const { playerName, userId } = state;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('games');
  const [localError, setLocalError] = useState('');
  const [singlePlayerGame, setSinglePlayerGame] = useState(null);

  const SECTION_LABEL = { games: '🎮 Multiplayer Games', singleplayer: '🎯 Solo Games', chat: '🗣️ Global Chat', profile: '🪪 Profile', help: '📘 About' };
  const activeMeta = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: '#080c12', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', position: 'relative', overflowX: 'hidden', overflowY: 'visible',
      pt: 'env(safe-area-inset-top)', pb: 'max(40px, env(safe-area-inset-bottom))',
    }}>
      <BgOrbs />

      <SideNav
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        playerName={playerName}
        isAnonymous={state.isAnonymous}
        onLogout={logout}
      />

      <Box sx={{ width: '100%', maxWidth: 460, zIndex: 1, position: 'relative', px: { xs: 1.5, sm: 2 }, pt: { xs: 2, sm: 3 } }}>

        {/* Top bar */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Box display="flex" alignItems="center" gap={1.2}>
            {/* Menu toggle */}
            <motion.div whileTap={{ scale: 0.9 }}>
              <IconButton
                onClick={() => setDrawerOpen(true)}
                size="small"
                sx={{
                  color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${drawerOpen ? (activeMeta?.color || '#4CC9F0') + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '12px', p: 0.8, transition: 'all 0.2s',
                  '&:hover': { color: activeMeta?.color || '#4CC9F0', borderColor: `${activeMeta?.color || '#4CC9F0'}40` },
                }}
              >
                <MenuIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </motion.div>

            {/* Current section label */}
            <motion.div key={activeSection} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#e6edf3' }}>
                {SECTION_LABEL[activeSection]}
              </Typography>
            </motion.div>
          </Box>

          {/* App name */}
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: '1.1rem',
            background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Celebrations
          </Typography>
        </Box>

        {/* Sections */}
        <AnimatePresence mode="wait">
          {activeSection === 'games' && (
            <motion.div key="games" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <ArenaSection playerName={playerName} onLocalError={setLocalError} localError={localError} />
            </motion.div>
          )}
          {activeSection === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <ChatSection state={state} playerName={playerName} />
            </motion.div>
          )}
          {activeSection === 'singleplayer' && (
            <motion.div key="singleplayer" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <SoloSection onLaunch={setSinglePlayerGame} userId={userId} />
            </motion.div>
          )}
          {activeSection === 'help' && (
            <motion.div key="help" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <HelpSection />
            </motion.div>
          )}
          {activeSection === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <ProfileSection state={state} updateUsername={updateUsername} logout={logout} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      <SoloGameOverlay
        gameId={singlePlayerGame}
        onExit={() => setSinglePlayerGame(null)}
        userId={userId}
        playerName={playerName}
      />
    </Box>
  );
}
