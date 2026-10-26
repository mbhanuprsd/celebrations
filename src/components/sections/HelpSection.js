import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { GAME_META } from '../../core/GameEngine';
import { SINGLE_PLAYER_GAMES } from './SoloSection';

export function HelpSection() {
  return (
              <Box sx={{ p: { xs: 1, sm: 2 }, color: 'white' }}>
                <Typography variant="h5" sx={{ mb: 1, fontWeight: 900, color: '#06D6A0' }}>
                  📘 About Celebrations
                </Typography>
                <Typography sx={{ color: '#9aa4af', fontSize: '0.88rem', lineHeight: 1.6, mb: 2.5 }}>
                  Play multiplayer party games with friends in a room, or jump into a solo game. Expand a game below to see how to play.
                </Typography>
                <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', mb: 0.8 }}>
                  GETTING STARTED
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
                  <Accordion disableGutters elevation={0} sx={{
                    bgcolor: 'rgba(255,255,255,0.045)', color: '#e6edf3',
                    borderLeft: '3px solid #4CC9F0', borderRadius: '10px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#8b949e' }} />}>
                      <Typography sx={{ fontWeight: 800, color: '#4CC9F0' }}>
                        🎮 Start or join a multiplayer game
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, color: '#aaa', fontSize: '0.86rem', lineHeight: 1.7 }}>
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        <li>To host, choose <b>Create</b>, pick a game, adjust its settings, and create the room.</li>
                        <li>Share the room code shown in the lobby with your friends. They choose <b>Join</b>, enter the code, and join your room.</li>
                        <li>When enough players have joined, the host presses <b>Start Game</b>. Other players wait in the lobby until the host starts.</li>
                      </ol>
                    </AccordionDetails>
                  </Accordion>
                  <Accordion disableGutters elevation={0} sx={{
                    bgcolor: 'rgba(255,255,255,0.045)', color: '#e6edf3',
                    borderLeft: '3px solid #06D6A0', borderRadius: '10px !important',
                    '&:before': { display: 'none' },
                  }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#8b949e' }} />}>
                      <Typography sx={{ fontWeight: 800, color: '#06D6A0' }}>
                        🎙️ Use game voice chat
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, color: '#aaa', fontSize: '0.86rem', lineHeight: 1.7 }}>
                      Voice chat is optional and available during an active multiplayer game. Choose <b>Join voice</b> in the voice panel and allow microphone access when your browser asks. Use the microphone button to mute or unmute, and the hang-up button to leave voice chat; leaving voice does not leave the game. If other players’ audio is blocked by your browser, use the speaker button to enable it. Voice chat requires the app’s LiveKit voice service to be configured.
                    </AccordionDetails>
                  </Accordion>
                </Box>
                <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', mb: 0.8 }}>
                  MULTIPLAYER GAMES
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {Object.entries(GAME_META).map(([id, meta]) => (
                    <Accordion key={id} disableGutters elevation={0} sx={{
                      bgcolor: 'rgba(255,255,255,0.045)', color: '#e6edf3',
                      borderLeft: `3px solid ${meta.color || '#4CC9F0'}`,
                      borderRadius: '10px !important',
                      '&:before': { display: 'none' },
                    }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#8b949e' }} />}>
                        <Typography sx={{ fontWeight: 800, color: meta.color || '#4CC9F0' }}>
                          {meta.icon} {meta.label}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, color: '#aaa', fontSize: '0.86rem', lineHeight: 1.65 }}>
                        {meta.howToPlay || meta.description}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
                <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', mt: 2.5, mb: 0.8 }}>
                  SOLO GAMES
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {SINGLE_PLAYER_GAMES.map(game => (
                    <Accordion key={game.id} disableGutters elevation={0} sx={{
                      bgcolor: 'rgba(255,255,255,0.045)', color: '#e6edf3',
                      borderLeft: `3px solid ${game.color}`,
                      borderRadius: '10px !important',
                      '&:before': { display: 'none' },
                    }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#8b949e' }} />}>
                        <Typography sx={{ fontWeight: 800, color: game.color }}>
                          {game.icon} {game.label}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, color: '#aaa', fontSize: '0.86rem', lineHeight: 1.65 }}>
                        {game.howToPlay}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
                <Box sx={{
                  mt: 3, p: 1.5, textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 2,
                }}>
                  <Typography sx={{ color: '#9aa4af', fontSize: '0.78rem' }}>
                    Created by <Box component="span" sx={{ color: '#e6edf3', fontWeight: 800 }}>
                      Bhanu Merakanapalli
                    </Box>
                  </Typography>
                  <Typography
                    component="a"
                    href="https://calmindian.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'inline-block', mt: 0.4, color: '#06D6A0',
                      fontSize: '0.78rem', fontWeight: 700,
                      textDecoration: 'none', '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    calmindian.com
                  </Typography>
                </Box>
              </Box>
  );
}
