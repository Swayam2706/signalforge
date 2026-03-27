import { useEffect, useRef } from 'react';

/**
 * Pure-canvas candlestick chart with requestAnimationFrame scrolling.
 * Uses ResizeObserver for reliable sizing. Runs infinitely.
 */

const CANDLE_W = 11;
const GAP = 5;
const STEP = CANDLE_W + GAP;
const PAD_Y = 28;
const SPEED = 0.35;
const GLOW_R_MIN = 4;
const GLOW_R_MAX = 7;
const GLOW_PERIOD = 2500;

function generateCandles(count, startPrice) {
  const out = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const vol = 2 + Math.random() * 5;
    const dir = Math.random() > 0.44 ? 1 : -1;
    const body = vol * (0.3 + Math.random() * 0.7);
    const o = price;
    const c = price + dir * body;
    const h = Math.max(o, c) + Math.random() * vol * 0.5;
    const l = Math.min(o, c) - Math.random() * vol * 0.5;
    out.push({ o, c, h, l, bull: c >= o });
    price = c + (Math.random() - 0.5) * 1.5;
  }
  return out;
}

export default function CandlestickChart() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Initialize candle data
    if (!stateRef.current) {
      const startPrice = 150 + Math.random() * 50;
      const candles = generateCandles(200, startPrice);
      stateRef.current = { candles, offset: 0 };
    }

    // Resize handler using ResizeObserver for reliable dimensions
    function applySize(w, h) {
      if (w < 1 || h < 1) return;
      sizeRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        applySize(width, height);
      }
    });
    ro.observe(canvas.parentElement);

    // Initial size
    const rect = canvas.parentElement.getBoundingClientRect();
    applySize(rect.width, rect.height);

    function yMap(v, min, max, h) {
      const r = max - min || 1;
      return PAD_Y + ((max - v) / r) * (h - PAD_Y * 2);
    }

    let rafId;
    let lastTime = 0;
    let running = true;

    function draw(time) {
      if (!running) return;

      const dt = lastTime ? (time - lastTime) / 16.667 : 1;
      lastTime = time;

      const W = sizeRef.current.w;
      const H = sizeRef.current.h;

      // Skip frame if canvas has no size yet — but keep the loop alive
      if (W < 1 || H < 1) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const s = stateRef.current;
      s.offset += SPEED * dt;

      // Recycle candles when many have scrolled off
      const scrolledOff = Math.floor(s.offset / STEP);
      if (scrolledOff > 60) {
        s.candles = s.candles.slice(scrolledOff);
        s.offset -= scrolledOff * STEP;
        const more = generateCandles(80, s.candles[s.candles.length - 1].c);
        s.candles.push(...more);
      }

      const startIdx = Math.max(0, Math.floor(s.offset / STEP) - 1);
      const visibleCount = Math.ceil(W / STEP) + 3;
      const endIdx = Math.min(s.candles.length, startIdx + visibleCount);
      const visible = s.candles.slice(startIdx, endIdx);

      let pMin = Infinity, pMax = -Infinity;
      for (const c of visible) {
        if (c.l < pMin) pMin = c.l;
        if (c.h > pMax) pMax = c.h;
      }
      const pRange = pMax - pMin || 1;
      pMin -= pRange * 0.05;
      pMax += pRange * 0.05;

      ctx.clearRect(0, 0, W, H);

      // Horizontal price levels
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (const pct of [0.25, 0.5, 0.75]) {
        const y = PAD_Y + pct * (H - PAD_Y * 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Trend line
      const trendPts = [];
      for (let i = 0; i < visible.length; i++) {
        const idx = startIdx + i;
        const x = idx * STEP + CANDLE_W / 2 - s.offset;
        const y = yMap(visible[i].c, pMin, pMax, H);
        trendPts.push({ x, y });
      }

      if (trendPts.length > 1) {
        // Area fill
        ctx.beginPath();
        ctx.moveTo(trendPts[0].x, trendPts[0].y);
        for (let i = 1; i < trendPts.length; i++) {
          const p = trendPts[i - 1], c = trendPts[i];
          const cpx = (p.x + c.x) / 2;
          ctx.bezierCurveTo(cpx, p.y, cpx, c.y, c.x, c.y);
        }
        const last = trendPts[trendPts.length - 1];
        ctx.lineTo(last.x, H);
        ctx.lineTo(trendPts[0].x, H);
        ctx.closePath();
        const aGrad = ctx.createLinearGradient(0, 0, 0, H);
        aGrad.addColorStop(0, 'rgba(212,175,55,0.07)');
        aGrad.addColorStop(1, 'rgba(212,175,55,0)');
        ctx.fillStyle = aGrad;
        ctx.fill();

        // Trend stroke
        ctx.beginPath();
        ctx.moveTo(trendPts[0].x, trendPts[0].y);
        for (let i = 1; i < trendPts.length; i++) {
          const p = trendPts[i - 1], c = trendPts[i];
          const cpx = (p.x + c.x) / 2;
          ctx.bezierCurveTo(cpx, p.y, cpx, c.y, c.x, c.y);
        }
        const tGrad = ctx.createLinearGradient(0, 0, W, 0);
        tGrad.addColorStop(0, 'rgba(212,175,55,0)');
        tGrad.addColorStop(0.4, 'rgba(212,175,55,0.25)');
        tGrad.addColorStop(1, 'rgba(212,175,55,0.45)');
        ctx.strokeStyle = tGrad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw candles
      const lastVisIdx = visible.length - 1;
      for (let i = 0; i < visible.length; i++) {
        const candle = visible[i];
        const idx = startIdx + i;
        const x = idx * STEP + 10 - s.offset;
        const bTop = yMap(Math.max(candle.o, candle.c), pMin, pMax, H);
        const bBot = yMap(Math.min(candle.o, candle.c), pMin, pMax, H);
        const bH = Math.max(bBot - bTop, 1.5);
        const wTop = yMap(candle.h, pMin, pMax, H);
        const wBot = yMap(candle.l, pMin, pMax, H);
        const wx = x + CANDLE_W / 2;
        const age = i / visible.length;
        const isLast = i >= lastVisIdx - 1;
        const op = isLast ? 1 : 0.3 + age * 0.55;
        const col = candle.bull ? '#16a34a' : '#dc2626';
        const colBright = candle.bull ? '#22c55e' : '#ef4444';

        ctx.globalAlpha = op;

        // Wick
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = op * 0.6;
        ctx.beginPath();
        ctx.moveTo(wx, wTop);
        ctx.lineTo(wx, wBot);
        ctx.stroke();

        // Body
        ctx.globalAlpha = op;
        const bGrad = ctx.createLinearGradient(0, bTop, 0, bTop + bH);
        bGrad.addColorStop(0, colBright);
        bGrad.addColorStop(1, col);
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.roundRect(x, bTop, CANDLE_W, bH, 2);
        ctx.fill();

        // Active candle glow
        if (i === lastVisIdx) {
          ctx.globalAlpha = 1;
          const closeY = yMap(candle.c, pMin, pMax, H);
          const pulse = (Math.sin(time / GLOW_PERIOD * Math.PI * 2) + 1) / 2;
          const r = GLOW_R_MIN + pulse * (GLOW_R_MAX - GLOW_R_MIN);
          const glowAlpha = 0.3 + pulse * 0.4;

          ctx.beginPath();
          ctx.arc(wx, closeY, r, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.globalAlpha = glowAlpha;
          ctx.fill();

          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = col;
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(wx, closeY);
          ctx.lineTo(W, closeY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.globalAlpha = 1;

      // Keep the loop alive — always schedule next frame
      rafId = requestAnimationFrame(draw);
    }

    // Start the animation loop
    rafId = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundSize: '20px 20px',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
