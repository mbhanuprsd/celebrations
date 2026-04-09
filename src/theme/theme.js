// src/theme/theme.js
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#4CC9F0', light: '#7ED8F7', dark: '#0096C7' },
    secondary:  { main: '#F72585', light: '#FA6EAB', dark: '#C0006A' },
    success:    { main: '#06D6A0' },
    warning:    { main: '#FFD166' },
    error:      { main: '#EF233C' },
    background: { default: '#0d1117', paper: '#161b22' },
    text:       { primary: '#e6edf3', secondary: '#8b949e' },
    divider:    'rgba(255,255,255,0.08)',
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
    MuiCssBaseline: {
      styleOverrides: {
        body: { background: '#0d1117', scrollbarWidth: 'thin', scrollbarColor: '#30363d #0d1117' },
        '::-webkit-scrollbar': { width: '6px' },
        '::-webkit-scrollbar-track': { background: '#0d1117' },
        '::-webkit-scrollbar-thumb': { background: '#30363d', borderRadius: '4px' },
      },
    },
    MuiAppBar:    { styleOverrides: { root: { background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none' } } },
    MuiPaper:     { styleOverrides: { root: { backgroundImage: 'none', background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' } } },
    MuiCard:      { styleOverrides: { root: { background: '#161b22', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, padding: '10px 24px', fontSize: '1rem', boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 20px rgba(76,201,240,0.3)', transform: 'translateY(-1px)' },
          transition: 'all 0.2s ease' },
        containedPrimary:   { background: 'linear-gradient(135deg, #4CC9F0 0%, #0096C7 100%)', color: '#0d1117' },
        containedSecondary: { background: 'linear-gradient(135deg, #F72585 0%, #FA6EAB 100%)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': { borderRadius: 12, background: '#0d1117',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(76,201,240,0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#4CC9F0' },
          },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 700 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.08)' } } },
  },
});
