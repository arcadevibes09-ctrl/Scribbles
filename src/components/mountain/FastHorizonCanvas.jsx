// FILE: src/components/mountain/FastHorizonCanvas.jsx
import React, { useEffect, useRef } from 'react';

// Deterministic 1D smooth value noise for procedural mountain ridges
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function noise1D(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function fbmRidge(x, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise1D(x * freq);
    freq *= 2.05;
    amp *= 0.48;
  }
  return val;
}

/**
 * Pre-renders a tileable mountain ridge onto an offscreen canvas ONCE.
 * Scrolling then uses hardware-accelerated drawImage() with zero path recalculation.
 */
function createBakedRidgeLayer(tileWidth, height, cfg) {
  const off = document.createElement('canvas');
  off.width = tileWidth;
  off.height = height;
  const ctx = off.getContext('2d');

  const grad = ctx.createLinearGradient(0, height * cfg.topFrac, 0, height);
  grad.addColorStop(0, cfg.topColor);
  grad.addColorStop(1, cfg.bottomColor);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, height);

  const step = 6;
  for (let x = 0; x <= tileWidth; x += step) {
    // Seamless wrap using circular blend
    const t = x / tileWidth;
    const n1 = fbmRidge((t + cfg.seed) * cfg.scale, cfg.octaves);
    const n2 = fbmRidge((t - 1 + cfg.seed) * cfg.scale, cfg.octaves);
    const seamless = n1 * (1 - t) + n2 * t;

    const y = height * cfg.baseY - seamless * height * cfg.ampY;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(tileWidth, height);
  ctx.closePath();
  ctx.fill();

  // Subtle moonlight rim highlight along the ridge crest
  ctx.strokeStyle = cfg.rimColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return off;
}

export default function FastHorizonCanvas({ scrollPosRef, onReady }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);
    const tileW = Math.max(1200, width * 2);

    const layerConfigs = [
      {
        seed: 1.1,
        scale: 3.5,
        octaves: 3,
        baseY: 0.72,
        ampY: 0.34,
        topFrac: 0.35,
        topColor: '#161b26',
        bottomColor: '#0b0d13',
        rimColor: 'rgba(148, 163, 184, 0.12)',
        parallax: 0.14
      },
      {
        seed: 4.7,
        scale: 4.5,
        octaves: 4,
        baseY: 0.79,
        ampY: 0.28,
        topFrac: 0.45,
        topColor: '#11151f',
        bottomColor: '#090b10',
        rimColor: 'rgba(148, 163, 184, 0.18)',
        parallax: 0.32
      },
      {
        seed: 9.3,
        scale: 5.5,
        octaves: 4,
        baseY: 0.86,
        ampY: 0.22,
        topFrac: 0.55,
        topColor: '#0c0f17',
        bottomColor: '#06070a',
        rimColor: 'rgba(226, 232, 240, 0.15)',
        parallax: 0.62
      },
      {
        seed: 15.8,
        scale: 6.5,
        octaves: 3,
        baseY: 0.94,
        ampY: 0.14,
        topFrac: 0.7,
        topColor: '#08090d',
        bottomColor: '#050507',
        rimColor: 'rgba(255, 255, 255, 0.08)',
        parallax: 1.0
      }
    ];

    let bakedLayers = layerConfigs.map((cfg) => ({
      ...cfg,
      bitmap: createBakedRidgeLayer(tileW, height, cfg)
    }));

    // Pre-generate 45 stars
    const stars = Array.from({ length: 45 }, (_, i) => ({
      x: hash(i * 3.1) * width,
      y: hash(i * 7.3) * height * 0.48,
      r: 0.6 + hash(i * 11.7) * 1.1,
      alpha: 0.2 + hash(i * 5.9) * 0.55
    }));

    let rafId = 0;
    let lastDrawnPos = null;

    const renderFrame = () => {
      const currentPos = scrollPosRef?.current?.pos ?? 0;

      // Only repaint when the camera actually moves (0% CPU when idle!)
      if (lastDrawnPos === null || Math.abs(currentPos - lastDrawnPos) > 0.05) {
        lastDrawnPos = currentPos;

        // Night sky backdrop
        ctx.fillStyle = '#07090e';
        ctx.fillRect(0, 0, width, height);

        // Stars with gentle parallax
        ctx.fillStyle = '#e2e8f0';
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const sx = (((s.x - currentPos * 0.04) % width) + width) % width;
          ctx.globalAlpha = s.alpha;
          ctx.beginPath();
          ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Draw 4 pre-baked mountain ridges
        for (let i = 0; i < bakedLayers.length; i++) {
          const layer = bakedLayers[i];
          const shift = (((currentPos * layer.parallax) % tileW) + tileW) % tileW;
          ctx.drawImage(layer.bitmap, -shift, 0);
          ctx.drawImage(layer.bitmap, tileW - shift, 0);
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    onReady && onReady();
    rafId = requestAnimationFrame(renderFrame);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      bakedLayers = layerConfigs.map((cfg) => ({
        ...cfg,
        bitmap: createBakedRidgeLayer(tileW, height, cfg)
      }));
      lastDrawnPos = null;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [scrollPosRef, onReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
}
