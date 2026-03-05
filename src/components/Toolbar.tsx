interface ToolbarProps {
  color: string;
  brushSize: number;
  peerCount: number;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onClear: () => void;
  onShareRoom: () => void;
}

const COLORS = [
  '#FFFFFF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#000000', '#808080'
];

const BRUSH_SIZES = [2, 5, 10, 20, 40];

export function Toolbar({
  color,
  brushSize,
  peerCount,
  onColorChange,
  onBrushSizeChange,
  onClear,
  onShareRoom,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">Color</span>
        <div className="color-picker">
          {COLORS.map(c => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Size</span>
        <div className="size-picker">
          {BRUSH_SIZES.map(s => (
            <button
              key={s}
              className={`size-btn ${brushSize === s ? 'active' : ''}`}
              onClick={() => onBrushSizeChange(s)}
              title={`${s}px`}
            >
              <span
                className="size-preview"
                style={{ width: Math.min(s, 20), height: Math.min(s, 20) }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <button className="action-btn clear-btn" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="toolbar-section room-info">
        <div className="peer-count">
          <span className="peer-dot" />
          {peerCount} {peerCount === 1 ? 'painter' : 'painters'}
        </div>
        <button className="action-btn share-btn" onClick={onShareRoom}>
          Share Room
        </button>
      </div>
    </div>
  );
}
