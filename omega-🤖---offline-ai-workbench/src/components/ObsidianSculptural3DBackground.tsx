import React, { useEffect, useRef } from 'react';
import { AppTheme } from '../types';

interface ObsidianSculptural3DBackgroundProps {
  theme?: AppTheme;
  intensity?: 'subtle' | 'vibrant' | 'ambient' | 'off';
  interactive?: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Face3D {
  indices: number[];
  normal: Point3D;
  centerZ: number;
}

interface FloatingShard {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  scale: number;
  driftX: number;
  driftY: number;
  driftZ: number;
  points: Point3D[];
  faces: number[][];
}

export const ObsidianSculptural3DBackground: React.FC<ObsidianSculptural3DBackgroundProps> = ({
  theme = 'obsidian',
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
    normX: number;
    normY: number;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false,
    normX: 0,
    normY: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Resize handling with high DPR
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

    // Mouse tracking
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
      mouseRef.current.normX = (clientX - halfW) / halfW;
      mouseRef.current.normY = (clientY - halfH) / halfH;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
      mouseRef.current.normX = 0;
      mouseRef.current.normY = 0;
    };

    if (interactive && containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    // Generate Main Sculptural Obsidian Form: Toroidal Möbius Sculpture
    const ringSegments = 28;
    const pipeSegments = 16;
    const majorRadius = 220;
    const minorRadius = 75;

    const baseSculptureVertices: Point3D[] = [];
    const baseSculptureFaces: number[][] = [];

    for (let i = 0; i < ringSegments; i++) {
      const u = (i / ringSegments) * Math.PI * 2;
      for (let j = 0; j < pipeSegments; j++) {
        const v = (j / pipeSegments) * Math.PI * 2;

        // Undulating sculpted variation
        const sculptMod = Math.sin(u * 3) * 24 + Math.cos(v * 2) * 16;
        const currentMinor = minorRadius + sculptMod;

        const x = (majorRadius + currentMinor * Math.cos(v)) * Math.cos(u);
        const y = (majorRadius + currentMinor * Math.cos(v)) * Math.sin(u) * 0.65; // flattened ellipse
        const z = currentMinor * Math.sin(v) + Math.sin(u * 2) * 45;

        baseSculptureVertices.push({ x, y, z });

        // Generate quad face (split into 2 triangles)
        const nextI = (i + 1) % ringSegments;
        const nextJ = (j + 1) % pipeSegments;

        const idx0 = i * pipeSegments + j;
        const idx1 = nextI * pipeSegments + j;
        const idx2 = nextI * pipeSegments + nextJ;
        const idx3 = i * pipeSegments + nextJ;

        baseSculptureFaces.push([idx0, idx1, idx2]);
        baseSculptureFaces.push([idx0, idx2, idx3]);
      }
    }

    // Generate Floating Obsidian Faceted Shards drifting in background
    const shardCount = 8;
    const shards: FloatingShard[] = [];

    // Helper: create irregular crystalline polyhedra
    const createFacetedShardMesh = (radius: number): { points: Point3D[]; faces: number[][] } => {
      const pts: Point3D[] = [
        { x: 0, y: radius * 1.5, z: 0 }, // top tip
        { x: 0, y: -radius * 1.4, z: 0 }, // bottom tip
        { x: radius * 0.9, y: 0, z: radius * 0.5 },
        { x: -radius * 0.8, y: 0, z: radius * 0.6 },
        { x: -radius * 0.7, y: 0, z: -radius * 0.7 },
        { x: radius * 0.8, y: 0, z: -radius * 0.6 }
      ];
      // Jitter vertices for natural chiseled obsidian fracture
      pts.forEach(p => {
        p.x += (Math.random() - 0.5) * radius * 0.3;
        p.y += (Math.random() - 0.5) * radius * 0.3;
        p.z += (Math.random() - 0.5) * radius * 0.3;
      });

      const fcs = [
        [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 2],
        [1, 3, 2], [1, 4, 3], [1, 5, 4], [1, 2, 5]
      ];
      return { points: pts, faces: fcs };
    };

    for (let s = 0; s < shardCount; s++) {
      const mesh = createFacetedShardMesh(28 + Math.random() * 22);
      const angle = (s / shardCount) * Math.PI * 2;
      const dist = 320 + Math.random() * 220;

      shards.push({
        x: Math.cos(angle) * dist,
        y: (Math.sin(angle) * dist * 0.5) + (Math.random() - 0.5) * 150,
        z: (Math.random() - 0.5) * 350,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        vRotX: (Math.random() - 0.5) * 0.008,
        vRotY: (Math.random() - 0.5) * 0.009,
        vRotZ: (Math.random() - 0.5) * 0.007,
        scale: Math.random() * 0.6 + 0.7,
        driftX: (Math.random() - 0.5) * 0.25,
        driftY: (Math.random() - 0.5) * 0.2,
        driftZ: (Math.random() - 0.5) * 0.25,
        points: mesh.points,
        faces: mesh.faces
      });
    }

    // Violet light sparkles / ambient dust
    const sparkleCount = 28;
    const sparkles = Array.from({ length: sparkleCount }, () => ({
      x: (Math.random() - 0.5) * 900,
      y: (Math.random() - 0.5) * 650,
      z: (Math.random() - 0.5) * 500,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.25,
      vz: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2.2 + 0.8,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.03 + 0.01
    }));

    // Animation rotation variables
    let time = 0;
    let currTiltX = 0;
    let currTiltY = 0;

    const opacityFactor = intensity === 'subtle' ? 0.45 : intensity === 'vibrant' ? 1.0 : 0.75;

    // Vector Math Helpers
    const crossProduct = (a: Point3D, b: Point3D): Point3D => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    });

    const normalize = (v: Point3D): Point3D => {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    };

    const dotProduct = (a: Point3D, b: Point3D): number => {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    };

    // Render loop
    const render = () => {
      if (!canvas || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      time += 0.007;

      // Smooth mouse follow
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;
      currTiltX += (mouseRef.current.normY * 0.45 - currTiltX) * 0.04;
      currTiltY += (mouseRef.current.normX * 0.55 - currTiltY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.52;

      // 1. Deep Obsidian Atmosphere with Radial Violet Glow
      // Electric violet highlight center
      const lightX = centerX + mouseRef.current.normX * 180;
      const lightY = centerY - 60 + mouseRef.current.normY * 120;
      const bgGlowRadius = Math.max(width, height) * 0.65;

      const violetAtmosphere = ctx.createRadialGradient(
        lightX,
        lightY,
        15,
        centerX,
        centerY,
        bgGlowRadius
      );
      // Obsidian deep violet aura
      violetAtmosphere.addColorStop(0, 'rgba(139, 92, 246, 0.22)');
      violetAtmosphere.addColorStop(0.35, 'rgba(91, 33, 182, 0.12)');
      violetAtmosphere.addColorStop(0.65, 'rgba(15, 10, 26, 0.08)');
      violetAtmosphere.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = violetAtmosphere;
      ctx.fillRect(0, 0, width, height);

      // Camera & 3D Lighting setup
      const focalLength = 540;
      const cameraZ = 650;

      // Dynamic Violet Light Vector (following mouse cursor in 3D space)
      const lightDir = normalize({
        x: -0.4 + mouseRef.current.normX * 0.5,
        y: -0.7 + mouseRef.current.normY * 0.4,
        z: 0.7
      });

      // View direction (camera towards object)
      const viewDir: Point3D = { x: 0, y: 0, z: 1 };

      // Rotation matrix for main sculpture
      const rotX = 0.35 + currTiltX + Math.sin(time * 0.5) * 0.12;
      const rotY = time * 0.6 + currTiltY;
      const rotZ = Math.cos(time * 0.3) * 0.15;

      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

      // Transform point helper
      const transformPoint = (p: Point3D, cx = 0, cy = 0, cz = 0): Point3D => {
        // Rotate Z
        let x1 = p.x * cosZ - p.y * sinZ;
        let y1 = p.x * sinZ + p.y * cosZ;
        let z1 = p.z;

        // Rotate Y
        let x2 = x1 * cosY + z1 * sinY;
        let y2 = y1;
        let z2 = -x1 * sinY + z1 * cosY;

        // Rotate X
        let x3 = x2;
        let y3 = y2 * cosX - z2 * sinX;
        let z3 = y2 * sinX + z2 * cosX;

        return {
          x: x3 + cx,
          y: y3 + cy,
          z: z3 + cz
        };
      };

      // Project point helper
      const projectPoint = (p: Point3D): { x2d: number; y2d: number; scale: number; valid: boolean } => {
        const distZ = cameraZ + p.z;
        if (distZ <= 30) return { x2d: 0, y2d: 0, scale: 0, valid: false };
        const scale = focalLength / distZ;
        return {
          x2d: centerX + p.x * scale,
          y2d: centerY + p.y * scale,
          scale,
          valid: true
        };
      };

      // 2. Render Floating Obsidian Crystalline Shards in Background
      shards.forEach((shard) => {
        // Update drift & rotation
        shard.rotX += shard.vRotX;
        shard.rotY += shard.vRotY;
        shard.rotZ += shard.vRotZ;
        shard.x += shard.driftX;
        shard.y += shard.driftY;
        shard.z += shard.driftZ;

        // Boundary bounce
        if (Math.abs(shard.x) > 480) shard.driftX *= -1;
        if (Math.abs(shard.y) > 320) shard.driftY *= -1;
        if (Math.abs(shard.z) > 300) shard.driftZ *= -1;

        const sCosX = Math.cos(shard.rotX), sSinX = Math.sin(shard.rotX);
        const sCosY = Math.cos(shard.rotY), sSinY = Math.sin(shard.rotY);
        const sCosZ = Math.cos(shard.rotZ), sSinZ = Math.sin(shard.rotZ);

        const transformedShardPts = shard.points.map((pt) => {
          const px = pt.x * shard.scale;
          const py = pt.y * shard.scale;
          const pz = pt.z * shard.scale;

          const x1 = px * sCosZ - py * sSinZ;
          const y1 = px * sSinZ + py * sCosZ;
          const z1 = pz;

          const x2 = x1 * sCosY + z1 * sSinY;
          const y2 = y1;
          const z2 = -x1 * sSinY + z1 * sCosY;

          const x3 = x2;
          const y3 = y2 * sCosX - z2 * sSinX;
          const z3 = y2 * sSinX + z2 * sCosX;

          return {
            x: x3 + shard.x,
            y: y3 + shard.y,
            z: z3 + shard.z
          };
        });

        const projShardPts = transformedShardPts.map(projectPoint);

        // Render shard faces
        shard.faces.forEach((faceIndices) => {
          const p0 = transformedShardPts[faceIndices[0]];
          const p1 = transformedShardPts[faceIndices[1]];
          const p2 = transformedShardPts[faceIndices[2]];

          const vA = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
          const vB = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
          const norm = normalize(crossProduct(vA, vB));

          // Backface culling
          if (norm.z < 0) return;

          const pr0 = projShardPts[faceIndices[0]];
          const pr1 = projShardPts[faceIndices[1]];
          const pr2 = projShardPts[faceIndices[2]];
          if (!pr0.valid || !pr1.valid || !pr2.valid) return;

          // Shading: Obsidian Black base + Violet Specular Edge
          const diff = Math.max(0, dotProduct(norm, lightDir));
          // Specular reflection: R = 2(N.L)N - L
          const nDotL = dotProduct(norm, lightDir);
          const refVec: Point3D = {
            x: 2 * nDotL * norm.x - lightDir.x,
            y: 2 * nDotL * norm.y - lightDir.y,
            z: 2 * nDotL * norm.z - lightDir.z
          };
          const spec = Math.pow(Math.max(0, dotProduct(refVec, viewDir)), 14);

          // Fresnel contour
          const fresnel = Math.pow(1 - Math.max(0, norm.z), 2.2);

          // Obsidian Gloss: deep black with violet specular gleams
          const r = Math.min(255, Math.floor(12 + diff * 22 + spec * 170 + fresnel * 120));
          const g = Math.min(255, Math.floor(10 + diff * 12 + spec * 110 + fresnel * 70));
          const b = Math.min(255, Math.floor(22 + diff * 45 + spec * 255 + fresnel * 220));
          const a = (0.35 + spec * 0.5 + fresnel * 0.35) * opacityFactor * 0.7;

          ctx.beginPath();
          ctx.moveTo(pr0.x2d, pr0.y2d);
          ctx.lineTo(pr1.x2d, pr1.y2d);
          ctx.lineTo(pr2.x2d, pr2.y2d);
          ctx.closePath();

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
          ctx.fill();

          // Violet crystal edge line
          ctx.strokeStyle = `rgba(192, 132, 252, ${(0.15 + fresnel * 0.45) * opacityFactor})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
      });

      // 3. Render Main Sculptural Obsidian Form
      // Precompute 3D transformed vertices
      const transformedVertices = baseSculptureVertices.map(p => transformPoint(p, 0, 0, 0));
      const projectedVertices = transformedVertices.map(projectPoint);

      // Compute faces with normals and depth for painter's sort
      const facesToDraw: {
        indices: number[];
        centerZ: number;
        normal: Point3D;
        diff: number;
        spec: number;
        fresnel: number;
      }[] = [];

      for (let f = 0; f < baseSculptureFaces.length; f++) {
        const face = baseSculptureFaces[f];
        const p0 = transformedVertices[face[0]];
        const p1 = transformedVertices[face[1]];
        const p2 = transformedVertices[face[2]];

        const vA = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
        const vB = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
        const norm = normalize(crossProduct(vA, vB));

        // Backface culling
        if (norm.z < -0.05) continue;

        const centerZ = (p0.z + p1.z + p2.z) / 3;

        // Lighting calculation
        const diff = Math.max(0, dotProduct(norm, lightDir));

        // Specular highlight: R = 2(N.L)N - L
        const nDotL = dotProduct(norm, lightDir);
        const refVec: Point3D = {
          x: 2 * nDotL * norm.x - lightDir.x,
          y: 2 * nDotL * norm.y - lightDir.y,
          z: 2 * nDotL * norm.z - lightDir.z
        };
        const spec = Math.pow(Math.max(0, dotProduct(refVec, viewDir)), 22);

        // Glossy Fresnel rim highlight in rich violet
        const fresnel = Math.pow(1 - Math.max(0, norm.z), 2.5);

        facesToDraw.push({
          indices: face,
          centerZ,
          normal: norm,
          diff,
          spec,
          fresnel
        });
      }

      // Painter's algorithm: sort faces from back to front (lowest Z to highest Z)
      facesToDraw.sort((a, b) => a.centerZ - b.centerZ);

      // Draw glossy obsidian faces
      for (let i = 0; i < facesToDraw.length; i++) {
        const item = facesToDraw[i];
        const pr0 = projectedVertices[item.indices[0]];
        const pr1 = projectedVertices[item.indices[1]];
        const pr2 = projectedVertices[item.indices[2]];

        if (!pr0.valid || !pr1.valid || !pr2.valid) continue;

        // Obsidian Gloss Shading Formulation:
        // Deep obsidian core: #0d0a14
        // Violet diffuse: #4c1d95 / #6d28d9
        // Specular gleam: intense violet-white #e9d5ff / #c084fc
        // Fresnel rim: electric violet #a855f7
        const diffViolet = item.diff * 0.45;
        const specGlow = item.spec;
        const rimViolet = item.fresnel * 0.65;

        const red = Math.min(255, Math.floor(10 + diffViolet * 60 + specGlow * 200 + rimViolet * 168));
        const green = Math.min(255, Math.floor(8 + diffViolet * 25 + specGlow * 160 + rimViolet * 85));
        const blue = Math.min(255, Math.floor(18 + diffViolet * 140 + specGlow * 255 + rimViolet * 247));
        const alpha = Math.min(0.96, (0.45 + item.diff * 0.25 + specGlow * 0.5 + rimViolet * 0.3) * opacityFactor);

        ctx.beginPath();
        ctx.moveTo(pr0.x2d, pr0.y2d);
        ctx.lineTo(pr1.x2d, pr1.y2d);
        ctx.lineTo(pr2.x2d, pr2.y2d);
        ctx.closePath();

        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        ctx.fill();

        // Subtle specular contour wire sheen on high-grazing angles
        if (item.fresnel > 0.4 || item.spec > 0.35) {
          const strokeAlpha = (item.fresnel * 0.5 + item.spec * 0.5) * opacityFactor * 0.85;
          ctx.strokeStyle = `rgba(192, 132, 252, ${strokeAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }

      // 4. Luminous Violet Sparks & Photon Dust in 3D Depth
      sparkles.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.z += s.vz;
        s.pulse += s.pulseSpeed;

        if (Math.abs(s.x) > 500) s.vx *= -1;
        if (Math.abs(s.y) > 400) s.vy *= -1;
        if (Math.abs(s.z) > 400) s.vz *= -1;

        const pr = projectPoint(s);
        if (!pr.valid) return;

        const pulseVal = (Math.sin(s.pulse) + 1) * 0.5;
        const rad = s.size * pr.scale * (0.8 + pulseVal * 0.4);
        const alpha = (0.25 + pulseVal * 0.65) * opacityFactor;

        ctx.beginPath();
        ctx.arc(pr.x2d, pr.y2d, rad, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(216, 180, 254, ${alpha})`;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.7)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

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
      id="obsidian-sculptural-3d-background-container"
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
      {/* Subtle bottom horizon gradient ensuring chat input & controls remain pristine */}
      <div 
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"
      />
    </div>
  );
};
