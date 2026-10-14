/**
 * main.js - entry point. Wires every module to the page.
 */
import { CONFIG } from './config.js';
import { initHexGrid } from './hexgrid.js';
import { initMoon, phaseOf, lit, phaseName, SYNODIC } from './moon.js';
import { initEridian } from './eridian.js';

const $ = sel => document.querySelector(sel);
const pad = (n, len = 2) => String(n).padStart(len, '0');
const EVENT = CONFIG.eventDate;

// ---------- Background lattice ----------
initHexGrid($('#hexgrid'));

// ---------- Moon, shown in its real phase on the night of the event ----------
const phase = phaseOf(EVENT);
initMoon($('#moon'), phase);
$('#rdIllum').textContent = `ILLUM ${(lit(phase) * 100).toFixed(1)}%`;
$('#rdPhase').textContent = phaseName(phase).toUpperCase();
$('#rdAge').textContent = `AGE ${(phase * SYNODIC).toFixed(1)} D`;

// ---------- Event data panel (date text is static in the HTML; the rest comes from config.js) ----------
$('#dDay').textContent = EVENT.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
$('#dTime').textContent = `${EVENT.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} LOCAL`;
$('#dVenue').textContent = CONFIG.venue;
$('#dEntry').textContent = CONFIG.entry;
$('#dMoon').textContent = `${phaseName(phase).toUpperCase()} · ${Math.round(lit(phase) * 100)}% LIT`;

// ---------- Millisecond countdown ----------
// Uses requestAnimationFrame for smooth updates and Date.now() every frame, so it never drifts
// (and catches up instantly after the tab was in the background).
function startCountdown() {
  const digits = $('#cdDigits');
  (function frame() {
    const left = EVENT.getTime() - Date.now();
    if (left <= 0) {
      $('#cdLabel').textContent = 'MISSION STATUS';
      digits.textContent = 'FIRST LIGHT';
      $('#cdUnits').textContent = 'LOOK UP';
      return;                                              // stop the loop
    }
    const days = Math.floor(left / 864e5);
    const hrs = Math.floor((left % 864e5) / 36e5);
    const min = Math.floor((left % 36e5) / 6e4);
    const sec = Math.floor((left % 6e4) / 1e3);
    const ms = left % 1e3;
    digits.textContent = `${pad(days)}:${pad(hrs)}:${pad(min)}:${pad(sec)}.${pad(ms, 3)}`;
    requestAnimationFrame(frame);
  })();
}
startCountdown();

// ---------- Eridian audio-visual interface ----------
initEridian({
  targets: [...document.querySelectorAll('.eri')],        // RSVP hexagon + nav links
  audioBtn: $('#audioBtn'),
  fxCanvas: $('#wavefx'),
});

// ---------- RSVP dialog ----------
const dlg = $('#rsvpDlg'), form = $('#rsvpForm'), ack = $('#rsvpAck');
function openDialog() {
  form.hidden = false;
  ack.hidden = true;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}
$('#rsvpBtn').addEventListener('click', openDialog);
$('#navRsvp').addEventListener('click', openDialog);
$('#dlgClose').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });   // click on the backdrop closes it

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = { name: $('#fName').value.trim(), email: $('#fMail').value.trim(), guests: $('#fGuests').value };
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    if (CONFIG.rsvpUrl) {
      const res = await fetch(CONFIG.rsvpUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Bad response');
    }
    ack.textContent = `TRANSMISSION RECEIVED, ${data.name.toUpperCase()}. ${data.guests} SEAT(S) LOGGED. SEE YOU AT FIRST LIGHT.`;
    form.reset();
    $('#fGuests').value = 1;
    form.hidden = true;
  } catch (err) {
    ack.textContent = 'TRANSMISSION FAILED. CHECK YOUR CONNECTION AND RETRY.';
  }
  ack.hidden = false;                                      // textContent keeps user input safe from HTML injection
  submit.disabled = false;
});

// ---------- Scroll reveal ----------
const reveal = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('on'); reveal.unobserve(en.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.rv').forEach(el => reveal.observe(el));
