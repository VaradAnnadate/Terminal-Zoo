import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

// Dynamic model file finder
function findModelFile(animalId) {
  const modelsDir = path.join(process.cwd(), 'models');
  if (!fs.existsSync(modelsDir)) return null;

  const files = fs.readdirSync(modelsDir);
  const target = animalId.toLowerCase();
  const matchedFile = files.find(file => {
    const lower = file.toLowerCase();
    return lower.endsWith('.obj') && lower.includes(target);
  });

  return matchedFile ? path.join(modelsDir, matchedFile) : null;
}

// 1. OBJ Parser with Face Triangulation
function parseOBJ(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const vertices = [];
  const faces = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const type = parts[0];

    if (type === 'v') {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        vertices.push([x, y, z]);
      }
    } else if (type === 'f') {
      // Extract 0-based vertex indices (handles v, v/vt, and v/vt/vn)
      const indices = parts.slice(1).map(part => {
        return parseInt(part.split('/')[0], 10) - 1;
      });

      // Triangle fan decomposition for polygons with >= 3 vertices
      for (let i = 1; i < indices.length - 1; i++) {
        faces.push([indices[0], indices[i], indices[i + 1]]);
      }
    }
  }

  normalizeModel(vertices);
  return { vertices, faces };
}

// Rescale vertices into [-1.0, 1.0] and center the model
function normalizeModel(vertices) {
  if (vertices.length === 0) return;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const [x, y, z] of vertices) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const maxExtent = Math.max((maxX - minX), (maxY - minY), (maxZ - minZ)) / 2;

  if (maxExtent > 0) {
    for (let i = 0; i < vertices.length; i++) {
      vertices[i][0] = (vertices[i][0] - cx) / maxExtent;
      vertices[i][1] = (vertices[i][1] - cy) / maxExtent;
      vertices[i][2] = (vertices[i][2] - cz) / maxExtent;
    }
  }
}

// Luminance characters ramp (low to high brightness)
const SHADE_CHARS = ' .:-=+*#%@';

// 2. Filled 3D Rasterizer with Z-Buffer & Lighting
export async function renderHologram(animalId, animalName, animalColor) {
  const filePath = findModelFile(animalId);

  if (!filePath) {
    console.log(chalk.red(`\n  ✖ Error: No .obj file containing "${animalId}" found in models/!`));
    console.log(chalk.yellow(`\n  Press [Enter] to return...`));
    await waitForEnter();
    return;
  }

  const model = parseOBJ(filePath);
  if (!model || model.vertices.length === 0) {
    console.log(chalk.red(`\n  ✖ Error: Model file is empty or contains no vertices!`));
    console.log(chalk.yellow(`\n  Press [Enter] to return...`));
    await waitForEnter();
    return;
  }

  // Viewport setup
  const width = 74;
  const height = 30;
  let angleY = 0;
  const angleX = 0.25; // 0.25 radian tilt along X

  // Directional Light Vector (pointing from top-front-right), normalized
  const lightDir = [0.4, 0.7, 0.6];
  const lightLen = Math.hypot(...lightDir);
  const light = [lightDir[0] / lightLen, lightDir[1] / lightLen, lightDir[2] / lightLen];

  console.clear();
  hideCursor();

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      // Color & Depth Buffers
      const charBuffer = Array.from({ length: height }, () => Array(width).fill(' '));
      const intensityBuffer = Array.from({ length: height }, () => Array(width).fill(0));
      const zBuffer = Array.from({ length: height }, () => Array(width).fill(Infinity));

      const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

      // Rotate all 3D vertices
      const rotated = model.vertices.map(([x, y, z]) => {
        // Y-axis rotation
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        // X-axis tilt (0.25 rad)
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return [x1, y2, z2];
      });

      // Project vertices to screen coordinates
      const projected = rotated.map(([x, y, z]) => {
        const distance = 3.4;
        const fov = 38 / (z + distance);

        // Aspect ratio correction (terminal chars are ~2x taller than wide)
        const screenX = Math.floor(width / 2 + x * fov * 2.0);
        const screenY = Math.floor(height / 2 - y * fov);

        return { x: screenX, y: screenY, z };
      });

      // Rasterize each triangle face
      for (const [i0, i1, i2] of model.faces) {
        const r0 = rotated[i0], r1 = rotated[i1], r2 = rotated[i2];
        if (!r0 || !r1 || !r2) continue;

        // Surface normal: Cross product of edge (r1 - r0) and (r2 - r0)
        const ax = r1[0] - r0[0], ay = r1[1] - r0[1], az = r1[2] - r0[2];
        const bx = r2[0] - r0[0], by = r2[1] - r0[1], bz = r2[2] - r0[2];

        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        const normLen = Math.hypot(nx, ny, nz);

        if (normLen === 0) continue;
        nx /= normLen;
        ny /= normLen;
        nz /= normLen;

        // Back-face culling: skip faces pointing away from the camera
        if (nz <= 0) continue;

        // Lambertian lighting: Dot product (Normal · Light) + ambient term
        const dot = nx * light[0] + ny * light[1] + nz * light[2];
        const intensity = Math.max(0.12, Math.min(1.0, 0.25 + 0.75 * Math.max(0, dot)));

        // Rasterize filled triangle into the Z-buffer
        const p0 = projected[i0], p1 = projected[i1], p2 = projected[i2];
        fillTriangle(p0, p1, p2, intensity, charBuffer, intensityBuffer, zBuffer, width, height);
      }

      // Draw frame to terminal
      process.stdout.write('\x1B[H');
      console.log(animalColor.bold(`  ╔══════════════════════════════════════════════════════════════╗`));
      console.log(animalColor.bold(`  ║  ✦ HOLOGRAPHIC PROJECTION: ${animalName.toUpperCase().padEnd(33, ' ')} ║`));
      console.log(animalColor.bold(`  ╚══════════════════════════════════════════════════════════════╝`));
      console.log(chalk.gray(`       Model: ${path.basename(filePath)}  |  Vertices: ${model.vertices.length}  |  Triangles: ${model.faces.length}`));
      console.log(chalk.yellow(`       [Press any key or Q to power down hologram]\n`));

      // Build rows using monochromatic dim/bold shading in the single animalColor
      let frameStr = '';
      for (let y = 0; y < height; y++) {
        let rowStr = '   ';
        for (let x = 0; x < width; x++) {
          const ch = charBuffer[y][x];
          if (ch === ' ') {
            rowStr += ' ';
            continue;
          }

          const brightness = intensityBuffer[y][x];
          // Shading tier: dim for shadows, standard for midtones, bold for highlights
          if (brightness < 0.4) {
            rowStr += animalColor.dim(ch);
          } else if (brightness > 0.75) {
            rowStr += animalColor.bold(ch);
          } else {
            rowStr += animalColor(ch);
          }
        }
        frameStr += rowStr + '\n';
      }

      process.stdout.write(frameStr);
      angleY += 0.04; // Smooth horizontal rotation
    }, 50);

    setupExitKey(() => {
      clearInterval(interval);
      showCursor();
      console.clear();
      resolve();
    });
  });
}

// Barycentric triangle scanline rasterizer with Z-buffer depth test
function fillTriangle(p0, p1, p2, intensity, charBuf, intBuf, zBuf, width, height) {
  // Bounding box of the triangle on screen
  const minX = Math.max(0, Math.min(p0.x, p1.x, p2.x));
  const maxX = Math.min(width - 1, Math.max(p0.x, p1.x, p2.x));
  const minY = Math.max(0, Math.min(p0.y, p1.y, p2.y));
  const maxY = Math.min(height - 1, Math.max(p0.y, p1.y, p2.y));

  const denom = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
  if (Math.abs(denom) < 1e-5) return;

  const charIndex = Math.min(
    SHADE_CHARS.length - 1,
    Math.floor(intensity * (SHADE_CHARS.length - 1))
  );
  const glyph = SHADE_CHARS[charIndex];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Compute barycentric weights (w0, w1, w2)
      const w0 = ((p1.y - p2.y) * (x - p2.x) + (p2.x - p1.x) * (y - p2.y)) / denom;
      const w1 = ((p2.y - p0.y) * (x - p2.x) + (p0.x - p2.x) * (y - p2.y)) / denom;
      const w2 = 1 - w0 - w1;

      // Inside triangle test
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        // Interpolate depth Z across the face
        const depthZ = w0 * p0.z + w1 * p1.z + w2 * p2.z;

        // Z-buffer check: smaller depthZ is closer to the viewer
        if (depthZ < zBuf[y][x]) {
          zBuf[y][x] = depthZ;
          charBuf[y][x] = glyph;
          intBuf[y][x] = intensity;
        }
      }
    }
  }
}

function hideCursor() { process.stdout.write('\x1B[?25l'); }
function showCursor() { process.stdout.write('\x1B[?25h'); }

function setupExitKey(onExit) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  const handleKey = (chunk) => {
    if (chunk[0] === 3) { // Ctrl+C
      showCursor();
      process.exit(0);
    }
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    onExit();
  };

  process.stdin.once('data', handleKey);
}

function waitForEnter() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.once('data', (chunk) => {
      if (chunk[0] === 3) process.exit(0);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}