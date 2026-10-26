import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, IconButton, Paper, Tooltip, Typography, useMediaQuery } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { Room, RoomEvent } from 'livekit-client';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const createVoiceRoomToken = httpsCallable(functions, 'createVoiceRoomToken');

export function GameVoiceChat({ roomId }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const mountedRef = useRef(false);
  const roomRef = useRef(null);
  const audioElementsRef = useRef(new Map());
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState('');
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const showMobileDetails = !isMobile || mobileDetailsOpen;

  const detachAudio = useCallback(track => {
    const audio = audioElementsRef.current.get(track.sid);
    if (!audio) return;
    track.detach(audio);
    audio.remove();
    audioElementsRef.current.delete(track.sid);
    if (audioElementsRef.current.size === 0 && mountedRef.current) setAudioBlocked(false);
  }, []);

  const clearAudioElements = useCallback(() => {
    audioElementsRef.current.forEach(audio => {
      audio.pause();
      audio.remove();
    });
    audioElementsRef.current.clear();
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    try {
      if (room) await room.disconnect();
    } catch (disconnectError) {
      setError(disconnectError.message || 'Could not leave voice chat cleanly.');
    } finally {
      clearAudioElements();
      setConnected(false);
      setMuted(false);
      setParticipantCount(1);
      setAudioBlocked(false);
    }
  }, [clearAudioElements]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.disconnect().catch(disconnectError => {
          console.error('Failed to disconnect from LiveKit during cleanup:', disconnectError);
        });
      }
      clearAudioElements();
    };
  }, [clearAudioElements]);

  const joinVoice = useCallback(async () => {
    setConnecting(true);
    setError('');
    let room;
    try {
      const response = await createVoiceRoomToken({ roomId });
      if (!mountedRef.current) return;
      room = new Room({ adaptiveStream: false, dynacast: false });
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (!mountedRef.current || track.kind !== 'audio') return;
        const audio = track.attach();
        audio.autoplay = true;
        audio.playsInline = true;
        audio.dataset.participant = participant.identity;
        document.body.appendChild(audio);
        audioElementsRef.current.set(track.sid, audio);
        audio.play().then(() => {
          if (mountedRef.current) setAudioBlocked(false);
        }).catch(() => {
          if (mountedRef.current) setAudioBlocked(true);
        });
      });
      room.on(RoomEvent.TrackUnsubscribed, track => detachAudio(track));
      room.on(RoomEvent.ParticipantConnected, () => {
        if (mountedRef.current) setParticipantCount(room.remoteParticipants.size + 1);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        if (mountedRef.current) setParticipantCount(room.remoteParticipants.size + 1);
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
          clearAudioElements();
          if (mountedRef.current) {
            setConnected(false);
            setMuted(false);
            setParticipantCount(1);
            setAudioBlocked(false);
            setError('Voice connection was interrupted. Join again to reconnect.');
          }
        }
      });
      roomRef.current = room;
      await room.connect(response.data.url, response.data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (!mountedRef.current) {
        roomRef.current = null;
        return;
      }
      setMuted(false);
      setParticipantCount(room.remoteParticipants.size + 1);
      setConnected(true);
    } catch (joinError) {
      if (room) {
        try {
          await room.disconnect();
        } catch (disconnectError) {
          console.error('Failed to clean up a failed LiveKit connection:', disconnectError);
        }
      }
      if (roomRef.current === room) roomRef.current = null;
      if (mountedRef.current) {
        setConnected(false);
        setError(joinError.message || 'Could not join voice chat.');
      }
    } finally {
      if (mountedRef.current) setConnecting(false);
    }
  }, [clearAudioElements, detachAudio, roomId]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const enableMicrophone = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(enableMicrophone);
      setMuted(!enableMicrophone);
    } catch (muteError) {
      setError(muteError.message || 'Could not change microphone state.');
    }
  }, []);

  const enableAudio = useCallback(async () => {
    try {
      await Promise.all([...audioElementsRef.current.values()].map(audio => audio.play()));
      setAudioBlocked(false);
      setError('');
    } catch (audioError) {
      setError(audioError.message || 'Could not enable remote audio playback.');
    }
  }, []);

  return (
    <Paper
      elevation={12}
      sx={{
        position: 'fixed',
        right: { xs: 'max(8px, env(safe-area-inset-right))', sm: 20 },
        bottom: { xs: 'max(8px, env(safe-area-inset-bottom))', sm: 20 },
        zIndex: 1500,
        width: 'min(320px, calc(100vw - 24px))',
        p: { xs: 1, sm: 1.5 },
        bgcolor: '#101827',
        color: '#f0f6fc',
        border: '1px solid rgba(76, 201, 240, 0.32)',
        borderRadius: 3,
      }}
      aria-label="Game voice chat"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Game voice</Typography>
          <Typography sx={{ display: { xs: showMobileDetails ? 'block' : 'none', sm: 'block' }, color: connected ? '#86efac' : '#94a3b8', fontSize: '0.72rem' }}>
            {connecting ? 'Connecting…' : connected ? `${participantCount} in voice` : 'Voice is off'}
          </Typography>
        </Box>
        {isMobile && (
          <Tooltip title={mobileDetailsOpen ? 'Hide voice status' : 'Show voice status'}>
            <IconButton
              size="small"
              onClick={() => setMobileDetailsOpen(open => !open)}
              aria-label={mobileDetailsOpen ? 'Hide voice status' : 'Show voice status'}
              sx={{ color: '#94a3b8', p: 0.4 }}
            >
              {mobileDetailsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {connected ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {audioBlocked && (
              <Tooltip title="Enable incoming voice audio">
                <IconButton onClick={enableAudio} aria-label="Enable incoming voice audio" sx={{ color: '#fbbf24' }}>
                  <VolumeUpIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={muted ? 'Unmute microphone' : 'Mute microphone'}>
              <IconButton onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                sx={{ color: muted ? '#fca5a5' : '#86efac' }}>
                {muted ? <MicOffIcon /> : <MicIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Leave voice chat">
              <IconButton onClick={disconnect} aria-label="Leave voice chat" sx={{ color: '#fca5a5' }}>
                <CallEndIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={joinVoice}
            disabled={connecting}
            startIcon={<MicIcon />}
            sx={{ bgcolor: '#087ea4', fontWeight: 800, borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            {connecting ? 'Joining' : 'Join voice'}
          </Button>
        )}
      </Box>
      {error && showMobileDetails && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mt: 1, fontSize: '0.75rem' }}>
          {error}
        </Alert>
      )}
      {audioBlocked && !error && showMobileDetails && (
        <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem' }}>
          Browser blocked incoming audio. Select the speaker button to enable it.
        </Alert>
      )}
    </Paper>
  );
}
