import React, { useEffect, useRef, useState } from 'react';
import { AppTheme } from '../types';

interface FuturisticLightWavesProps {
  theme?: AppTheme;
  intensity?: 'subtle' | 'vibrant' | 'ambient' | 'off';
  interactive?: boolean;
}

export const FuturisticLightWaves: React.FC<FuturisticLightWavesProps> = ({
  theme = 'slate',
  intensity = 'ambient',
  interactive = true
}) => {
  if (intensity === 'off') {
    return null;
  }
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number; active: boolean }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false
  });

  // Color palettes based on active workspace theme
  const getThemePalette = (currentTheme?: AppTheme | string) => {
    switch (currentTheme) {
      case 'obsidian':
        return {
          bgGradStart: 'rgba(12, 12, 16, 0.95)',
          bgGradEnd: 'rgba(5, 5, 8, 0.98)',
          glowColor: 'rgba(255, 255, 255, 0.15)',
          waves: [
            { color1: 'rgba(220, 220, 240, 0.18)', color2: 'rgba(160, 160, 180, 0.02)', speed: 0.008, freq: 0.0018, amp: 55, yOffset: 0.65 },
            { color1: 'rgba(190, 190, 210, 0.14)', color2: 'rgba(120, 120, 150, 0.01)', speed: 0.012, freq: 0.0024, amp: 45, yOffset: 0.72 },
            { color1: 'rgba(240, 240, 255, 0.12)', color2: 'rgba(90, 90, 120, 0.01)', speed: 0.006, freq: 0.0014, amp: 70, yOffset: 0.58 },
            { color1: 'rgba(170, 170, 190, 0.10)', color2: 'rgba(60, 60, 80, 0.01)', speed: 0.015, freq: 0.0032, amp: 35, yOffset: 0.78 }
          ],
          particles: 'rgba(230, 230, 255, 0.4)'
        };
      case 'midnight':
        return {
          bgGradStart: 'rgba(15, 10, 30, 0.95)',
          bgGradEnd: 'rgba(8, 4, 18, 0.98)',
          glowColor: 'rgba(168, 85, 247, 0.25)',
          waves: [
            { color1: 'rgba(168, 85, 247, 0.24)', color2: 'rgba(99, 102, 241, 0.03)', speed: 0.009, freq: 0.0018, amp: 65, yOffset: 0.62 },
            { color1: 'rgba(192, 132, 252, 0.18)', color2: 'rgba(236, 72, 153, 0.02)', speed: 0.013, freq: 0.0022, amp: 50, yOffset: 0.70 },
            { color1: 'rgba(129, 140, 248, 0.15)', color2: 'rgba(79, 70, 229, 0.02)', speed: 0.007, freq: 0.0012, amp: 75, yOffset: 0.55 },
            { color1: 'rgba(217, 70, 239, 0.12)', color2: 'rgba(147, 51, 234, 0.01)', speed: 0.016, freq: 0.0030, amp: 40, yOffset: 0.78 }
          ],
          particles: 'rgba(216, 180, 254, 0.5)'
        };
      case 'titanium':
        return {
          bgGradStart: 'rgba(10, 15, 25, 0.95)',
          bgGradEnd: 'rgba(5, 10, 18, 0.98)',
          glowColor: 'rgba(56, 189, 248, 0.22)',
          waves: [
            { color1: 'rgba(56, 189, 248, 0.22)', color2: 'rgba(148, 163, 184, 0.02)', speed: 0.008, freq: 0.0016, amp: 60, yOffset: 0.63 },
            { color1: 'rgba(125, 211, 252, 0.16)', color2: 'rgba(71, 85, 105, 0.02)', speed: 0.011, freq: 0.0022, amp: 48, yOffset: 0.71 },
            { color1: 'rgba(203, 213, 225, 0.14)', color2: 'rgba(51, 65, 85, 0.01)', speed: 0.006, freq: 0.0013, amp: 70, yOffset: 0.56 },
            { color1: 'rgba(14, 165, 233, 0.12)', color2: 'rgba(30, 41, 59, 0.01)', speed: 0.014, freq: 0.0028, amp: 38, yOffset: 0.79 }
          ],
          particles: 'rgba(186, 230, 253, 0.5)'
        };
      case 'sovereign':
        return {
          bgGradStart: 'rgba(6, 20, 15, 0.95)',
          bgGradEnd: 'rgba(3, 12, 9, 0.98)',
          glowColor: 'rgba(16, 185, 129, 0.25)',
          waves: [
            { color1: 'rgba(16, 185, 129, 0.22)', color2: 'rgba(20, 184, 166, 0.03)', speed: 0.008, freq: 0.0017, amp: 60, yOffset: 0.62 },
            { color1: 'rgba(52, 211, 153, 0.16)', color2: 'rgba(5, 150, 105, 0.02)', speed: 0.012, freq: 0.0023, amp: 48, yOffset: 0.71 },
            { color1: 'rgba(45, 212, 191, 0.14)', color2: 'rgba(15, 118, 110, 0.02)', speed: 0.006, freq: 0.0013, amp: 70, yOffset: 0.55 },
            { color1: 'rgba(110, 231, 183, 0.12)', color2: 'rgba(6, 78, 59, 0.01)', speed: 0.015, freq: 0.0030, amp: 38, yOffset: 0.79 }
          ],
          particles: 'rgba(110, 231, 183, 0.5)'
        };
      case 'slate':
      default:
        return {
          bgGradStart: 'rgba(10, 16, 28, 0.95)',
          bgGradEnd: 'rgba(6, 10, 18, 0.98)',
          glowColor: 'rgba(6, 182, 212, 0.24)',
          waves: [
            { color1: 'rgba(6, 182, 212, 0.22)', color2: 'rgba(59, 130, 246, 0.02)', speed: 0.008, freq: 0.0017, amp: 65, yOffset: 0.62 },
            { color1: 'rgba(56, 189, 248, 0.17)', color2: 'rgba(99, 102, 241, 0.02)', speed: 0.012, freq: 0.0024, amp: 50, yOffset: 0.70 },
            { color1: 'rgba(99, 102, 241, 0.14)', color2: 'rgba(14, 165, 233, 0.02)', speed: 0.006, freq: 0.0013, amp: 75, yOffset: 0.54 },
            { color1: 'rgba(34, 211, 238, 0.12)', color2: 'rgba(30, 58, 138, 0.01)', speed: 0.015, freq: 0.0031, amp: 40, yOffset: 0.78 }
          ],
          particles: 'rgba(165, 243, 252, 0.5)'
        };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    // Responsive Canvas Size handling
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

    // Particle nodes floating along waves
    const particleCount = 38;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: Math.random() * 1.8 + 0.6,
      speedX: (Math.random() - 0.5) * 0.0006,
      speedY: (Math.random() - 0.5) * 0.0004,
      alpha: Math.random() * 0.5 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01
    }));

    // Mouse movement tracker
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left;
      mouseRef.current.targetY = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    if (interactive && containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    const palette = getThemePalette(theme);

    // Main Animation Loop
    const render = () => {
      if (!canvas || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      // Smooth mouse follow interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Futuristic Radial Ambient Glow Behind Waves
      const centerX = width * 0.5;
      const centerY = height * 0.7;
      const glowRadius = Math.max(width, height) * 0.65;
      const radialGlow = ctx.createRadialGradient(
        centerX + (mouseRef.current.active ? (mouseRef.current.x - centerX) * 0.15 : 0),
        centerY + (mouseRef.current.active ? (mouseRef.current.y - centerY) * 0.15 : 0),
        10,
        centerX,
        centerY,
        glowRadius
      );
      radialGlow.addColorStop(0, palette.glowColor);
      radialGlow.addColorStop(0.5, 'rgba(0,0,0,0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Light Wave Ribbons
      ctx.save();
      ctx.globalCompositeOperation = 'screen'; // Creates intense futuristic photon luminescence

      palette.waves.forEach((wave, idx) => {
        ctx.beginPath();
        const baseOffset = height * wave.yOffset;
        ctx.moveTo(0, height);

        // Step through x coordinates to calculate wave curves
        const stepX = 8;
        for (let x = 0; x <= width; x += stepX) {
          // Dynamic mouse elevation effect
          let mouseDistEffect = 0;
          if (mouseRef.current.active) {
            const dx = x - mouseRef.current.x;
            const dy = baseOffset - mouseRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 260) {
              mouseDistEffect = Math.sin((1 - dist / 260) * Math.PI) * 22;
            }
          }

          // Harmonic wave equation with secondary modulation
          const angle1 = x * wave.freq + step * wave.speed + idx * 1.5;
          const angle2 = x * (wave.freq * 1.6) - step * (wave.speed * 0.7);
          const y = baseOffset 
            + Math.sin(angle1) * wave.amp 
            + Math.cos(angle2) * (wave.amp * 0.45) 
            - mouseDistEffect;

          if (x === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Glowing gradient fill for wave
        const waveGrad = ctx.createLinearGradient(0, baseOffset - wave.amp, 0, height);
        waveGrad.addColorStop(0, wave.color1);
        waveGrad.addColorStop(0.5, wave.color2);
        waveGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = waveGrad;
        ctx.fill();

        // Sharp luminous crest line on top of each wave
        ctx.beginPath();
        for (let x = 0; x <= width; x += stepX) {
          let mouseDistEffect = 0;
          if (mouseRef.current.active) {
            const dx = x - mouseRef.current.x;
            const dy = baseOffset - mouseRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 260) {
              mouseDistEffect = Math.sin((1 - dist / 260) * Math.PI) * 22;
            }
          }

          const angle1 = x * wave.freq + step * wave.speed + idx * 1.5;
          const angle2 = x * (wave.freq * 1.6) - step * (wave.speed * 0.7);
          const y = baseOffset 
            + Math.sin(angle1) * wave.amp 
            + Math.cos(angle2) * (wave.amp * 0.45) 
            - mouseDistEffect;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = wave.color1;
        ctx.lineWidth = idx === 0 ? 1.5 : 1.0;
        ctx.stroke();
      });

      // 3. Floating Quantum Energy Particle Nodes
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0.2) p.y = 0.95;
        if (p.y > 0.95) p.y = 0.2;

        const px = p.x * width;
        const py = p.y * height;
        const pulse = (Math.sin(step * p.pulseSpeed) + 1) * 0.5;
        const alpha = p.alpha * (0.4 + 0.6 * pulse);

        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = palette.particles.replace(/[\d\.]+\)$/, `${alpha})`);
        ctx.shadowColor = palette.particles;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      // 4. Interactive Light Cursor Aureole
      if (mouseRef.current.active) {
        const mouseGlow = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          180
        );
        mouseGlow.addColorStop(0, palette.glowColor);
        mouseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = mouseGlow;
        ctx.fillRect(0, 0, width, height);
      }

      step += 1;
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
      id="futuristic-light-waves-container"
      className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none transition-opacity duration-700"
      style={{
        opacity: intensity === 'subtle' ? 0.35 : intensity === 'vibrant' ? 0.85 : 0.65
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
      {/* Subtle bottom horizon gradient to ensure content above input stays perfectly legible */}
      <div 
        className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent pointer-events-none"
      />
    </div>
  );
};
