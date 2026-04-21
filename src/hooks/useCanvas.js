// src/hooks/useCanvas.js
// Key fix: "live" path in RTDB for the active stroke → no more dashes for remote viewers.
// Strategy:
//   LOCAL drawer  → draws locally as before. On each mousemove, overwrites
//                   canvas/roomId/live with ALL points of the current stroke so far.
//                   On mouseup → commits full stroke to canvas/roomId/strokes, clears live.
//   REMOTE viewer → renders all committed strokes PLUS the in-progress live stroke on top,
//                   so they see a continuously-updated line with no gaps.
import { useRef, useState, useEffect, useCallback } from 'react';
import { pushStroke, listenCanvas, clearCanvas, setLiveStroke, clearLiveStroke } from '../firebase/services';

const TOOLS = { PEN: 'pen', ERASER: 'eraser', FILL: 'fill', LINE: 'line', RECT: 'rect', CIRCLE: 'circle' };

export function useCanvas(roomId, canDraw) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef([]); // ALL points in the current stroke (not just a buffer)
  const liveFlushTimerRef = useRef(null);
  const committedStrokesRef = useRef([]); // mirror of what's in Firebase strokes
  const liveStrokeRef = useRef(null);    // current in-progress stroke from remote drawer

  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState('#1a1a2e');
  const [brushSize, setBrushSize] = useState(5);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctxRef.current = ctx;
    saveSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────
  const drawStroke = useCallback((ctx, stroke) => {
    if (!stroke?.points || stroke.points.length < 1) return;
    const pts = stroke.points;
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : (stroke.color || '#000');
    ctx.lineWidth = stroke.tool === 'eraser' ? (stroke.size || 5) * 3 : (stroke.size || 5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      // Smooth with quadratic curves when 3+ points
      if (i < pts.length - 1) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      } else {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();
  }, []);

  const redrawAll = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    committedStrokesRef.current.forEach(s => drawStroke(ctx, s));
    // Draw live (in-progress) stroke from the remote drawer on top
    if (liveStrokeRef.current) drawStroke(ctx, liveStrokeRef.current);
  }, [drawStroke]);

  // ── Firebase listeners (for non-drawers) ─────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenCanvas(
      roomId,
      // committed strokes updated
      (strokes) => {
        committedStrokesRef.current = strokes;
        if (!canDraw) redrawAll();
      },
      // canvas cleared
      () => {
        committedStrokesRef.current = [];
        liveStrokeRef.current = null;
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      },
      // live stroke (in-progress from remote drawer)
      (live) => {
        liveStrokeRef.current = live;
        if (!canDraw) redrawAll();
      }
    );
    return unsub;
  }, [roomId, canDraw, redrawAll]);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL();
    setHistory(h => {
      const newH = [...h.slice(0, historyIndex + 1), data];
      setHistoryIndex(newH.length - 1);
      return newH.slice(-20);
    });
  }, [historyIndex]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  // ── Local drawing (drawer only) ───────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (!canDraw) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e, canvasRef.current);
    currentStrokeRef.current = [pos];

    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [canDraw]);

  const onMouseMove = useCallback((e) => {
    if (!canDraw || !isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e, canvasRef.current);
    const ctx = ctxRef.current;

    // Draw locally (smooth)
    const pts = currentStrokeRef.current;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length >= 2) {
      const prev = pts[pts.length - 1];
      const mx = (prev.x + pos.x) / 2;
      const my = (prev.y + pos.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my);  // ← continue from where the curve actually ended
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    currentStrokeRef.current.push(pos);

    // Throttle live-stroke writes to Firebase (every 30ms) — send only the
    // recent tail of the stroke, not the entire accumulated point array.
    // FIX: capping to MAX_LIVE_POINTS prevents multi-second strokes from sending
    // hundreds of points (~30KB) per write; 80 points is more than enough for a
    // smooth live preview. The full stroke is committed on mouseUp anyway.
    const MAX_LIVE_POINTS = 80;
    if (!liveFlushTimerRef.current) {
      liveFlushTimerRef.current = setTimeout(() => {
        liveFlushTimerRef.current = null;
        if (isDrawingRef.current && currentStrokeRef.current.length > 0) {
          setLiveStroke(roomId, {
            points: currentStrokeRef.current.slice(-MAX_LIVE_POINTS),
            color,
            size: brushSize,
            tool,
          });
        }
      }, 30);
    }
  }, [canDraw, tool, color, brushSize, roomId]);

  const onMouseUp = useCallback(async (e) => {
    if (!canDraw || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    clearTimeout(liveFlushTimerRef.current);
    liveFlushTimerRef.current = null;

    const pts = currentStrokeRef.current;
    currentStrokeRef.current = [];

    if (pts.length > 0) {
      const stroke = { points: pts, color, size: brushSize, tool };
      // Commit to permanent strokes
      await pushStroke(roomId, stroke);
      // Clear live indicator
      await clearLiveStroke(roomId);
    }
    saveSnapshot();
  }, [canDraw, color, brushSize, tool, roomId, saveSnapshot]);

  const undo = useCallback(async () => {
    if (!canDraw || historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const img = new Image();
    img.onload = () => ctxRef.current.drawImage(img, 0, 0);
    img.src = history[newIndex];
  }, [canDraw, historyIndex, history]);

  const clear = useCallback(async () => {
    if (!canDraw) return;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await clearCanvas(roomId);
    saveSnapshot();
  }, [canDraw, roomId, saveSnapshot]);

  return {
    canvasRef, tool, setTool, color, setColor, brushSize, setBrushSize,
    onMouseDown, onMouseMove, onMouseUp,
    undo, clear, TOOLS,
  };
}