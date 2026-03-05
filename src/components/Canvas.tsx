import { useRef, useEffect, useState, useCallback } from 'react';
import type { DrawStroke } from '../hooks/useRoom';

interface CanvasProps {
  strokes: DrawStroke[];
  color: string;
  brushSize: number;
  onStroke: (stroke: Omit<DrawStroke, 'id' | 'peerId'>) => void;
}

export function Canvas({ strokes, color, brushSize, onStroke }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      ctx.stroke();
    }

    // Draw current stroke being made
    if (currentPoints.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(currentPoints[0][0], currentPoints[0][1]);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i][0], currentPoints[i][1]);
      }
      ctx.stroke();
    }
  }, [strokes, currentPoints, color, brushSize]);

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return [
        (touch.clientX - rect.left) * scaleX,
        (touch.clientY - rect.top) * scaleY
      ];
    } else {
      return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
      ];
    }
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentPoints([point]);
  }, [getCanvasPoint]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentPoints(prev => [...prev, point]);
  }, [isDrawing, getCanvasPoint]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length >= 2) {
      onStroke({
        points: currentPoints,
        color,
        size: brushSize,
      });
    }

    setCurrentPoints([]);
  }, [isDrawing, currentPoints, color, brushSize, onStroke]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;

      // Use a fixed internal resolution
      canvas.width = 1920;
      canvas.height = 1080;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="canvas"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
}
