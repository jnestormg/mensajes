const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const PRIMARY = [37, 99, 235];
const WHITE = [255, 255, 255];
const DARK = [15, 23, 42];

function crc32(buf) {
    let table = crc32.table;
    if (!table) {
        table = crc32.table = [];
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            }
            table[n] = c >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePNG(size, getPixel) {
    const raw = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        const rowStart = y * (size * 4 + 1);
        raw[rowStart] = 0;
        for (let x = 0; x < size; x++) {
            const [r, g, b, a] = getPixel(x, y);
            const o = rowStart + 1 + x * 4;
            raw[o] = r;
            raw[o + 1] = g;
            raw[o + 2] = b;
            raw[o + 3] = a;
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    return Buffer.concat([
        signature,
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

function insideRoundedRect(x, y, w, h, r) {
    if (r <= 0) return x >= 0 && y >= 0 && x < w && y < h;
    const cx = Math.max(r, Math.min(x, w - 1 - r));
    const cy = Math.max(r, Math.min(y, h - 1 - r));
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
}

function insideEllipse(x, y, cx, cy, rx, ry) {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
}

function insideTriangle(x, y, a, b, c) {
    const d1 = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    const d2 = (x - b[0]) * (c[1] - b[1]) - (y - b[1]) * (c[0] - b[0]);
    const d3 = (x - c[0]) * (a[1] - c[1]) - (y - c[1]) * (a[0] - c[0]);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
}

function renderIcon(size, maskable) {
    const content = maskable ? 0.72 : 0.8;
    const pad = (size * (1 - content)) / 2;
    const g = (v) => pad + v * content * size;

    const radius = maskable ? 0 : size * 0.2;
    const bx = g(0.5);
    const by = g(0.47);
    const brx = g(0.27);
    const bry = g(0.2);
    const dotR = g(0.055);
    const dots = [
        [bx - brx * 0.5, by],
        [bx, by],
        [bx + brx * 0.5, by]
    ];
    const tail = [
        [g(0.31), g(0.55)],
        [g(0.45), g(0.78)],
        [g(0.6), g(0.52)]
    ];

    return (x, y) => {
        if (!insideRoundedRect(x, y, size, size, radius)) return [0, 0, 0, 0];

        let color = PRIMARY;

        if (insideEllipse(x, y, bx, by, brx, bry)) {
            color = WHITE;
        } else if (insideTriangle(x, y, tail[0], tail[1], tail[2])) {
            color = WHITE;
        }

        if (color === WHITE) {
            for (const [dx, dy] of dots) {
                const ox = x - dx;
                const oy = y - dy;
                if (ox * ox + oy * oy <= dotR * dotR) {
                    color = DARK;
                    break;
                }
            }
        }

        return [...color, 255];
    };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-192.png", 192, true],
    ["icon-maskable-512.png", 512, true]
];

for (const [name, size, maskable] of files) {
    const getPixel = renderIcon(size, maskable);
    const png = writePNG(size, getPixel);
    fs.writeFileSync(path.join(OUT_DIR, name), png);
    console.log(`Generado ${name} (${size}x${size}, ${png.length} bytes)`);
}