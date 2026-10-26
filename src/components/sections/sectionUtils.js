// Shared presentation helpers for home sections.
export const GAME_GRADIENTS = {
  drawing: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
  ludo: 'linear-gradient(135deg, #FFD166 0%, #EF476F 100%)',
  snakeladder: 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)',
  uno: 'linear-gradient(135deg, #DC2626 0%, #7c3aed 100%)',
  boggle: 'linear-gradient(135deg, #06D6A0 0%, #3A86FF 100%)',
};
export const GAME_GLOW = { drawing: '#4CC9F0', ludo: '#FFD166', snakeladder: '#06D6A0', uno: '#a855f7', boggle: '#06D6A0' };
export const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function timeAgo(ts) {
  if (!ts) return '';
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now());
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function nameColor(name) {
  const hue = [...(name || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// ─── Background ───────────────────────────────────────────────────────────────
