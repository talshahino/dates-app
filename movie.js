// ============================================================
// Love-movie maker: runs entirely on the phone.
// Photos and short clips + titles + generated romantic music
// are drawn to a canvas and recorded into one video file.
// ============================================================

const W = 720, H = 1280, FPS = 30;
const SLIDE = 3.6;      // seconds per memory
const FADE = 0.7;       // crossfade
const INTRO = 3.2, OUTRO = 3.2;
const MAX_CLIP = 5;     // seconds taken from each video

export function pickMime() {
  const opts = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// ---------- load media ----------
function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = rej; im.src = url;
  });
}
function loadVideo(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', '');
    v.onloadeddata = () => res(v); v.onerror = rej; v.src = url;
    v.load();
  });
}

// ---------- romantic music (generated, no copyright) ----------
// Soft piano arpeggios over a warm pad, I–vi–IV–V in F major, with reverb.
function makeMusic(ac, dest, total) {
  const master = ac.createGain(); master.gain.value = 0;
  const now = ac.currentTime + 0.05;
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.9, now + 2);
  master.gain.setValueAtTime(0.9, now + total - 2.5);
  master.gain.linearRampToValueAtTime(0, now + total);

  // reverb from generated impulse
  const rev = ac.createConvolver();
  const len = ac.sampleRate * 2.8, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  rev.buffer = ir;
  const wet = ac.createGain(); wet.gain.value = 0.45;
  const dry = ac.createGain(); dry.gain.value = 0.8;
  master.connect(dry); master.connect(rev); rev.connect(wet);
  dry.connect(dest); wet.connect(dest);

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // chords (MIDI): F, Dm, Bb, C
  const prog = [[53, 57, 60, 65], [50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64]];
  const melody = [[72, 69, 72, 74], [74, 72, 69, 65], [70, 69, 67, 65], [67, 69, 70, 72]];
  const beat = 60 / 72; // 72 bpm
  const bar = beat * 4;

  function piano(freq, t, dur, vol) {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq; o2.frequency.value = freq * 2.001;
    f.type = 'lowpass'; f.frequency.value = 2400;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function pad(freqs, t, dur) {
    freqs.forEach((fr) => {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = (Math.random() - 0.5) * 12;
      f.type = 'lowpass'; f.frequency.value = 700;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 1.2);
      g.gain.setValueAtTime(0.018, t + dur - 0.8);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.5);
    });
  }

  for (let t = now, i = 0; t < now + total; t += bar, i++) {
    const ch = prog[i % 4];
    pad(ch.slice(0, 3).map((n) => midi(n - 12 + 12)), t, bar);
    piano(midi(ch[0] - 12), t, bar * 0.95, 0.16);                 // bass
    const arp = [ch[1], ch[2], ch[3], ch[2], ch[1] + 12, ch[2], ch[3], ch[2]];
    arp.forEach((n, k) => piano(midi(n), t + k * beat / 2, beat * 1.6, 0.075));
    if (i >= 2) {                                                  // gentle melody after the intro
      melody[i % 4].forEach((n, k) => piano(midi(n), t + k * beat, beat * 1.9, 0.11));
    }
  }
}

// ---------- drawing helpers ----------
function cover(ctx, src, sw, sh, zoom, panX, panY, alpha) {
  const s = Math.max(W / sw, H / sh) * zoom;
  const dw = sw * s, dh = sh * s;
  const x = (W - dw) / 2 + panX * (dw - W) / 2;
  const y = (H - dh) / 2 + panY * (dh - H) / 2;
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, x, y, dw, dh);
  ctx.globalAlpha = 1;
}
function gradientBg(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#7B5CFF'); g.addColorStop(0.5, '#B44CF0'); g.addColorStop(1, '#FF4F7B');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // floating hearts
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = ((i * 137) % W) + Math.sin(t * 0.8 + i) * 18;
    const y = H - ((t * 60 + i * 97) % (H + 100));
    ctx.globalAlpha = 0.18 + (i % 3) * 0.08;
    ctx.font = `${26 + (i % 4) * 10}px sans-serif`;
    ctx.fillText('♥', x, y);
  }
  ctx.restore();
}
function text(ctx, str, y, size, weight = 800, color = '#fff', shadow = true) {
  ctx.save();
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  ctx.font = `${weight} ${size}px Rubik, sans-serif`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; }
  ctx.fillStyle = color;
  ctx.fillText(str, W / 2, y);
  ctx.restore();
}
function caption(ctx, line1, line2, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, H - 380, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,40,.75)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 380, W, 380);
  if (line1) text(ctx, line1, H - 150, 54);
  if (line2) text(ctx, line2, H - 90, 32, 500, '#FFE6EE');
  ctx.restore();
}

// ---------- main ----------
/**
 * items: [{ url, kind: 'image'|'video', line1, line2 }]
 * opts:  { title, subtitle, coupleUrl, canvas (optional preview), onProgress(0..1) }
 * returns { blob, mime }
 */
export async function makeMovie(items, opts) {
  const mime = pickMime();
  if (!mime) throw new Error('no-recorder');
  try { await document.fonts.load('800 40px Rubik'); await document.fonts.load('500 30px Rubik'); } catch {}

  const loaded = [];
  for (const it of items) {
    try {
      const media = it.kind === 'video' ? await loadVideo(it.url) : await loadImage(it.url);
      loaded.push({ ...it, media });
    } catch { /* skip broken media */ }
  }
  if (!loaded.length) throw new Error('no-media');
  const couple = opts.coupleUrl ? await loadImage(opts.coupleUrl).catch(() => null) : null;

  // timeline
  let t = INTRO;
  const slides = loaded.map((it, i) => {
    const len = it.kind === 'video' ? Math.min(MAX_CLIP, it.media.duration || MAX_CLIP) + FADE : SLIDE;
    const s = { ...it, start: t - FADE, end: t + len, i };
    t += len - FADE;
    return s;
  });
  const total = t + OUTRO;

  const canvas = opts.canvas || document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const hear = ac.createGain(); hear.gain.value = opts.audible === false ? 0 : 1;
  const mix = ac.createGain();
  mix.connect(dest); mix.connect(hear); hear.connect(ac.destination);
  makeMusic(ac, mix, total);

  const stream = canvas.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));
  rec.start(500);

  const t0 = ac.currentTime;
  let playing = null;

  await new Promise((resolve) => {
    function frame() {
      const now = ac.currentTime - t0;
      opts.onProgress?.(Math.min(1, now / total));
      ctx.clearRect(0, 0, W, H);
      gradientBg(ctx, now);

      if (now < INTRO + 0.4) {
        const a = Math.min(1, now / 0.8) * Math.min(1, (INTRO + 0.4 - now) / 0.6);
        ctx.globalAlpha = a;
        if (couple) ctx.drawImage(couple, W / 2 - 230, 300 - Math.sin(now * 2) * 8, 460, 460);
        text(ctx, opts.title || 'הדייטים שלנו', 860, 64);
        if (opts.subtitle) text(ctx, opts.subtitle, 930, 34, 500, '#FFE6EE');
        ctx.globalAlpha = 1;
      }

      for (const s of slides) {
        if (now < s.start || now > s.end) {
          if (s.kind === 'video' && playing === s && now > s.end) { s.media.pause(); playing = null; }
          continue;
        }
        const local = now - s.start, len = s.end - s.start;
        const alpha = Math.min(1, local / FADE, (s.end - now) / FADE);
        const p = local / len;
        if (s.kind === 'video') {
          if (playing !== s) { playing = s; s.media.currentTime = 0; s.media.play().catch(() => {}); }
          cover(ctx, s.media, s.media.videoWidth, s.media.videoHeight, 1.02, 0, 0, alpha);
        } else {
          const dir = s.i % 2 ? 1 : -1;
          cover(ctx, s.media, s.media.naturalWidth, s.media.naturalHeight, 1.04 + p * 0.1, dir * (p - 0.5) * 0.6, (0.5 - p) * 0.4, alpha);
        }
        caption(ctx, s.line1, s.line2, alpha);
      }

      const outroStart = total - OUTRO - 0.3;
      if (now > outroStart) {
        const a = Math.min(1, (now - outroStart) / 0.8);
        ctx.globalAlpha = a;
        gradientBg(ctx, now);
        if (couple) ctx.drawImage(couple, W / 2 - 200, 360, 400, 400);
        text(ctx, 'טל ואילת', 860, 66);
        text(ctx, 'עוד הרבה דייטים ביחד ♥', 930, 34, 500, '#FFE6EE');
        ctx.globalAlpha = 1;
      }

      if (now >= total) return resolve();
      setTimeout(frame, 1000 / FPS); // timers keep running steadily while recording
    }
    frame();
  });

  rec.stop();
  await done;
  ac.close();
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime: mime.split(';')[0], duration: total };
}
