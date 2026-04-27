import React from 'react';
import { Box, Typography, Button } from '@mui/material';

/**
 * Error Boundary for UNO Game
 * Catches rendering errors and displays fallback UI
 */
export class UnoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UNO Game Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{
          height: '100dvh',
          background: 'linear-gradient(160deg,#0d2137 0%,#071424 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          px: 2,
        }}>
          <Typography sx={{ fontSize: '3rem' }}>⚠️</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', color: '#fff', textAlign: 'center' }}>
            Oops! Game Error
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
            Something went wrong. Try refreshing or leaving and rejoining the game.
          </Typography>
          <Button
            variant="contained"
            onClick={this.handleReset}
            sx={{
              mt: 2,
              background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
              fontWeight: 900,
              textTransform: 'none',
              '&:hover': { background: 'linear-gradient(135deg,#6d28d9,#9333ea)' },
            }}
          >
            Reload Game
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
