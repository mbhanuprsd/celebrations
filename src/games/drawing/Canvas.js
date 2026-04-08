// src/games/drawing/Canvas.js
import React, { useEffect } from 'react';
import { Box, IconButton, Tooltip, Slider, Paper, Typography, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import UndoIcon from '@mui/icons-material/Undo';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateIcon from '@mui/icons-material/Create';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useCanvas } from '../../hooks/useCanvas';

const PALETTE = [
  '#1a1a2e','#16213e','#0f3460','#4361EE','#4CC9F0','#06D6A0',
  '#FFD166','#FF6B6B','#F72585','#7209B7','#ffffff','#e0e0e0',
  '#8B4513','#228B22','#FF8C00','#DC143C','#00CED1','#9400D3',
];

export function DrawingCanvas({ roomId, canDraw, word }) {
  const { canvasRef, tool, setTool, color, setColor, brushSize, setBrushSize,
    onMouseDown, onMouseMove, onMouseUp, undo, clear, TOOLS } = useCanvas(roomId, canDraw);

  const toolBtn = (t, icon, title) => (
    <Tooltip title={title} key={t}>
      <IconButton
        size="small"
        onClick={() => setTool(t)}
        sx={{
          bgcolor: tool === t ? 'primary.main' : 'transparent',
          color: tool === t ? 'white' : 'text.secondary',
          '&:hover': { bgcolor: tool === t ? 'primary.dark' : 'action.hover' },
          borderRadius: 2,
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      {/* Word indicator */}
      {canDraw && word && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Paper elevation={0} sx={{
            p: 1.5, textAlign: 'center',
            background: 'linear-gradient(135deg, #4361EE15, #F7258515)',
            border: '2px solid rgba(67,97,238,0.2)', borderRadius: 3,
          }}>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>DRAW THIS:</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', fontFamily: '"Fredoka One", cursive' }}>
              {word}
            </Typography>
          </Paper>
        </motion.div>
      )}

      {/* Toolbar */}
      {canDraw && (
        <Paper elevation={0} sx={{
          p: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          border: '1px solid rgba(67,97,238,0.1)', borderRadius: 3,
        }}>
          {/* Tools */}
          <Box display="flex" gap={0.5}>
            {toolBtn(TOOLS.PEN, <CreateIcon fontSize="small" />, 'Pen')}
            {toolBtn(TOOLS.ERASER, <AutoFixHighIcon fontSize="small" />, 'Eraser')}
          </Box>
          <Divider orientation="vertical" flexItem />

          {/* Brush size */}
          <Box sx={{ width: 80, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">Size</Typography>
            <Slider value={brushSize} min={2} max={30} step={1}
              onChange={(_, v) => setBrushSize(v)}
              size="small" sx={{ flex: 1 }}
            />
          </Box>
          <Divider orientation="vertical" flexItem />

          {/* Actions */}
          <Box display="flex" gap={0.5}>
            <Tooltip title="Undo"><IconButton size="small" onClick={undo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Clear"><IconButton size="small" onClick={clear} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Paper>
      )}

      {/* Canvas */}
      <Box sx={{ position: 'relative', flex: 1, borderRadius: 3, overflow: 'hidden',
        border: canDraw ? '3px solid #4361EE' : '2px solid rgba(67,97,238,0.1)',
        boxShadow: canDraw ? '0 0 30px rgba(67,97,238,0.2)' : 'none',
        transition: 'all 0.3s ease',
        minHeight: 340,
        bgcolor: 'white',
      }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={520}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
          style={{
            width: '100%', height: '100%',
            cursor: canDraw ? (tool === TOOLS.ERASER ? 'cell' : 'crosshair') : 'default',
            display: 'block', touchAction: 'none',
          }}
        />
        {!canDraw && (
          <Box sx={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
              <Typography variant="caption" sx={{
                bgcolor: 'rgba(0,0,0,0.5)', color: 'white',
                px: 2, py: 0.5, borderRadius: 2, fontWeight: 600,
              }}>
                👀 Watching...
              </Typography>
            </motion.div>
          </Box>
        )}
      </Box>

      {/* Color palette */}
      {canDraw && (
        <Paper elevation={0} sx={{
          p: 1, border: '1px solid rgba(67,97,238,0.1)', borderRadius: 3,
        }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {PALETTE.map(c => (
              <motion.div key={c} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                <Box
                  onClick={() => { setColor(c); setTool(TOOLS.PEN); }}
                  sx={{
                    width: 24, height: 24, bgcolor: c, borderRadius: '50%', cursor: 'pointer',
                    border: color === c ? '3px solid #4361EE' : '2px solid rgba(0,0,0,0.15)',
                    boxShadow: color === c ? '0 0 8px rgba(67,97,238,0.6)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                />
              </motion.div>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
