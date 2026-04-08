// src/theme/theme.js
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4361EE', light: '#738EF5', dark: '#2D45B5' },
    secondary: { main: '#F72585', light: '#FA6EAB', dark: '#C0006A' },
    success: { main: '#06D6A0' },
    warning: { main: '#FFD166' },
    error: { main: '#EF233C' },
    background: { default: '#F0F4FF', paper: '#FFFFFF' },
    text: { primary: '#1a1a2e', secondary: '#5a5f7d' },
  },
  typography: {
    fontFamily: '"Nunito", "Fredoka One", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-1px' },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0.3px' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
          fontSize: '1rem',
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 20px rgba(67,97,238,0.3)', transform: 'translateY(-1px)' },
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4361EE 0%, #738EF5 100%)',
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #F72585 0%, #FA6EAB 100%)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(67,97,238,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 700 },
      },
    },
  },
});
