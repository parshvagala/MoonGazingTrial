/**
 * hexgrid.js - draws a mathematically exact hexagonal lattice onto a fixed background canvas.
 *
 * Geometry (pointy-top hexagons, circumradius = size):
 *   column spacing = sqrt(3) * size,  row spacing = 1.5 * size,  odd rows shifted by half a column.
 * This is the tightest packing, so neighbouring hexagons share edges exactly.
 */
export function initHexGrid(canvas, { size = 30, color = 'rgba(0, 240, 255, 0.07)' } = {}) {
  const ctx = canvas.getContext('2d');

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    const colStep = Math.sqrt(3) * size;
    const rowStep = 1.5 * size;

    ctx.beginPath();
    for (let row = -1; row * rowStep < H + size; row++) {
      const offset = row & 1 ? colStep / 2 : 0;          // shift every other row
      for (let col = -1; col * colStep < W + colStep; col++) {
        const cx = col * colStep + offset, cy = row * rowStep;
        for (let k = 0; k < 6; k++) {                     // six vertices, 60 degrees apart
          const a = (Math.PI / 180) * (60 * k - 30);
          const x = cx + size * Math.cos(a), y = cy + size * Math.sin(a);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
  }

  draw();
  let timer;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
}
