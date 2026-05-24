/**
 * DrawingTools — Chart annotation overlay.
 * Draw trendlines, support/resistance, fib retracements, text notes on top of charts.
 * Saves to localStorage per token.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Pencil, Minus, Type, Trash2, Undo, Redo, Save, ArrowRight, TrendingUp, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawingTool = "line" | "hline" | "text" | "fib" | "arrow" | null;
type DrawingColor = string;

interface Drawing {
  id: string;
  tool: DrawingTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: DrawingColor;
  text?: string;
}

interface Props {
  tokenMint: string;
  width?: number;
  height?: number;
}

const COLORS = ["#4ade80", "#f87171", "#fbbf24", "#60a5fa", "#c084fc", "#ffffff"];
const STORAGE_KEY = "ogscan_chart_drawings_";

export const DrawingTools: React.FC<Props> = ({ tokenMint, width = 600, height = 400 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<DrawingTool>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Load saved drawings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + tokenMint);
      if (saved) setDrawings(JSON.parse(saved));
    } catch {}
  }, [tokenMint]);

  // Render drawings
  const renderDrawings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawings.forEach(d => {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      switch (d.tool) {
        case "line":
          ctx.beginPath();
          ctx.moveTo(d.startX, d.startY);
          ctx.lineTo(d.endX, d.endY);
          ctx.stroke();
          break;
        case "hline":
          ctx.beginPath();
          ctx.setLineDash([8, 4]);
          ctx.moveTo(0, d.startY);
          ctx.lineTo(canvas.width, d.startY);
          ctx.stroke();
          break;
        case "arrow":
          ctx.beginPath();
          ctx.moveTo(d.startX, d.startY);
          ctx.lineTo(d.endX, d.endY);
          ctx.stroke();
          // Arrowhead
          const angle = Math.atan2(d.endY - d.startY, d.endX - d.startX);
          ctx.beginPath();
          ctx.moveTo(d.endX, d.endY);
          ctx.lineTo(d.endX - 12 * Math.cos(angle - 0.4), d.endY - 12 * Math.sin(angle - 0.4));
          ctx.moveTo(d.endX, d.endY);
          ctx.lineTo(d.endX - 12 * Math.cos(angle + 0.4), d.endY - 12 * Math.sin(angle + 0.4));
          ctx.stroke();
          break;
        case "fib":
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const dy = d.endY - d.startY;
          fibLevels.forEach(level => {
            const y = d.startY + dy * level;
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.fillStyle = d.color;
            ctx.font = "10px monospace";
            ctx.fillText(`${(level * 100).toFixed(1)}%`, 4, y - 3);
          });
          break;
        case "text":
          if (d.text) {
            ctx.fillStyle = d.color;
            ctx.font = "12px sans-serif";
            ctx.fillText(d.text, d.startX, d.startY);
          }
          break;
      }
    });
  }, [drawings]);

  useEffect(() => { renderDrawings(); }, [renderDrawings]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tool) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        addDrawing({ id: crypto.randomUUID(), tool, startX: x, startY: y, endX: x, endY: y, color, text });
      }
      return;
    }

    setIsDrawing(true);
    setStartPos({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos || !tool) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addDrawing({
      id: crypto.randomUUID(),
      tool,
      startX: startPos.x,
      startY: startPos.y,
      endX: x,
      endY: y,
      color,
    });

    setIsDrawing(false);
    setStartPos(null);
  };

  const addDrawing = (drawing: Drawing) => {
    setUndoStack(prev => [...prev, drawings]);
    setDrawings(prev => [...prev, drawing]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    setDrawings(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const clearAll = () => {
    setUndoStack(prev => [...prev, drawings]);
    setDrawings([]);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY + tokenMint, JSON.stringify(drawings));
  };

  const tools: Array<{ id: DrawingTool; icon: React.ReactNode; label: string }> = [
    { id: "line", icon: <Minus className="h-3.5 w-3.5" />, label: "Trendline" },
    { id: "hline", icon: <Minus className="h-3.5 w-3.5 opacity-50" />, label: "H-Line" },
    { id: "arrow", icon: <ArrowRight className="h-3.5 w-3.5" />, label: "Arrow" },
    { id: "fib", icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Fib" },
    { id: "text", icon: <Type className="h-3.5 w-3.5" />, label: "Text" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-white/[0.06] flex-wrap">
        <Pencil className="h-3.5 w-3.5 text-white/20 mr-1" />
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(tool === t.id ? null : t.id)}
            className={cn("p-1.5 rounded-lg border transition-all",
              tool === t.id
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-white/[0.06] text-white/20 hover:text-white/40"
            )}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-5 bg-white/[0.06] mx-1" />
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn("w-5 h-5 rounded-full border-2 transition-all",
              color === c ? "border-white/60 scale-110" : "border-white/10"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="w-px h-5 bg-white/[0.06] mx-1" />
        <button onClick={undo} className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-white/40" title="Undo">
          <Undo className="h-3 w-3" />
        </button>
        <button onClick={clearAll} className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-red-400" title="Clear All">
          <Trash2 className="h-3 w-3" />
        </button>
        <button onClick={save} className="p-1.5 rounded-lg border border-white/[0.06] text-white/20 hover:text-emerald-400" title="Save">
          <Save className="h-3 w-3" />
        </button>
      </div>

      {/* Canvas overlay */}
      <div className="relative" style={{ width: "100%", height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute inset-0 z-10"
          style={{ cursor: tool ? "crosshair" : "default", width: "100%", height: "100%" }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
        <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center text-white/10 text-xs">
          Chart embed renders beneath this overlay
        </div>
      </div>
    </div>
  );
};

export default DrawingTools;
