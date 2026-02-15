'use client';

/**
 * GraphBackground - Parallax sky/clouds (light) and stars (dark) background
 * for the project graph view.
 *
 * Accepts camera position and zoom from the parent ForceGraph2D component
 * and applies parallax offsets to multiple layers.
 */

import { useMemo } from 'react';

interface GraphBackgroundProps {
  cameraX: number;
  cameraY: number;
  zoom: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Star field generation (deterministic from seed)
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Star {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  size: number; // px
  opacity: number;
  twinkleDelay: number; // seconds
}

function generateStars(count: number, seed: number, sizeMin: number, sizeMax: number): Star[] {
  const rng = seededRandom(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * 120 - 10, // extend beyond edges for parallax
      y: rng() * 120 - 10,
      size: sizeMin + rng() * (sizeMax - sizeMin),
      opacity: 0.3 + rng() * 0.7,
      twinkleDelay: rng() * 6,
    });
  }
  return stars;
}

// Pre-generate star layers (stable across renders)
const STAR_LAYER_1 = generateStars(80, 42, 0.5, 1.5);   // distant, small
const STAR_LAYER_2 = generateStars(50, 137, 1.0, 2.5);   // mid-distance
const STAR_LAYER_3 = generateStars(20, 256, 2.0, 3.5);   // close, bright

// ---------------------------------------------------------------------------
// Cloud shapes (CSS-only, positioned by percentage)
// ---------------------------------------------------------------------------

interface Cloud {
  x: number;  // percentage
  y: number;  // percentage
  scale: number;
  opacity: number;
}

const CLOUD_LAYER_1: Cloud[] = [
  { x: 10, y: 20, scale: 1.2, opacity: 0.25 },
  { x: 35, y: 60, scale: 0.9, opacity: 0.2 },
  { x: 60, y: 15, scale: 1.4, opacity: 0.22 },
  { x: 80, y: 45, scale: 1.0, opacity: 0.18 },
  { x: 15, y: 75, scale: 1.1, opacity: 0.2 },
  { x: 90, y: 70, scale: 0.8, opacity: 0.15 },
];

const CLOUD_LAYER_2: Cloud[] = [
  { x: 20, y: 30, scale: 1.6, opacity: 0.3 },
  { x: 50, y: 50, scale: 1.3, opacity: 0.25 },
  { x: 75, y: 25, scale: 1.8, opacity: 0.28 },
  { x: 5, y: 55, scale: 1.1, opacity: 0.22 },
  { x: 45, y: 80, scale: 1.5, opacity: 0.2 },
];

const CLOUD_LAYER_3: Cloud[] = [
  { x: 30, y: 40, scale: 2.0, opacity: 0.35 },
  { x: 65, y: 20, scale: 2.2, opacity: 0.3 },
  { x: 10, y: 65, scale: 1.8, opacity: 0.25 },
  { x: 85, y: 55, scale: 2.4, opacity: 0.32 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphBackground({ cameraX, cameraY, zoom, width, height }: GraphBackgroundProps) {
  // Parallax factors: closer layers move more
  const parallax1 = 0.015;
  const parallax2 = 0.04;
  const parallax3 = 0.08;

  const offsets = useMemo(() => ({
    layer1: { x: cameraX * parallax1, y: cameraY * parallax1 },
    layer2: { x: cameraX * parallax2, y: cameraY * parallax2 },
    layer3: { x: cameraX * parallax3, y: cameraY * parallax3 },
  }), [cameraX, cameraY]);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      style={{ width, height }}
    >
      {/* ================================================================ */}
      {/* LIGHT MODE: Sky + Clouds                                        */}
      {/* ================================================================ */}
      <div className="absolute inset-0 dark:hidden">
        {/* Sky gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 25%, #e0f2fe 50%, #f0f9ff 75%, #ffffff 100%)',
          }}
        />

        {/* Sun glow */}
        <div
          className="absolute"
          style={{
            top: '-5%',
            right: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(253,224,71,0.3) 0%, rgba(253,224,71,0.1) 40%, transparent 70%)',
            transform: `translate(${offsets.layer1.x}px, ${offsets.layer1.y}px)`,
          }}
        />

        {/* Cloud layer 1 (distant) */}
        {CLOUD_LAYER_1.map((cloud, i) => (
          <div
            key={`cl1-${i}`}
            className="absolute"
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              transform: `translate(${offsets.layer1.x}px, ${offsets.layer1.y}px) scale(${cloud.scale})`,
              opacity: cloud.opacity,
            }}
          >
            <CloudShape />
          </div>
        ))}

        {/* Cloud layer 2 (mid) */}
        {CLOUD_LAYER_2.map((cloud, i) => (
          <div
            key={`cl2-${i}`}
            className="absolute"
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              transform: `translate(${offsets.layer2.x}px, ${offsets.layer2.y}px) scale(${cloud.scale})`,
              opacity: cloud.opacity,
            }}
          >
            <CloudShape />
          </div>
        ))}

        {/* Cloud layer 3 (close) */}
        {CLOUD_LAYER_3.map((cloud, i) => (
          <div
            key={`cl3-${i}`}
            className="absolute"
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              transform: `translate(${offsets.layer3.x}px, ${offsets.layer3.y}px) scale(${cloud.scale})`,
              opacity: cloud.opacity,
            }}
          >
            <CloudShape />
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/* DARK MODE: Stars + Nebula                                       */}
      {/* ================================================================ */}
      <div className="absolute inset-0 hidden dark:block">
        {/* Deep space gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 30%, #0f172a 60%, #1a1a2e 100%)',
          }}
        />

        {/* Nebula glow patches */}
        <div
          className="absolute"
          style={{
            top: '20%',
            left: '15%',
            width: '400px',
            height: '300px',
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)',
            transform: `translate(${offsets.layer1.x}px, ${offsets.layer1.y}px)`,
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: '10%',
            right: '20%',
            width: '350px',
            height: '250px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)',
            transform: `translate(${offsets.layer2.x}px, ${offsets.layer2.y}px)`,
          }}
        />

        {/* Star layer 1 (distant, small) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offsets.layer1.x}px, ${offsets.layer1.y}px)`,
          }}
        >
          {STAR_LAYER_1.map((star, i) => (
            <div
              key={`s1-${i}`}
              className="absolute rounded-full animate-twinkle"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: `rgba(226, 232, 240, ${star.opacity})`,
                animationDelay: `${star.twinkleDelay}s`,
                animationDuration: '4s',
              }}
            />
          ))}
        </div>

        {/* Star layer 2 (mid-distance) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offsets.layer2.x}px, ${offsets.layer2.y}px)`,
          }}
        >
          {STAR_LAYER_2.map((star, i) => (
            <div
              key={`s2-${i}`}
              className="absolute rounded-full animate-twinkle"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: `rgba(199, 210, 254, ${star.opacity})`,
                animationDelay: `${star.twinkleDelay}s`,
                animationDuration: '5s',
              }}
            />
          ))}
        </div>

        {/* Star layer 3 (close, bright) */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offsets.layer3.x}px, ${offsets.layer3.y}px)`,
          }}
        >
          {STAR_LAYER_3.map((star, i) => (
            <div
              key={`s3-${i}`}
              className="absolute rounded-full animate-twinkle"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: `rgba(255, 255, 255, ${star.opacity})`,
                boxShadow: `0 0 ${star.size * 2}px rgba(199, 210, 254, 0.4)`,
                animationDelay: `${star.twinkleDelay}s`,
                animationDuration: '3s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cloud SVG shape (pure CSS/SVG, no images)
// ---------------------------------------------------------------------------

function CloudShape() {
  return (
    <svg
      width="120"
      height="60"
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white"
    >
      <ellipse cx="60" cy="40" rx="50" ry="18" fill="currentColor" />
      <ellipse cx="38" cy="30" rx="28" ry="22" fill="currentColor" />
      <ellipse cx="72" cy="28" rx="32" ry="24" fill="currentColor" />
      <ellipse cx="55" cy="22" rx="24" ry="20" fill="currentColor" />
    </svg>
  );
}
