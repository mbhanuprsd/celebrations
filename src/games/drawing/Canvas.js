// src/games/drawing/Canvas.js — Drawize-style mobile-first canvas
import React from 'react';
import { Box, IconButton, Tooltip, Slider } from '@mui/material';
import { motion } from 'framer-motion';
import UndoIcon from '@mui/icons-material/Undo';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateIcon from '@mui/icons-material/Create';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useCanvas } from '../../hooks/useCanvas';

// 20-color Ludo King-inspired vibrant palette
const PALETTE = [
  '#000000','#374151','#6B7280','#FFFFFF',
  '#EF4444','#F97316','#EAB308','#22C55E',
  '#06D6A0','#3B82F6','#6366F1','#8B5CF6',
  '#EC4899','#F43F5E','#0EA5E9','#14B8A6',
  '#84CC16','#A855F7','#F59E0B','#8B4513',
];

export function DrawingCanvas({ roomId, canDraw, word }) {
  const {
    canvasRef, tool, setTool, color, setColor,
    brushSize, setBrushSize, onMouseDown, onMouseMove, onMouseUp,
    undo, clear, TOOLS,
  } = useCanvas(roomId, canDraw);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* Canvas — fills all available space */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        aspectRatio: '4/3',
        width: '100%',
        bgcolor: '#FFFFFF',
        borderRadius: { xs: 0, sm: 2 },
        border: canDraw ? '2px solid #4CC9F0' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: canDraw ? '0 0 20px rgba(76,201,240,0.2)' : 'none',
        minHeight: 0,
      }}>
        <canvas
          ref={canvasRef}
          width={800} height={600}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp}
          style={{
            width: '100%', height: '100%', display: 'block',
            cursor: !canDraw ? 'default' : tool === TOOLS.ERASER ? 'cell' : 'crosshair',
            touchAction: 'none',
          }}
        />
        {!canDraw && (
          <Box sx={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <motion.div animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
              <Box sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', px: 1.5, py: 0.3, borderRadius: 2, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                👀 Watch and guess!
              </Box>
            </motion.div>
          </Box>
        )}
      </Box>

      {/* Toolbar — only shown when drawing */}
      {canDraw && (
        <Box sx={{
          display: 'flex', flexDirection: 'column', gap: 0,
          bgcolor: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Tool row */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, gap: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Tool buttons */}
            {[
              [TOOLS.PEN, <CreateIcon sx={{ fontSize: 18 }} />, 'Pen'],
              [TOOLS.ERASER, <AutoFixHighIcon sx={{ fontSize: 18 }} />, 'Eraser'],
            ].map(([t, icon, label]) => (
              <Tooltip title={label} key={t}>
                <IconButton size="small" onClick={() => setTool(t)} sx={{
                  bgcolor: tool === t ? '#4CC9F0' : 'rgba(255,255,255,0.06)',
                  color: tool === t ? '#0d1117' : '#8b949e',
                  borderRadius: 1.5, p: 0.6,
                  '&:hover': { bgcolor: tool === t ? '#7ED8F7' : 'rgba(255,255,255,0.12)' },
                }}>
                  {icon}
                </IconButton>
              </Tooltip>
            ))}

            {/* Size slider */}
            <Box sx={{ flex: 1, px: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: brushSize * 0.7 + 4, height: brushSize * 0.7 + 4, borderRadius: '50%',
                bgcolor: color === '#FFFFFF' ? '#666' : color, flexShrink: 0, transition: 'all 0.15s ease' }} />
              <Slider value={brushSize} min={2} max={32} step={1}
                onChange={(_, v) => setBrushSize(v)}
                size="small" sx={{ color: '#4CC9F0',
                  '& .MuiSlider-thumb': { width: 14, height: 14 },
                  '& .MuiSlider-track': { height: 3 },
                  '& .MuiSlider-rail': { height: 3, bgcolor: 'rgba(255,255,255,0.15)' },
                }} />
            </Box>

            {/* Undo / Clear */}
            <Tooltip title="Undo">
              <IconButton size="small" onClick={undo} sx={{ color: '#8b949e', borderRadius: 1.5, p: 0.6 }}>
                <UndoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear">
              <IconButton size="small" onClick={clear} sx={{ color: '#EF233C', borderRadius: 1.5, p: 0.6 }}>
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Color palette — 2-row grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, p: 0.8, justifyContent: 'center' }}>
            {PALETTE.map(c => (
              <motion.div key={c} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.85 }}
                style={{ lineHeight: 0 }}>
                <Box onClick={() => { setColor(c); setTool(TOOLS.PEN); }} sx={{
                  width: 22, height: 22, bgcolor: c, borderRadius: '50%', cursor: 'pointer',
                  border: color === c ? '2.5px solid #4CC9F0' : '1.5px solid rgba(255,255,255,0.15)',
                  boxShadow: color === c ? '0 0 6px rgba(76,201,240,0.8)' : 'none',
                  outline: c === '#FFFFFF' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  transition: 'border 0.1s, box-shadow 0.1s',
                }} />
              </motion.div>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
