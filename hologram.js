import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

// Scans models/ and matches any file containing the animalId (case-insensitive)
function findModelFile(animalId) {
    const modelsDir = path.join(process.cwd(), 'models');

    if (!fs.existsSync(modelsDir)) {
        return null;
    }

    const files = fs.readdirSync(modelsDir);
    const target = animalId.toLowerCase();

    // Find the first .obj file that includes the animalId
    const matchedFile = files.find(file => {
        const lower = file.toLowerCase();
        return lower.endsWith('.obj') && lower.includes(target);
    });

    return matchedFile ? path.join(modelsDir, matchedFile) : null;
}

// 1. Read and parse the .obj file
function parseOBJ(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const vertices = [];
    const edges = [];

    for (let line of lines) {
        line = line.trim();
        const parts = line.split(/\s+/);
        const type = parts[0];

        if (type === 'v') {
            // Parse Vertex: v X Y Z
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                vertices.push([x, y, z]);
            }
        } else if (type === 'f') {
            // Parse Face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
            // OBJ indices are 1-based, so subtract 1 for 0-based JS arrays
            const indices = parts.slice(1).map(part => {
                const vIndex = parseInt(part.split('/')[0], 10);
                return vIndex - 1;
            });

            // Connect adjacent vertices to form edges of the face polygon
            for (let i = 0; i < indices.length; i++) {
                const from = indices[i];
                const to = indices[(i + 1) % indices.length];
                edges.push([from, to]);
            }
        }
    }

    // Normalize model size so all models fit nicely inside the terminal window
    normalizeModel(vertices);

    return { vertices, edges };
}

// Rescales model vertices so they stay between -1.0 and +1.0
function normalizeModel(vertices) {
    if (vertices.length === 0) return;
    let maxExtent = 0;

    for (const [x, y, z] of vertices) {
        maxExtent = Math.max(maxExtent, Math.abs(x), Math.abs(y), Math.abs(z));
    }

    if (maxExtent > 0) {
        for (let i = 0; i < vertices.length; i++) {
            vertices[i][0] /= maxExtent;
            vertices[i][1] /= maxExtent;
            vertices[i][2] /= maxExtent;
        }
    }
}

// 2. The Hologram projection engine
export async function renderHologram(animalId, animalName, animalColor) {
    // Dynamically find a matching .obj file (e.g. dodo-edit-base.obj matches 'dodo')
    const filePath = findModelFile(animalId);

    if (!filePath) {
        console.log(chalk.red(`\n  ✖ Error: No .obj file containing "${animalId}" found in models/!`));
        console.log(chalk.gray(`    Looked in: ${path.join(process.cwd(), 'models')}`));
        console.log(chalk.yellow(`\n  Press [Enter] to return...`));
        await waitForEnter();
        return;
    }

    const model = parseOBJ(filePath);

    if (!model || model.vertices.length === 0) {
        console.log(chalk.red(`\n  ✖ Error: Model file "${path.basename(filePath)}" is empty or invalid!`));
        console.log(chalk.yellow(`\n  Press [Enter] to return...`));
        await waitForEnter();
        return;
    }

    // To display the actual filename on the screen:
    const fileName = path.basename(filePath);

    const width = 64;
    const height = 24;
    let angleY = 0;
    let angleX = 0.2; // Slight tilt towards viewer

    console.clear();
    hideCursor();

    return new Promise((resolve) => {
        // Game/Render loop (runs every 50ms = 20 FPS)
        const interval = setInterval(() => {
            // 2D character buffer filled with empty spaces
            const buffer = Array.from({ length: height }, () => Array(width).fill(' '));

            // Rotate around Y and X axis
            const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
            const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

            // Project 3D points -> 2D terminal coordinates
            const projected = model.vertices.map(([x, y, z]) => {
                // Rotate around Y
                const x1 = x * cosY + z * sinY;
                const z1 = -x * sinY + z * cosY;

                // Rotate around X
                const y2 = y * cosX - z1 * sinX;
                const z2 = y * sinX + z1 * cosX;

                // Perspective scale (z distance adjustment)
                const distance = 2.2;
                const fov = 18 / (z2 + distance);

                // Aspect ratio correction (terminal chars are roughly twice as tall as wide)
                const screenX = Math.floor(width / 2 + x1 * fov * 2);
                const screenY = Math.floor(height / 2 - y2 * fov);

                return { x: screenX, y: screenY };
            });

            // Draw wireframe edges onto buffer
            for (const [v1, v2] of model.edges) {
                if (projected[v1] && projected[v2]) {
                    drawLine(buffer, projected[v1], projected[v2], width, height);
                }
            }

            // Render frame to terminal
            process.stdout.write('\x1B[H'); // Move cursor to top-left (flicker-free)
            console.log(animalColor.bold(`  ╔══════════════════════════════════════════════════════════════╗`));
            console.log(animalColor.bold(`  ║  ✦ HOLOGRAPHIC PROJECTION: ${animalName.toUpperCase().padEnd(33, ' ')} ║`));
            console.log(animalColor.bold(`  ╚══════════════════════════════════════════════════════════════╝`));
            console.log(chalk.gray(`       Model: models/${animalId}.obj  |  Vertices: ${model.vertices.length}`));
            console.log(chalk.yellow(`       [Press any key or Q to power down hologram]\n`));

            const output = buffer.map(row => '   ' + animalColor(row.join(''))).join('\n');
            process.stdout.write(output + '\n');

            angleY += 0.08; // Spin speed
        }, 50);

        // Listen for any keypress to stop and exit
        setupExitKey(() => {
            clearInterval(interval);
            showCursor();
            console.clear();
            resolve();
        });
    });
}

// Bresenham's line algorithm to plot ASCII characters between two points
function drawLine(buffer, p1, p2, width, height) {
    let x0 = p1.x, y0 = p1.y;
    const x1 = p2.x, y1 = p2.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
            buffer[y0][x0] = '·'; // Dot for clean wireframe look (can also be ░, *, or #)
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
}

function hideCursor() { process.stdout.write('\x1B[?25l'); }
function showCursor() { process.stdout.write('\x1B[?25h'); }

function setupExitKey(onExit) {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    const handler = () => {
        process.stdin.removeListener('keypress', handler);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        onExit();
    };

    process.stdin.once('keypress', handler);
}

function waitForEnter() {
    return new Promise((res) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('', () => {
            rl.close();
            res();
        });
    });
}