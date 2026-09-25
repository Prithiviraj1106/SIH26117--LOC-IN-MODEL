import React, { useEffect, useRef } from 'react';
import { AppTheme } from '../types';

interface LocalAiCoreBackgroundProps {
  theme?: AppTheme;
  intensity?: 'subtle' | 'vibrant' | 'ambient' | 'off';
  interactive?: boolean;
}

interface CoreDataPacket {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
  direction: 'inward' | 'outward' | 'orbit';
  targetRing: number;
  colorType: 'primary' | 'secondary' | 'accent';
}

interface SectorBlock {
  angle: number;
  length: number;
  layer: number;
  speed: number;
  active: boolean;
  alpha: number;
}

export const LocalAiCoreBackground: React.FC<LocalAiCoreBackgroundProps> = ({
  theme = 'slate',
  intensity = 'ambient',
  interactive = true
}) => {
  if (intensity === 'off') {
    return null;
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mouseRef = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    active: boolean;
    tiltX: number;
    tiltY: number;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false,
    tiltX: 0,
    tiltY: 0
  });

  // Dynamic Theme Color Palette
  const getPalette = (t?: AppTheme | string) => {
    switch (t) {
      case 'obsidian':
        return {
          glowCenter: 'rgba(255, 255, 255, 0.28)',
          glowOuter: 'rgba(200, 200, 220, 0.04)',
          primary: '#ffffff',
          secondary: '#cbd5e1',
          accent: '#94a3b8',
          ring1: 'rgba(255, 255, 255, 0.25)',
          ring2: 'rgba(203, 213, 225, 0.18)',
          ring3: 'rgba(148, 163, 184, 0.14)',
          ringBoundary: 'rgba(226, 232, 240, 0.35)',
          text: 'rgba(203, 213, 225, 0.65)'
        };
      case 'midnight':
        return {
          glowCenter: 'rgba(168, 85, 247, 0.35)',
          glowOuter: 'rgba(99, 102, 241, 0.05)',
          primary: '#c084fc',
          secondary: '#818cf8',
          accent: '#f472b6',
          ring1: 'rgba(192, 132, 252, 0.32)',
          ring2: 'rgba(129, 140, 248, 0.22)',
          ring3: 'rgba(236, 72, 153, 0.16)',
          ringBoundary: 'rgba(168, 85, 247, 0.40)',
          text: 'rgba(216, 180, 254, 0.70)'
        };
      case 'titanium':
        return {
          glowCenter: 'rgba(56, 189, 248, 0.32)',
          glowOuter: 'rgba(30, 58, 138, 0.05)',
          primary: '#38bdf8',
          secondary: '#94a3b8',
          accent: '#e2e8f0',
          ring1: 'rgba(56, 189, 248, 0.30)',
          ring2: 'rgba(148, 163, 184, 0.20)',
          ring3: 'rgba(125, 211, 252, 0.15)',
          ringBoundary: 'rgba(56, 189, 248, 0.40)',
          text: 'rgba(186, 230, 253, 0.70)'
        };
      case 'sovereign':
        return {
          glowCenter: 'rgba(16, 185, 129, 0.35)',
          glowOuter: 'rgba(5, 150, 105, 0.05)',
          primary: '#34d399',
          secondary: '#2dd4bf',
          accent: '#a7f3d0',
          ring1: 'rgba(52, 211, 153, 0.32)',
          ring2: 'rgba(45, 212, 191, 0.22)',
          ring3: 'rgba(16, 185, 129, 0.16)',
          ringBoundary: 'rgba(52, 211, 153, 0.42)',
          text: 'rgba(167, 243, 208, 0.70)'
        };
      case 'slate':
      default:
        return {
          glowCenter: 'rgba(6, 182, 212, 0.32)',
          glowOuter: 'rgba(59, 130, 246, 0.05)',
          primary: '#22d3ee',
          secondary: '#60a5fa',
          accent: '#a5f3fc',
          ring1: 'rgba(34, 211, 238, 0.30)',
          ring2: 'rgba(96, 165, 250, 0.22)',
          ring3: 'rgba(148, 163, 184, 0.16)',
          ringBoundary: 'rgba(34, 211, 238, 0.42)',
          text: 'rgba(165, 243, 252, 0.70)'
        };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Mouse tilt tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mouseRef.current.targetX = clientX;
      mouseRef.current.targetY = clientY;
      mouseRef.current.active = true;

      const halfW = rect.width * 0.5;
      const halfH = rect.height * 0.5;
      mouseRef.current.tiltY = ((clientX - halfW) / halfW) * 0.35;
      mouseRef.current.tiltX = -((clientY - halfH) / halfH) * 0.28;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.tiltX = 0;
      mouseRef.current.tiltY = 0;
    };

    if (interactive && containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    // Initialize Data Packets (Inference tokens moving inward/outward)
    const packetCount = 42;
    const packets: CoreDataPacket[] = [];
    const ringRadii = [85, 160, 245, 335, 415];

    for (let i = 0; i < packetCount; i++) {
      const isOrbit = Math.random() > 0.45;
      const ringIdx = Math.floor(Math.random() * ringRadii.length);
      packets.push({
        angle: Math.random() * Math.PI * 2,
        radius: isOrbit ? ringRadii[ringIdx] + (Math.random() - 0.5) * 12 : 30 + Math.random() * 380,
        speed: (Math.random() * 0.012 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.0 + 1.2,
        alpha: Math.random() * 0.6 + 0.3,
        direction: isOrbit ? 'orbit' : Math.random() > 0.5 ? 'inward' : 'outward',
        targetRing: ringIdx,
        colorType: Math.random() > 0.6 ? 'primary' : Math.random() > 0.3 ? 'secondary' : 'accent'
      });
    }

    // Initialize Sector Blocks (rotating data tracks around rings)
    const sectorBlocks: SectorBlock[] = [];
    for (let layer = 0; layer < 4; layer++) {
      const count = 6 + layer * 4;
      for (let s = 0; s < count; s++) {
        sectorBlocks.push({
          angle: (s / count) * Math.PI * 2 + Math.random() * 0.2,
          length: Math.random() * 0.22 + 0.08,
          layer,
          speed: (0.003 - layer * 0.0006) * (layer % 2 === 0 ? 1 : -1),
          active: Math.random() > 0.5,
          alpha: Math.random() * 0.4 + 0.2
        });
      }
    }

    let time = 0;
    let currTiltX = 0;
    let currTiltY = 0;

    const opacityMult = intensity === 'subtle' ? 0.45 : intensity === 'vibrant' ? 1.0 : 0.78;
    const palette = getPalette(theme);

    // Main Canvas Render Loop
    const render = () => {
      if (!canvas || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      time += 0.012;

      // Parallax smooth interpolation
      currTiltX += (mouseRef.current.tiltX - currTiltX) * 0.04;
      currTiltY += (mouseRef.current.tiltY - currTiltY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Core Center (responsive positioning: centered horizontally, centered or slightly raised vertically)
      const centerX = width * 0.52 + currTiltY * 45;
      const centerY = height * 0.48 + currTiltX * 35;

      // 1. Large Ambient Radiant Glow from Local Core
      const maxDim = Math.max(width, height);
      const coreAmbientRadius = Math.min(width, height) * 0.65;
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        20,
        centerX,
        centerY,
        coreAmbientRadius
      );
      ambientGlow.addColorStop(0, palette.glowCenter);
      ambientGlow.addColorStop(0.35, palette.glowOuter);
      ambientGlow.addColorStop(0.75, 'rgba(0, 0, 0, 0.03)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Elliptical perspective transform simulating 3D HUD inclination
      ctx.translate(centerX, centerY);
      const scaleY = 0.88 + currTiltX * 0.15;
      ctx.scale(1.0, scaleY);
      ctx.rotate(currTiltY * 0.2);

      // 2. LAYER 4: Air-Gapped Perimeter Boundary (Outer Ring ~415px)
      const rOuter = Math.min(width * 0.42, 415);
      if (rOuter > 150) {
        ctx.beginPath();
        ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ringBoundary;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Segmented Perimeter Corner Brackets (0, 90, 180, 270 deg)
        for (let b = 0; b < 4; b++) {
          const bAngle = (b * Math.PI) / 2 + time * 0.05;
          const bracketSpan = 0.18;
          ctx.beginPath();
          ctx.arc(0, 0, rOuter + 6, bAngle - bracketSpan, bAngle + bracketSpan);
          ctx.strokeStyle = palette.primary;
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Bracket Anchor Dots
          const pAx = Math.cos(bAngle - bracketSpan) * (rOuter + 6);
          const pAy = Math.sin(bAngle - bracketSpan) * (rOuter + 6);
          ctx.beginPath();
          ctx.arc(pAx, pAy, 2, 0, Math.PI * 2);
          ctx.fillStyle = palette.primary;
          ctx.fill();
        }

        // Concentric Perimeter Micro-Ticks
        const tickCount = 64;
        ctx.strokeStyle = palette.ring3;
        ctx.lineWidth = 0.8;
        for (let t = 0; t < tickCount; t++) {
          const tAngle = (t / tickCount) * Math.PI * 2 + time * 0.02;
          const isMajor = t % 8 === 0;
          const len = isMajor ? 9 : 4;
          const innerR = rOuter - len;
          ctx.beginPath();
          ctx.moveTo(Math.cos(tAngle) * innerR, Math.sin(tAngle) * innerR);
          ctx.lineTo(Math.cos(tAngle) * rOuter, Math.sin(tAngle) * rOuter);
          ctx.stroke();
        }

        // Air-Gap Security Boundary Text in Arc
        ctx.font = '9px monospace';
        ctx.fillStyle = palette.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = ['AIR-GAPPED PERIMETER', '100% LOCAL SILICON', 'ZERO EXTERNAL CLOUD CALLS', 'OFFLINE INFERENCE ENGINE'];
        for (let l = 0; l < labels.length; l++) {
          const lAngle = (l * Math.PI) / 2 + (Math.PI / 4) + time * 0.02;
          const tx = Math.cos(lAngle) * (rOuter - 18);
          const ty = Math.sin(lAngle) * (rOuter - 18);
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(lAngle + Math.PI / 2);
          ctx.fillText(labels[l], 0, 0);
          ctx.restore();
        }
      }

      // 3. LAYER 3: Memory Buffer & KV-Cache (Ring ~310px)
      const rLayer3 = Math.min(width * 0.32, 310);
      if (rLayer3 > 100) {
        ctx.beginPath();
        ctx.arc(0, 0, rLayer3, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ring3;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Secondary subtle counter-rotating ring
        ctx.beginPath();
        ctx.arc(0, 0, rLayer3 - 12, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ring2;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rotating memory sector arcs
        sectorBlocks
          .filter((s) => s.layer === 2)
          .forEach((s) => {
            s.angle += s.speed;
            ctx.beginPath();
            ctx.arc(0, 0, rLayer3 - 6, s.angle, s.angle + s.length);
            ctx.strokeStyle = palette.secondary;
            ctx.lineWidth = 2.4;
            ctx.stroke();
          });
      }

      // 4. LAYER 2: Vector Embedding & Neural Synapse Latent Space (Ring ~210px)
      const rLayer2 = Math.min(width * 0.22, 210);
      if (rLayer2 > 70) {
        ctx.beginPath();
        ctx.arc(0, 0, rLayer2, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ring2;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // High-density sector tracks
        sectorBlocks
          .filter((s) => s.layer === 1)
          .forEach((s) => {
            s.angle += s.speed;
            ctx.beginPath();
            ctx.arc(0, 0, rLayer2, s.angle, s.angle + s.length);
            ctx.strokeStyle = palette.primary;
            ctx.lineWidth = 3.0;
            ctx.stroke();
          });

        // 8 Radial Bus Lines connecting Layer 2 to Core
        for (let b = 0; b < 8; b++) {
          const busAngle = (b / 8) * Math.PI * 2 + time * 0.04;
          const rInnerBus = 75;
          ctx.beginPath();
          ctx.moveTo(Math.cos(busAngle) * rInnerBus, Math.sin(busAngle) * rInnerBus);
          ctx.lineTo(Math.cos(busAngle) * rLayer2, Math.sin(busAngle) * rLayer2);
          ctx.strokeStyle = palette.ring3;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 5]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Radial connection junction node
          const jx = Math.cos(busAngle) * rLayer2;
          const jy = Math.sin(busAngle) * rLayer2;
          ctx.beginPath();
          ctx.arc(jx, jy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = palette.primary;
          ctx.fill();
        }
      }

      // 5. LAYER 1: Tensor Core & Execution Matrix (Inner Ring ~110px)
      const rLayer1 = Math.min(width * 0.13, 110);
      ctx.beginPath();
      ctx.arc(0, 0, rLayer1, 0, Math.PI * 2);
      ctx.strokeStyle = palette.ring1;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Dual counter-rotating quantized rings
      const rotAngle1 = time * 0.4;
      const rotAngle2 = -time * 0.35;

      ctx.save();
      ctx.rotate(rotAngle1);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, rLayer1, a, a + 0.12);
        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.rotate(rotAngle2);
      ctx.beginPath();
      ctx.arc(0, 0, rLayer1 - 12, 0, Math.PI * 2);
      ctx.strokeStyle = palette.ring2;
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 6. CENTRAL GLOWING AI CORE (Nuclear Processing Nexus ~48px)
      const pulsePhase = Math.sin(time * 2.2) * 0.5 + 0.5;
      const coreRadius = 40 + pulsePhase * 8;

      // Volumetric Core Radial Glow
      const coreGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, coreRadius * 2.2);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.25, palette.primary);
      coreGrad.addColorStop(0.65, palette.secondary);
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Core Solid Sphere
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = palette.primary;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Intelligence Nexus Ring & Gyro Arc
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Concentric Micro Gyro Blades inside Core
      for (let g = 0; g < 3; g++) {
        const gAngle = time * (1.2 + g * 0.4) * (g % 2 === 0 ? 1 : -1);
        ctx.beginPath();
        ctx.ellipse(0, 0, coreRadius + 14 + g * 8, (coreRadius + 14 + g * 8) * 0.35, gAngle, 0, Math.PI * 2);
        ctx.strokeStyle = g === 0 ? palette.primary : palette.accent;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // 7. INFERENCE DATA PACKETS & SYNAPTIC TOKENS
      packets.forEach((p) => {
        // Move according to state
        if (p.direction === 'orbit') {
          p.angle += p.speed;
        } else if (p.direction === 'inward') {
          p.radius -= Math.abs(p.speed) * 90;
          p.angle += p.speed * 0.5;
          if (p.radius <= 40) {
            // Reached core -> switch to outward generated token!
            p.direction = 'outward';
            p.radius = 45;
            p.speed = (Math.random() * 0.012 + 0.006);
          }
        } else if (p.direction === 'outward') {
          p.radius += Math.abs(p.speed) * 75;
          p.angle += p.speed * 0.5;
          if (p.radius >= rOuter - 10) {
            // Reached air-gap boundary -> bounce back inward! Never leaves device
            p.direction = 'inward';
            p.radius = rOuter - 15;
          }
        }

        const px = Math.cos(p.angle) * p.radius;
        const py = Math.sin(p.angle) * p.radius;

        // Packet trail / dot
        const color = p.colorType === 'primary' ? palette.primary : p.colorType === 'secondary' ? palette.secondary : palette.accent;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove);
        containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [theme, intensity, interactive]);

  return (
    <div
      ref={containerRef}
      id="local-ai-core-background-container"
      className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none transition-opacity duration-700"
      style={{
        opacity: intensity === 'subtle' ? 0.45 : intensity === 'vibrant' ? 0.98 : 0.82
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
      {/* Subtle bottom horizon vignette to maintain ultra-clean chat input & button contrast */}
      <div 
        className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent pointer-events-none"
      />
    </div>
  );
};
