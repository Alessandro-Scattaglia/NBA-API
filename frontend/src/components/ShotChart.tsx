import React, { useRef, useEffect, useState } from 'react';

interface Shot {
  LOC_X: number;
  LOC_Y: number;
  SHOT_MADE_FLAG: number;
}

interface Props {
  shots: Shot[];
}

const W = 500;
const H = 470;

// NBA shot chart coords → canvas coords
// LOC_X: -250 to 250, LOC_Y: -52 to ~418
// Basket at canvas (250, 418), baseline at canvas y=470
const cx = (locX: number) => locX + 250;
const cy = (locY: number) => 418 - locY;

function drawCourt(
  ctx: CanvasRenderingContext2D,
  colors: {
    line: string;
    paint: string;
    fill: string;
    hoop: string;
  }
) {
  const { line, paint, fill, hoop } = colors;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);

  // Paint fill
  ctx.fillStyle = paint;
  ctx.fillRect(cx(-80), cy(190), 160, H - cy(190));

  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;

  // Lane rect
  ctx.strokeRect(cx(-80), cy(190), 160, H - cy(190));

  // Free throw circle top half (solid)
  ctx.beginPath();
  ctx.arc(cx(0), cy(190), 60, Math.PI, 0, false);
  ctx.stroke();

  // Free throw circle bottom half (dashed)
  ctx.beginPath();
  ctx.setLineDash([5, 4]);
  ctx.arc(cx(0), cy(190), 60, 0, Math.PI, false);
  ctx.stroke();
  ctx.setLineDash([]);

  // Basket circle
  ctx.strokeStyle = hoop;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx(0), cy(0), 7.5, 0, 2 * Math.PI);
  ctx.stroke();

  // Backboard
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx(-30), cy(-7.5));
  ctx.lineTo(cx(30), cy(-7.5));
  ctx.stroke();

  ctx.lineWidth = 1.5;

  // Restricted area arc
  ctx.beginPath();
  ctx.arc(cx(0), cy(0), 40, Math.PI, 0, false);
  ctx.stroke();

  // Three-point line
  const tpCornerY = Math.sqrt(237.5 * 237.5 - 220 * 220); // ≈ 89.47
  const startAngle = Math.atan2(cy(tpCornerY) - cy(0), cx(-220) - cx(0));
  const endAngle = Math.atan2(cy(tpCornerY) - cy(0), cx(220) - cx(0));

  ctx.beginPath();
  ctx.moveTo(cx(-220), H); // baseline
  ctx.lineTo(cx(-220), cy(tpCornerY));
  ctx.arc(cx(0), cy(0), 237.5, startAngle, endAngle, false);
  ctx.lineTo(cx(220), H);
  ctx.stroke();

  // Half-court line
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.stroke();
}

export default function ShotChart({ shots }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const appEl = document.querySelector('.app');
    if (!appEl) return;
    const observer = new MutationObserver(() => setThemeVersion(v => v + 1));
    observer.observe(appEl, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const appEl = document.querySelector('.app') as HTMLElement | null;
    const styles = getComputedStyle(appEl || document.documentElement);
    const colors = {
      line: styles.getPropertyValue('--shot-line').trim() || '#2d3d55',
      paint: styles.getPropertyValue('--shot-paint').trim() || 'rgba(29,66,138,0.10)',
      fill: styles.getPropertyValue('--shot-fill').trim() || '#0d1117',
      hoop: styles.getPropertyValue('--shot-hoop').trim() || '#ef4444',
      make: styles.getPropertyValue('--shot-make').trim() || 'rgba(34,197,94,0.8)',
      makeBorder: styles.getPropertyValue('--shot-make-border').trim() || 'rgba(34,197,94,1)',
      miss: styles.getPropertyValue('--shot-miss').trim() || 'rgba(239,68,68,0.55)'
    };

    drawCourt(ctx, colors);

    shots.forEach(shot => {
      const x = cx(shot.LOC_X);
      const y = cy(shot.LOC_Y);
      const made = shot.SHOT_MADE_FLAG === 1;

      if (made) {
        ctx.fillStyle = colors.make;
        ctx.strokeStyle = colors.makeBorder;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.strokeStyle = colors.miss;
        ctx.lineWidth = 1.5;
        const s = 3;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
        ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
        ctx.stroke();
      }
    });
  }, [shots, themeVersion]);

  const made = shots.filter(s => s.SHOT_MADE_FLAG === 1).length;
  const total = shots.length;
  const pct = total > 0 ? ((made / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="shot-chart-container">
      <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {made}/{total} canestri · <strong style={{ color: 'var(--text)' }}>{pct}% dal campo</strong>
      </p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="shot-chart-canvas"
      />
      <div className="shot-chart-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--shot-make)' }} />
          <span>Canestro ({made})</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--shot-miss)', borderRadius: 2 }} />
          <span>Sbagliato ({total - made})</span>
        </div>
      </div>
    </div>
  );
}
