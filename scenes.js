// Animated scenes for idea cards: a main figure with its own motion,
// plus small particles that rise, twinkle or drift around it.
// m = main emoji, p = particles, ma = main motion, pa = particle motion
export const ART = {
  coffee:   { m: '☕', p: ['💨', '💨', '🥐'], ma: 'bob', pa: 'rise' },
  sushi:    { m: '🍣', p: ['🥢', '✨', '🍙'], ma: 'bounce', pa: 'twinkle' },
  dinner:   { m: '🍽️', p: ['🕯️', '✨', '🍷'], ma: 'bob', pa: 'twinkle' },
  wine:     { m: '🍷', p: ['🫧', '🫧', '🍇', '🫧'], ma: 'sway', pa: 'rise' },
  dessert:  { m: '🍰', p: ['🍓', '✨', '🍫'], ma: 'bounce', pa: 'twinkle' },
  pasta:    { m: '🍝', p: ['💨', '🌿', '💨'], ma: 'bob', pa: 'rise' },
  asian:    { m: '🍜', p: ['💨', '🥢', '💨'], ma: 'bob', pa: 'rise' },
  grill:    { m: '🥩', p: ['🔥', '🔥', '✨'], ma: 'sizzle', pa: 'rise' },
  cooking:  { m: '🧑‍🍳', p: ['🥕', '🍅', '🧄', '🌶️'], ma: 'bob', pa: 'juggle' },
  cocktail: { m: '🍸', p: ['🫧', '🍋', '🫧', '✨'], ma: 'sway', pa: 'rise' },
  market:   { m: '🧺', p: ['🍓', '🥖', '🧀', '🍇'], ma: 'bounce', pa: 'juggle' },
  massage:  { m: '💆‍♀️', p: ['🌸', '🪷', '✨'], ma: 'breathe', pa: 'drift' },
  pool:     { m: '🏊‍♀️', p: ['💧', '💧', '☀️'], ma: 'swim', pa: 'rise' },
  facial:   { m: '🧖‍♀️', p: ['🌿', '🫧', '✨'], ma: 'breathe', pa: 'rise' },
  nails:    { m: '💅', p: ['✨', '💖', '✨'], ma: 'sway', pa: 'twinkle' },
  candles:  { m: '🕯️', p: ['🌹', '✨', '🌹'], ma: 'flicker', pa: 'drift' },
  shopping: { m: '🛍️', p: ['✨', '🏷️', '💳'], ma: 'bounce', pa: 'twinkle' },
  perfume:  { m: '🌷', p: ['💨', '🌸', '✨'], ma: 'sway', pa: 'drift' },
  fashion:  { m: '👗', p: ['✨', '👠', '✨'], ma: 'sway', pa: 'twinkle' },
  jewelry:  { m: '💍', p: ['✨', '💎', '✨'], ma: 'spin', pa: 'twinkle' },
  concert:  { m: '🎤', p: ['🎵', '🎶', '🎵', '🎶'], ma: 'bob', pa: 'rise' },
  jazz:     { m: '🎷', p: ['🎵', '🎶', '🎵'], ma: 'sway', pa: 'rise' },
  comedy:   { m: '😂', p: ['🎙️', '✨', '😆'], ma: 'shake', pa: 'twinkle' },
  cinema:   { m: '🍿', p: ['🎬', '⭐', '🍿'], ma: 'bounce', pa: 'juggle' },
  theater:  { m: '🎭', p: ['✨', '🌟', '✨'], ma: 'sway', pa: 'twinkle' },
  dance:    { m: '💃', p: ['🎵', '✨', '🎶'], ma: 'dance', pa: 'rise' },
  escape:   { m: '🔐', p: ['🗝️', '❓', '❔'], ma: 'shake', pa: 'drift' },
  pottery:  { m: '🏺', p: ['✨', '🤲', '✨'], ma: 'spin', pa: 'twinkle' },
  art:      { m: '🎨', p: ['🖌️', '✨', '🖼️'], ma: 'sway', pa: 'drift' },
  games:    { m: '🎳', p: ['🎯', '✨', '🎲'], ma: 'bounce', pa: 'juggle' },
  boat:     { m: '⛵', p: ['🌊', '🌊', '🌅'], ma: 'rock', pa: 'drift' },
  balloon:  { m: '🎈', p: ['☁️', '☁️', '🐦'], ma: 'float', pa: 'drift' },
  hotel:    { m: '🛏️', p: ['🌙', '⭐', '✨'], ma: 'breathe', pa: 'twinkle' },
  cabin:    { m: '🏡', p: ['🌲', '⭐', '🌙'], ma: 'bob', pa: 'twinkle' },
  desert:   { m: '🏜️', p: ['⭐', '🌙', '✨', '⭐'], ma: 'bob', pa: 'twinkle' },
  beach:    { m: '🏖️', p: ['🌊', '☀️', '🐚'], ma: 'bob', pa: 'drift' },
  flight:   { m: '✈️', p: ['☁️', '☁️', '🌍'], ma: 'fly', pa: 'drift' },
  car:      { m: '🚗', p: ['🌳', '☁️', '🌳'], ma: 'drive', pa: 'drift' },
  friends:  { m: '🥂', p: ['✨', '🎉', '✨'], ma: 'cheers', pa: 'twinkle' },
  gift:     { m: '🎁', p: ['✨', '💝', '🎀'], ma: 'shake', pa: 'twinkle' },
};

export const DEFAULT_ART = {
  food: 'dinner', spa: 'massage', shopping: 'shopping', experiences: 'theater', people: 'friends',
};

// fixed positions so the same idea always looks the same
const SPOTS = [[18, 30], [78, 24], [26, 70], [74, 68], [50, 16], [86, 48]];

export function sceneHtml(idea) {
  const key = ART[idea.art] ? idea.art : DEFAULT_ART[idea.category] || 'gift';
  const a = ART[key];
  const parts = a.p.map((em, i) => {
    const [x, y] = SPOTS[i % SPOTS.length];
    return `<span class="pt ${a.pa}" style="--x:${x}%;--y:${y}%;--d:${(i * 0.55).toFixed(2)}s">${em}</span>`;
  }).join('');
  return `<div class="scene" aria-hidden="true">${parts}<span class="main ${a.ma}">${a.m}</span></div>`;
}
