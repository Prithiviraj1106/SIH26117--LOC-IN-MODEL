import React, { useEffect, useRef, useState } from 'react';
import { AppTheme } from '../types';

interface Tesseract4DBackgroundProps {
  theme?: AppTheme;
  intensity?: 'subtle' | 'vibrant' | 'ambient' | 'off';
  interactive?: boolean;
  brightness?: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x2d: number;
  y2d: number;
  scale: number;
  depth: number;
}

interface Star {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
  twinkleDuration: number;
  twinkleDelay: number;
  isSparkle: boolean;
}

interface ConeCrystal {
  id: number;
  baseRadius: number;
  theta: number;
  phi: number;
  orbitSpeed: number;
  floatPhase: number;
  floatSpeed: number;
  floatAmp: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  coneRadius: number;
  coneHeight: number;
  segments: number;
  colorType: 'cyan' | 'blue' | 'violet' | 'teal';
}

// Pre-generate 80 deterministic stars for the deep space backdrop SVG
const generate80Stars = (): Star[] => {
  const stars: Star[] = [];
  const colors = ['#ffffff', '#a5f3fc', '#c7d2fe', '#ddd6fe', '#99f6e4', '#fef08a'];

  // Seeded LCG pseudo-random for deterministic starry cosmos
  let seed = 42;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 80; i++) {
    const isMajor = i < 12;
    const isSparkle = isMajor && lcg() > 0.3;
    const radius = isMajor ? 1.6 + lcg() * 1.0 : 0.6 + lcg() * 1.0;
    const opacity = isMajor ? 0.75 + lcg() * 0.25 : 0.25 + lcg() * 0.55;
    const color = colors[Math.floor(lcg() * colors.length)];
    const twinkleDuration = 2.4 + lcg() * 3.5;
    const twinkleDelay = lcg() * 4.0;

    stars.push({
      id: i,
      x: lcg() * 100,
      y: lcg() * 100,
      radius,
      opacity,
      color,
      twinkleDuration,
      twinkleDelay,
      isSparkle
    });
  }
  return stars;
};

// 80 Stars dataset
const STARS_80 = generate80Stars();

// Initialize 30 floating cone-shaped crystalline gems
const generate30FloatingCrystals = (): ConeCrystal[] => {
  const crystals: ConeCrystal[] = [];
  const colorTypes: ('cyan' | 'blue' | 'violet' | 'teal')[] = ['cyan', 'blue', 'violet', 'teal'];

  let seed = 1337;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 30; i++) {
    // Fibonacci sphere distribution for spherical scattering around the tesseract
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 30);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const baseRadius = 240 + lcg() * 160;

    crystals.push({
      id: i,
      baseRadius,
      theta,
      phi,
      orbitSpeed: (lcg() - 0.5) * 0.003,
      floatPhase: lcg() * Math.PI * 2,
      floatSpeed: 0.012 + lcg() * 0.018,
      floatAmp: 12 + lcg() * 18,
      rotX: lcg() * Math.PI * 2,
      rotY: lcg() * Math.PI * 2,
      rotZ: lcg() * Math.PI * 2,
      spinX: (lcg() - 0.5) * 0.024,
      spinY: (lcg() - 0.5) * 0.024,
      spinZ: (lcg() - 0.5) * 0.024,
      coneRadius: 9 + lcg() * 7,
      coneHeight: 22 + lcg() * 14,
      segments: lcg() > 0.5 ? 6 : 5,
      colorType: colorTypes[i % colorTypes.length]
    });
  }
  return crystals;
};

// Generate 4D Hypercube (Tesseract) geometry
// 16 vertices, 32 edges, 24 translucent 2D faces
const createTesseractGeometry = (size: number) => {
  // 16 4D vertices: (±1, ±1, ±1, ±1)
  const vertices4D: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const x = (i & 1 ? 1 : -1) * size;
    const y = (i & 2 ? 1 : -1) * size;
    const z = (i & 4 ? 1 : -1) * size;
    const w = (i & 8 ? 1 : -1) * size;
    vertices4D.push([x, y, z, w]);
  }

  // 32 edges: connect vertices differing in exactly 1 bit
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) {
        edges.push([i, j]);
      }
    }
  }

  // 24 translucent faces (squares):
  // Pick 2 varying dimensions d1 < d2, and fix the other 2 dimensions
  const faces: number[][] = [];
  for (let d1 = 0; d1 < 4; d1++) {
    for (let d2 = d1 + 1; d2 < 4; d2++) {
      const fixedDims = [0, 1, 2, 3].filter((d) => d !== d1 && d !== d2);
      for (const s1 of [0, 1]) {
        for (const s2 of [0, 1]) {
          const v0 = (s1 << fixedDims[0]) | (s2 << fixedDims[1]) | (0 << d1) | (0 << d2);
          const v1 = (s1 << fixedDims[0]) | (s2 << fixedDims[1]) | (1 << d1) | (0 << d2);
          const v2 = (s1 << fixedDims[0]) | (s2 << fixedDims[1]) | (1 << d1) | (1 << d2);
          const v3 = (s1 << fixedDims[0]) | (s2 << fixedDims[1]) | (0 << d1) | (1 << d2);
          faces.push([v0, v1, v2, v3]);
        }
      }
    }
  }

  return { vertices4D, edges, faces };
};

export const Tesseract4DBackground: React.FC<Tesseract4DBackgroundProps> = ({
  intensity = 'ambient',
  interactive = true,
  brightness = 15
}) => {
  if (intensity === 'off') {
    return null;
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Inertial Mouse Drag & Rotation State
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const velRef = useRef<{ x: number; y: number }>({ x: 0.003, y: 0.001 });
  const rotXRef = useRef<number>(0.3);
  const rotYRef = useRef<number>(0.4);
  const rotZRef = useRef<number>(0.1);

  // Continuous 4D rotation angles
  const angleXWRef = useRef<number>(0);
  const angleYWRef = useRef<number>(0);
  const angleZWRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Resize Handler
    const resizeCanvas = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Geometry Instances
    const tesseract = createTesseractGeometry(125);
    const crystals = generate30FloatingCrystals();

    // Mouse / Touch Dragging Event Handlers
    const handlePointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      const target = e.target as HTMLElement;
      // Do not initiate 3D drag if clicking active input fields, buttons, or links
      if (target && target.closest && target.closest('button, input, textarea, a, select, [role="button"]')) {
        return;
      }
      isDraggingRef.current = true;
      setIsDraggingState(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
      velRef.current = { x: 0, y: 0 };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastMouseRef.current.time);
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;

      rotYRef.current += dx * 0.0055;
      rotXRef.current -= dy * 0.0055;

      // Track release velocity for smooth inertial coasting
      const instantVx = (dx / dt) * 0.16;
      const instantVy = (-dy / dt) * 0.16;
      velRef.current.x = velRef.current.x * 0.35 + instantVx * 0.65;
      velRef.current.y = velRef.current.y * 0.35 + instantVy * 0.65;

      lastMouseRef.current = { x: e.clientX, y: e.clientY, time: now };
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDraggingState(false);
        // Clamp velocity for pleasant, controlled inertial coasting
        velRef.current.x = Math.max(-0.045, Math.min(0.045, velRef.current.x));
        velRef.current.y = Math.max(-0.045, Math.min(0.045, velRef.current.y));
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    // Main 3D / 4D Render Loop
    const render = () => {
      if (!canvas || !ctx || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      // Slightly elevated to sit elegantly behind the title and prompt suggestions
      const centerY = height * 0.44;

      // 1. Inertial Coasting & Rotation Physics
      if (!isDraggingRef.current) {
        rotYRef.current += velRef.current.x + 0.0022; // Base ambient slow rotation
        rotXRef.current += velRef.current.y;
        rotZRef.current += 0.0008;

        // Smooth inertial friction decay
        velRef.current.x *= 0.962;
        velRef.current.y *= 0.962;
      }

      // 2. Continuous 4D Hypercube Rotation (XW, YW, ZW planes)
      // This causes the inner and outer cube to continuously morph and shift
      angleXWRef.current += 0.0085;
      angleYWRef.current += 0.0062;
      angleZWRef.current += 0.0048;

      const cosXW = Math.cos(angleXWRef.current);
      const sinXW = Math.sin(angleXWRef.current);
      const cosYW = Math.cos(angleYWRef.current);
      const sinYW = Math.sin(angleYWRef.current);
      const cosZW = Math.cos(angleZWRef.current);
      const sinZW = Math.sin(angleZWRef.current);

      const cosRX = Math.cos(rotXRef.current);
      const sinRX = Math.sin(rotXRef.current);
      const cosRY = Math.cos(rotYRef.current);
      const sinRY = Math.sin(rotYRef.current);
      const cosRZ = Math.cos(rotZRef.current);
      const sinRZ = Math.sin(rotZRef.current);

      // 3D rotation transform function
      const rotate3D = (p: Point3D): Point3D => {
        // Rotate Y (Yaw)
        const x1 = p.x * cosRY + p.z * sinRY;
        const y1 = p.y;
        const z1 = -p.x * sinRY + p.z * cosRY;

        // Rotate X (Pitch)
        const x2 = x1;
        const y2 = y1 * cosRX - z1 * sinRX;
        const z2 = y1 * sinRX + z1 * cosRX;

        // Rotate Z (Roll)
        const x3 = x2 * cosRZ - y2 * sinRZ;
        const y3 = x2 * sinRZ + y2 * cosRZ;
        const z3 = z2;

        return { x: x3, y: y3, z: z3 };
      };

      // 3D to 2D perspective projection
      const cameraDist3D = 480;
      const project3D = (p: Point3D, ox = centerX, oy = centerY): ProjectedPoint => {
        const perspective = cameraDist3D / (cameraDist3D + p.z);
        return {
          x2d: ox + p.x * perspective,
          y2d: oy + p.y * perspective,
          scale: perspective,
          depth: p.z
        };
      };

      // ==========================================
      // A. RENDER 30 FLOATING CRYSTALS
      // ==========================================
      // Cone-shaped gems in cyan, blue, violet, and teal tones
      // Scattered in a sphere around the tesseract, floating and spinning
      interface RenderableCrystalFacet {
        pts: ProjectedPoint[];
        avgZ: number;
        colorType: 'cyan' | 'blue' | 'violet' | 'teal';
        isBase: boolean;
        intensityMultiplier: number;
      }

      const crystalFacets: RenderableCrystalFacet[] = [];

      crystals.forEach((c) => {
        // Orbit and floating kinematics
        c.theta += c.orbitSpeed;
        c.floatPhase += c.floatSpeed;
        c.rotX += c.spinX;
        c.rotY += c.spinY;
        c.rotZ += c.spinZ;

        const floatOffset = Math.sin(c.floatPhase) * c.floatAmp;
        const currentRadius = c.baseRadius;

        // Base spherical position
        const localX = currentRadius * Math.sin(c.phi) * Math.cos(c.theta);
        const localY = currentRadius * Math.cos(c.phi) + floatOffset;
        const localZ = currentRadius * Math.sin(c.phi) * Math.sin(c.theta);

        // Cone Gem Mesh local vertices
        // Apex at top: (0, -c.coneHeight/2, 0)
        // Base vertices around circle at +c.coneHeight/2
        const apexLocal: Point3D = { x: 0, y: -c.coneHeight * 0.55, z: 0 };
        const baseCenterLocal: Point3D = { x: 0, y: c.coneHeight * 0.45, z: 0 };
        const baseVertsLocal: Point3D[] = [];

        for (let s = 0; s < c.segments; s++) {
          const ang = (s / c.segments) * Math.PI * 2;
          baseVertsLocal.push({
            x: Math.cos(ang) * c.coneRadius,
            y: c.coneHeight * 0.45,
            z: Math.sin(ang) * c.coneRadius
          });
        }

        // Rotate cone by crystal's independent spin
        const cCosX = Math.cos(c.rotX);
        const cSinX = Math.sin(c.rotX);
        const cCosY = Math.cos(c.rotY);
        const cSinY = Math.sin(c.rotY);

        const rotateCrystalPoint = (p: Point3D): Point3D => {
          // Spin Y
          const x1 = p.x * cCosY + p.z * cSinY;
          const y1 = p.y;
          const z1 = -p.x * cSinY + p.z * cCosY;
          // Spin X
          const x2 = x1;
          const y2 = y1 * cCosX - z1 * cSinX;
          const z2 = y1 * cSinX + z1 * cCosX;

          // Translate to orbital world position
          return {
            x: x2 + localX,
            y: y2 + localY,
            z: z2 + localZ
          };
        };

        const apexWorld = rotate3D(rotateCrystalPoint(apexLocal));
        const baseCenterWorld = rotate3D(rotateCrystalPoint(baseCenterLocal));
        const baseWorld = baseVertsLocal.map((p) => rotate3D(rotateCrystalPoint(p)));

        const apexProj = project3D(apexWorld);
        const baseCenterProj = project3D(baseCenterWorld);
        const baseProj = baseWorld.map((p) => project3D(p));

        // Facets: Side Triangles (Apex -> v[s] -> v[s+1])
        for (let s = 0; s < c.segments; s++) {
          const next = (s + 1) % c.segments;
          const pts = [apexProj, baseProj[s], baseProj[next]];
          const avgZ = (apexProj.depth + baseProj[s].depth + baseProj[next].depth) / 3;

          // Normal light shading based on 2D cross product sign
          const dx1 = baseProj[s].x2d - apexProj.x2d;
          const dy1 = baseProj[s].y2d - apexProj.y2d;
          const dx2 = baseProj[next].x2d - apexProj.x2d;
          const dy2 = baseProj[next].y2d - apexProj.y2d;
          const cross = dx1 * dy2 - dy1 * dx2;

          crystalFacets.push({
            pts,
            avgZ,
            colorType: c.colorType,
            isBase: false,
            intensityMultiplier: cross > 0 ? 1.3 : 0.75
          });
        }

        // Base polygon triangles (BaseCenter -> v[next] -> v[s])
        for (let s = 0; s < c.segments; s++) {
          const next = (s + 1) % c.segments;
          const pts = [baseCenterProj, baseProj[next], baseProj[s]];
          const avgZ = (baseCenterProj.depth + baseProj[s].depth + baseProj[next].depth) / 3;
          crystalFacets.push({
            pts,
            avgZ,
            colorType: c.colorType,
            isBase: true,
            intensityMultiplier: 0.6
          });
        }
      });

      // ==========================================
      // B. TESSERACT 4D PROJECTION
      // ==========================================
      // Project 16 vertices from 4D -> 3D -> 2D
      const projectedVertices: ProjectedPoint[] = [];

      for (let i = 0; i < 16; i++) {
        const v = tesseract.vertices4D[i];
        let x = v[0];
        let y = v[1];
        let z = v[2];
        let w = v[3];

        // 4D Rotation in XW Plane
        const x1 = x * cosXW - w * sinXW;
        const w1 = x * sinXW + w * cosXW;

        // 4D Rotation in YW Plane
        const y2 = y * cosYW - w1 * sinYW;
        const w2 = y * sinYW + w1 * cosYW;

        // 4D Rotation in ZW Plane
        const z3 = z * cosZW - w2 * sinZW;
        const w3 = z * sinZW + w2 * cosZW;

        // 4D to 3D Perspective Projection:
        // When w is positive, scale is larger (outer cube).
        // When w is negative, scale is smaller (inner cube).
        // As 4D angles rotate, inner cube passes through outer cube in real time.
        const dist4D = 2.4;
        const scale4D = 1 / (dist4D - (w3 / 125) * 0.58);

        const p3d: Point3D = {
          x: x1 * scale4D,
          y: y2 * scale4D,
          z: z3 * scale4D
        };

        // Apply interactive 3D rotation (mouse drag + spin)
        const rotated = rotate3D(p3d);
        projectedVertices.push(project3D(rotated));
      }

      // ==========================================
      // C. RENDER 24 TRANSLUCENT FACES
      // ==========================================
      interface RenderableTesseractFace {
        indices: number[];
        avgZ: number;
      }

      const faceRenderQueue: RenderableTesseractFace[] = tesseract.faces.map((indices) => {
        const avgZ =
          (projectedVertices[indices[0]].depth +
            projectedVertices[indices[1]].depth +
            projectedVertices[indices[2]].depth +
            projectedVertices[indices[3]].depth) /
          4;
        return { indices, avgZ };
      });

      // Painter's algorithm: sort faces from farthest to nearest
      faceRenderQueue.sort((a, b) => b.avgZ - a.avgZ);

      // Also sort crystal facets
      crystalFacets.sort((a, b) => b.avgZ - a.avgZ);

      // Draw background-depth crystals (behind tesseract center)
      const renderCrystalFacet = (facet: RenderableCrystalFacet) => {
        const pts = facet.pts;
        if (pts.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(pts[0].x2d, pts[0].y2d);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x2d, pts[k].y2d);
        }
        ctx.closePath();

        let baseColor = 'rgba(6, 182, 212,'; // cyan
        let strokeColor = 'rgba(34, 211, 238, 0.7)';
        if (facet.colorType === 'blue') {
          baseColor = 'rgba(37, 99, 235,';
          strokeColor = 'rgba(96, 165, 250, 0.7)';
        } else if (facet.colorType === 'violet') {
          baseColor = 'rgba(139, 92, 246,';
          strokeColor = 'rgba(167, 139, 250, 0.7)';
        } else if (facet.colorType === 'teal') {
          baseColor = 'rgba(13, 148, 136,';
          strokeColor = 'rgba(45, 212, 191, 0.7)';
        }

        const alpha = Math.min(0.85, Math.max(0.18, 0.45 * facet.intensityMultiplier));
        ctx.fillStyle = `${baseColor} ${alpha})`;
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };

      // Draw crystals with depth > 0 (far background)
      crystalFacets.filter((f) => f.avgZ > 0).forEach(renderCrystalFacet);

      // Draw the 24 Translucent Hypercube Faces
      faceRenderQueue.forEach(({ indices, avgZ }) => {
        const p0 = projectedVertices[indices[0]];
        const p1 = projectedVertices[indices[1]];
        const p2 = projectedVertices[indices[2]];
        const p3 = projectedVertices[indices[3]];

        ctx.beginPath();
        ctx.moveTo(p0.x2d, p0.y2d);
        ctx.lineTo(p1.x2d, p1.y2d);
        ctx.lineTo(p2.x2d, p2.y2d);
        ctx.lineTo(p3.x2d, p3.y2d);
        ctx.closePath();

        // Dynamic holographic gradient across the face
        const faceGrad = ctx.createLinearGradient(p0.x2d, p0.y2d, p2.x2d, p2.y2d);
        // Deeper faces slightly darker, closer faces more luminous
        const depthFactor = Math.max(0.4, Math.min(1.2, 1 - avgZ / 500));
        faceGrad.addColorStop(0, `rgba(6, 182, 212, ${0.08 * depthFactor})`); // Cyan
        faceGrad.addColorStop(0.5, `rgba(139, 92, 246, ${0.12 * depthFactor})`); // Violet
        faceGrad.addColorStop(1, `rgba(59, 130, 246, ${0.07 * depthFactor})`); // Blue

        ctx.fillStyle = faceGrad;
        ctx.fill();

        // Subtle translucent boundary
        ctx.strokeStyle = `rgba(165, 243, 252, ${0.15 * depthFactor})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });

      // ==========================================
      // D. RENDER ALL 32 TESSERACT EDGES
      // ==========================================
      // All 32 edges rendered as luminous lines with glowing cyan/violet/blue gradients
      tesseract.edges.forEach(([i, j]) => {
        const p1 = projectedVertices[i];
        const p2 = projectedVertices[j];

        const edgeGrad = ctx.createLinearGradient(p1.x2d, p1.y2d, p2.x2d, p2.y2d);
        const avgZ = (p1.depth + p2.depth) * 0.5;
        const edgeAlpha = Math.max(0.35, Math.min(0.95, 1 - avgZ / 450));

        // Luminous cybernetic gradient: Cyan to Violet
        edgeGrad.addColorStop(0, `rgba(34, 211, 238, ${edgeAlpha})`);
        edgeGrad.addColorStop(0.5, `rgba(167, 139, 250, ${edgeAlpha * 0.9})`);
        edgeGrad.addColorStop(1, `rgba(96, 165, 250, ${edgeAlpha})`);

        ctx.beginPath();
        ctx.moveTo(p1.x2d, p1.y2d);
        ctx.lineTo(p2.x2d, p2.y2d);

        // Core line
        ctx.strokeStyle = edgeGrad;
        ctx.lineWidth = Math.max(1.2, Math.min(2.8, 1.8 * ((p1.scale + p2.scale) * 0.5)));
        ctx.stroke();
      });

      // ==========================================
      // E. RENDER 16 GLOWING VERTEX SPHERES
      // ==========================================
      // 16 vertices drawn as glowing spheres with 3D highlight and halo bloom
      // Sort vertices from back to front
      const sortedVertices = [...projectedVertices].sort((a, b) => b.depth - a.depth);

      sortedVertices.forEach((pv) => {
        const radius = Math.max(3.5, Math.min(8.5, 5.5 * pv.scale));

        // 1. Soft Outer Bloom Halo
        const haloGrad = ctx.createRadialGradient(pv.x2d, pv.y2d, 0, pv.x2d, pv.y2d, radius * 3.5);
        haloGrad.addColorStop(0, 'rgba(6, 182, 212, 0.65)');
        haloGrad.addColorStop(0.4, 'rgba(139, 92, 246, 0.35)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(pv.x2d, pv.y2d, radius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // 2. 3D Glowing Sphere Core with Specular Hotspot
        const sphereGrad = ctx.createRadialGradient(
          pv.x2d - radius * 0.35,
          pv.y2d - radius * 0.35,
          radius * 0.1,
          pv.x2d,
          pv.y2d,
          radius
        );
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.3, '#67e8f9'); // Bright cyan
        sphereGrad.addColorStop(0.7, '#3b82f6'); // Electric blue
        sphereGrad.addColorStop(1, '#6366f1'); // Indigo

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(pv.x2d, pv.y2d, radius, 0, Math.PI * 2);
        ctx.fill();

        // Crisp white specular glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(pv.x2d - radius * 0.3, pv.y2d - radius * 0.3, radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw foreground crystals (in front of tesseract center)
      crystalFacets.filter((f) => f.avgZ <= 0).forEach(renderCrystalFacet);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [intensity, interactive]);

  const normalizedBrightness = brightness !== undefined ? (brightness > 1 ? brightness / 100 : brightness) : 0.15;

  return (
    <div
      ref={containerRef}
      id="tesseract-4d-interactive-background"
      className={`absolute inset-0 overflow-hidden z-0 select-none transition-all duration-500 ${
        isDraggingState ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        // Deep space dark radial gradient backdrop
        background:
          'radial-gradient(ellipse at 50% 42%, #0b1128 0%, #060a19 42%, #02040d 82%, #010207 100%)',
        opacity: intensity === 'subtle' ? 0.6 : intensity === 'vibrant' ? 1.0 : 0.88,
        filter: `brightness(${normalizedBrightness})`
      }}
      aria-hidden="true"
    >
      {/* Deep Space Atmosphere Radial Glow Orbs in Violet & Cyan */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none -top-20 -left-20"
        style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)' }}
      />
      <div
        className="absolute w-[650px] h-[650px] rounded-full blur-[150px] pointer-events-none top-1/3 -right-20"
        style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, transparent 70%)' }}
      />

      {/* 80-Star SVG Field Behind Everything */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="star-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {STARS_80.map((s) => (
          <g
            key={s.id}
            style={{
              animation: `twinkleStar ${s.twinkleDuration}s ease-in-out ${s.twinkleDelay}s infinite alternate`
            }}
          >
            {s.isSparkle ? (
              // 4-Point Sparkling Star Shape for Major Celestial Beacons
              <path
                d={`M ${s.x}% ${s.y}% m 0 -${s.radius * 2.8} L ${s.x + 0.3}% ${s.y}% L ${s.x}% ${s.y + s.radius * 2.8}% L ${s.x - 0.3}% ${s.y}% Z`}
                fill={s.color}
                opacity={s.opacity}
                filter="url(#star-glow)"
              />
            ) : (
              // Crisp circular star
              <circle
                cx={`${s.x}%`}
                cy={`${s.y}%`}
                r={s.radius}
                fill={s.color}
                opacity={s.opacity}
                filter={s.radius > 1.4 ? 'url(#star-glow)' : undefined}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Embedded CSS for Star Twinkle Animation */}
      <style>{`
        @keyframes twinkleStar {
          0% {
            opacity: 0.3;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
          100% {
            opacity: 0.45;
            transform: scale(0.9);
          }
        }
      `}</style>

      {/* Interactive 3D Canvas rendering Tesseract, 32 Edges, 24 Faces, 16 Spheres & 30 Crystals */}
      <canvas ref={canvasRef} className="w-full h-full block relative z-10" />

      {/* Subtle bottom horizon gradient ensuring chat input & controls remain pristine */}
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#02040a] via-[#02040a]/70 to-transparent pointer-events-none z-20" />
    </div>
  );
};
