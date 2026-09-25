import React, { useEffect, useRef } from 'react';
import { AppTheme } from '../types';

interface NeuralMesh3DBackgroundProps {
  theme?: AppTheme;
  intensity?: 'subtle' | 'vibrant' | 'ambient' | 'off';
  interactive?: boolean;
}

interface Node3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseRadius: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface SynapticPulse {
  fromIdx: number;
  toIdx: number;
  progress: number; // 0 to 1
  speed: number;
  intensity: number;
}

export const NeuralMesh3DBackground: React.FC<NeuralMesh3DBackgroundProps> = ({
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Responsive Canvas Resize
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

    // Initialize 3D Neural Nodes in a spherical volume
    const nodeCount = 58;
    const volumeRadius = 380;
    const nodes: Node3D[] = [];

    for (let i = 0; i < nodeCount; i++) {
      // Uniform spherical random distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = Math.cbrt(Math.random()) * volumeRadius;

      nodes.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta) * 0.75, // slight vertical compression for wide screens
        z: r * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.24,
        vz: (Math.random() - 0.5) * 0.28,
        baseRadius: Math.random() * 1.5 + 1.2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.008
      });
    }

    // Synaptic Pulses traveling along neural connections
    const pulses: SynapticPulse[] = [];
    const maxPulses = 12;

    // Mouse Tracking for subtle 3D tilt
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mouseRef.current.targetX = clientX;
      mouseRef.current.targetY = clientY;
      mouseRef.current.active = true;

      const centerX = rect.width * 0.5;
      const centerY = rect.height * 0.5;
      mouseRef.current.tiltY = ((clientX - centerX) / centerX) * 0.45;
      mouseRef.current.tiltX = -((clientY - centerY) / centerY) * 0.35;
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

    // 3D Rotation State
    let angleY = 0;
    let angleX = 0.15; // default gentle pitch
    let currentTiltX = 0;
    let currentTiltY = 0;

    // Subtle Grey Color Palette (Pure sophisticated technical grey & silver tones)
    const opacityMult = intensity === 'subtle' ? 0.55 : intensity === 'vibrant' ? 1.25 : 0.85;

    const render = () => {
      if (!canvas || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      ctx.clearRect(0, 0, width, height);

      // 1. Very Subtle Grey Lighting Vignette in Background
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const maxDim = Math.max(width, height);

      const subtleLighting = ctx.createRadialGradient(
        centerX,
        centerY * 0.95,
        10,
        centerX,
        centerY,
        maxDim * 0.75
      );
      // Delicate luminous charcoal-slate grey center fading to deep obsidian
      subtleLighting.addColorStop(0, 'rgba(30, 41, 59, 0.22)');
      subtleLighting.addColorStop(0.35, 'rgba(15, 23, 42, 0.12)');
      subtleLighting.addColorStop(0.7, 'rgba(9, 13, 22, 0.04)');
      subtleLighting.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = subtleLighting;
      ctx.fillRect(0, 0, width, height);

      // Smoothly interpolate mouse tilt for fluid 3D parallax
      currentTiltX += (mouseRef.current.tiltX - currentTiltX) * 0.04;
      currentTiltY += (mouseRef.current.tiltY - currentTiltY) * 0.04;

      angleY += 0.0014; // continuous gentle 3D orbit
      const rotY = angleY + currentTiltY;
      const rotX = angleX + currentTiltX;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Perspective Projection Setup
      const focalLength = 520;
      const cameraZ = 580;

      // Update and project 3D nodes
      interface ProjectedNode {
        idx: number;
        x2d: number;
        y2d: number;
        zRot: number;
        scale: number;
        alpha: number;
        orig: Node3D;
      }

      const projected: ProjectedNode[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Drift node position
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;

        // Smooth boundary reflection
        const bound = volumeRadius;
        if (node.x < -bound || node.x > bound) node.vx *= -1;
        if (node.y < -bound * 0.8 || node.y > bound * 0.8) node.vy *= -1;
        if (node.z < -bound || node.z > bound) node.vz *= -1;

        // 3D Rotation Matrix: Rotate Y then Rotate X
        // 1. Around Y
        const x1 = node.x * cosY + node.z * sinY;
        const z1 = -node.x * sinY + node.z * cosY;
        // 2. Around X
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        // Perspective divide
        const distZ = cameraZ + z2;
        if (distZ <= 30) continue; // behind near plane

        const scale = focalLength / distZ;
        const x2d = centerX + x1 * scale;
        const y2d = centerY + y2 * scale;

        // Depth alpha: closer nodes are brighter, distant nodes fade softly into grey
        const depthNorm = Math.max(0.15, Math.min(1.0, (z2 + volumeRadius) / (volumeRadius * 2)));
        const alpha = (0.2 + depthNorm * 0.7) * opacityMult;

        projected.push({
          idx: i,
          x2d,
          y2d,
          zRot: z2,
          scale,
          alpha,
          orig: node
        });
      }

      // 2. Render 3D Neural Interconnect Mesh Lines
      const connectionDist3D = 145;
      const validConnections: { i: number; j: number; p1: ProjectedNode; p2: ProjectedNode; dist3D: number }[] = [];

      ctx.save();
      ctx.lineWidth = 0.85;

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];

          // Check 3D distance between original node coordinates
          const dx = p1.orig.x - p2.orig.x;
          const dy = p1.orig.y - p2.orig.y;
          const dz = p1.orig.z - p2.orig.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist3D < connectionDist3D) {
            validConnections.push({ i, j, p1, p2, dist3D });

            // Distance fade factor
            const distFade = 1 - dist3D / connectionDist3D;
            const lineAlpha = distFade * Math.min(p1.alpha, p2.alpha) * 0.38;

            // Subtle Grey / Slate Wireframe Line
            ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x2d, p1.y2d);
            ctx.lineTo(p2.x2d, p2.y2d);
            ctx.stroke();
          }
        }
      }

      // 3. Synaptic Pulses (Action Potentials sliding along mesh connections)
      if (validConnections.length > 0 && Math.random() < 0.04 && pulses.length < maxPulses) {
        const conn = validConnections[Math.floor(Math.random() * validConnections.length)];
        pulses.push({
          fromIdx: conn.i,
          toIdx: conn.j,
          progress: 0,
          speed: Math.random() * 0.015 + 0.008,
          intensity: Math.random() * 0.4 + 0.6
        });
      }

      for (let k = pulses.length - 1; k >= 0; k--) {
        const pulse = pulses[k];
        pulse.progress += pulse.speed;

        if (pulse.progress >= 1) {
          pulses.splice(k, 1);
          continue;
        }

        const p1 = projected[pulse.fromIdx];
        const p2 = projected[pulse.toIdx];
        if (!p1 || !p2) continue;

        const pulseX = p1.x2d + (p2.x2d - p1.x2d) * pulse.progress;
        const pulseY = p1.y2d + (p2.y2d - p1.y2d) * pulse.progress;
        const avgScale = (p1.scale + p2.scale) * 0.5;
        const pulseRadius = 1.4 * avgScale;
        const pulseAlpha = Math.sin(pulse.progress * Math.PI) * pulse.intensity * Math.min(p1.alpha, p2.alpha);

        ctx.beginPath();
        ctx.arc(pulseX, pulseY, pulseRadius, 0, Math.PI * 2);
        // Pure luminous silver-grey pulse
        ctx.fillStyle = `rgba(226, 232, 240, ${pulseAlpha})`;
        ctx.shadowColor = 'rgba(203, 213, 225, 0.45)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Render Neural Mesh Nodes (Junction Vertices)
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        p.orig.pulsePhase += p.orig.pulseSpeed;
        const pulseMod = (Math.sin(p.orig.pulsePhase) + 1) * 0.15;
        const r = (p.orig.baseRadius + pulseMod) * p.scale;

        // Subtle outer halo for high-depth nodes
        if (p.alpha > 0.4) {
          ctx.beginPath();
          ctx.arc(p.x2d, p.y2d, r * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha * 0.08})`;
          ctx.fill();
        }

        // Core Node
        ctx.beginPath();
        ctx.arc(p.x2d, p.y2d, r, 0, Math.PI * 2);
        // Slate grey & silver core
        ctx.fillStyle = `rgba(203, 213, 225, ${p.alpha * 0.75})`;
        ctx.shadowColor = 'rgba(148, 163, 184, 0.3)';
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

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
      id="neural-mesh-3d-background-container"
      className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none transition-opacity duration-700"
      style={{
        opacity: intensity === 'subtle' ? 0.45 : intensity === 'vibrant' ? 0.95 : 0.75
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
      {/* Subtle bottom vignette to ensure chat input bar maintains contrast */}
      <div 
        className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent pointer-events-none"
      />
    </div>
  );
};
