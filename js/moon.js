/**
 * moon.js - lunar phase maths and the interactive 3D Moon (three.js, loaded globally as THREE).
 */

// ---------------------------------------------------------------------------
// Phase maths: count days since a known new moon (6 Jan 2000, 18:14 UTC) modulo the synodic month.
// ---------------------------------------------------------------------------
export const SYNODIC = 29.530588853;

/** Moon phase for a Date: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
export function phaseOf(date) {
  const julianDay = date.getTime() / 864e5 + 2440587.5;
  const p = ((julianDay - 2451550.1) / SYNODIC) % 1;
  return p < 0 ? p + 1 : p;
}

/** Fraction of the visible disc that is lit (0..1). */
export const lit = p => (1 - Math.cos(p * 2 * Math.PI)) / 2;

export function phaseName(p) {
  if (p < 0.03 || p > 0.97) return 'New Moon';
  if (p < 0.22) return 'Waxing Crescent';
  if (p < 0.28) return 'First Quarter';
  if (p < 0.47) return 'Waxing Gibbous';
  if (p < 0.53) return 'Full Moon';
  if (p < 0.72) return 'Waning Gibbous';
  if (p < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

// ---------------------------------------------------------------------------
// 3D Moon
// ---------------------------------------------------------------------------
const RADIUS = 1.6;       // Moon radius in scene units
const CAM_Z = 8;          // camera distance. With fov 30 the view is +-2.14 units tall, so the
                          // Moon (and its sensor grid) fills ~75% of the box and can never be clipped.

export function initMoon(box, phase) {
  // Graceful fallback if three.js or WebGL is unavailable: CSS disc is shown instead.
  if (!window.THREE) { box.classList.add('no-gl'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (err) { box.classList.add('no-gl'); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  box.insertBefore(renderer.domElement, box.firstChild);     // canvas sits under the HUD overlay

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.z = CAM_Z;

  // Surface: real Moon map. Until it loads (or if it fails) the Moon is a plain grey sphere.
  const material = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1, metalness: 0, bumpScale: 0.012 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 128, 128), material);
  new THREE.TextureLoader().load('moon.jpg', tex => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.offset.x = 0.25;                  // puts the Earth-facing side at the front
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    material.map = material.bumpMap = tex;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  });

  // Cyan survey grid wrapped around the Moon (a slightly larger wireframe sphere)
  const grid = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.025, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.09 })
  );

  const group = new THREE.Group();
  group.add(moon, grid);
  scene.add(group);

  // Lighting: the Sun direction is derived from the phase so the terminator is astronomically correct.
  // phase 0 = Sun behind the Moon, 0.5 = Sun behind the camera. Waxing lights the right side, waning the left.
  scene.add(new THREE.AmbientLight(0x4a7a96, 0.3));        // faint cool earthshine on the dark side
  const sun = new THREE.DirectionalLight(0xfff6e6, 2.6);
  const a = phase * 2 * Math.PI;
  sun.position.set(Math.sin(a) * 9, 1.4, -Math.cos(a) * 9);
  scene.add(sun);

  // Interaction: drag to rotate, release and it keeps a gentle momentum
  let dragging = false, lastX = 0, lastY = 0, velX = 0.0016, velY = 0, visible = true;
  box.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; box.setPointerCapture(e.pointerId); box.style.cursor = 'grabbing'; });
  box.addEventListener('pointermove', e => {
    if (!dragging) return;
    velX = (e.clientX - lastX) * 0.006;
    velY = (e.clientY - lastY) * 0.006;
    lastX = e.clientX; lastY = e.clientY;
    group.rotation.y += velX;
    group.rotation.x = Math.max(-1.1, Math.min(1.1, group.rotation.x + velY));
  });
  const release = () => { dragging = false; box.style.cursor = 'grab'; velX = Math.max(-0.02, Math.min(0.02, velX)); };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);

  // Keep the renderer matched to the box, and stop rendering while off-screen
  const fit = () => { const w = box.clientWidth || 300; renderer.setSize(w, w, false); };
  new ResizeObserver(fit).observe(box);
  fit();
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(box);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    if (!dragging) {
      group.rotation.y += velX;
      velX += ((reduce ? 0 : 0.0016) - velX) * 0.02;       // ease back to the slow idle spin
      group.rotation.x *= 0.98;                            // and back to upright
    }
    renderer.render(scene, camera);
  })();
}
