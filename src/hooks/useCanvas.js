// src/hooks/useCanvas.js
import { useRef, useState, useEffect, useCallback } from 'react';
import { pushStroke, listenCanvas, clearCanvas } from '../firebase/services';

const TOOLS = { PEN: 'pen', ERASER: 'eraser', FILL: 'fill', LINE: 'line', RECT: 'rect', CIRCLE: 'circle' };

export function useCanvas(roomId, canDraw) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const strokeBufferRef = useRef([]);
  const flushTimerRef = useRef(null);

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
  }, []);

  // Listen to remote strokes
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenCanvas(
      roomId,
      (strokes) => {
        if (!canDraw) renderStrokes(strokes);
      },
      () => {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (ctx && canvas) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    );
    return unsub;
  }, [roomId, canDraw]);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL();
    setHistory(h => {
      const newH = [...h.slice(0, historyIndex + 1), data];
      setHistoryIndex(newH.length - 1);
      return newH.slice(-20); // keep 20 snapshots
    });
  }, [historyIndex]);

  const renderStrokes = useCallback((strokes) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const pts = stroke.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    });
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const flushStroke = useCallback(() => {
    if (!strokeBufferRef.current.length) return;
    const stroke = {
      points: [...strokeBufferRef.current],
      color,
      size: brushSize,
      tool,
    };
    strokeBufferRef.current = [];
    pushStroke(roomId, stroke);
  }, [roomId, color, brushSize, tool]);

  const onMouseDown = useCallback((e) => {
    if (!canDraw) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e, canvasRef.current);
    lastPosRef.current = pos;
    strokeBufferRef.current = [pos];

    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [canDraw]);

  const onMouseMove = useCallback((e) => {
    if (!canDraw || !isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e, canvasRef.current);
    const ctx = ctxRef.current;

    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    strokeBufferRef.current.push(pos);

    // Batch flush every 50ms
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushStroke();
      }, 50);
    }

    lastPosRef.current = pos;
  }, [canDraw, tool, color, brushSize, flushStroke]);

  const onMouseUp = useCallback((e) => {
    if (!canDraw || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    flushStroke();
    saveSnapshot();
  }, [canDraw, flushStroke, saveSnapshot]);

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
