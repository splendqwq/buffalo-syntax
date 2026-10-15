export const BPM = 120;
export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const BIG_BEAT_SECONDS = 120 / BPM;
export const LARGE_COUNT = 80;
const positiveMod = (n, d) => ((n % d) + d) % d;

export function parseBpm(value) {
  const bpm = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) throw new RangeError(`请输入 ${MIN_BPM}–${MAX_BPM} 之间的 BPM，例如 120。`);
  return bpm;
}

export function beatPosition(seconds, offset = 0, bpm = BPM) {
  return ((Number.isFinite(seconds) ? seconds : 0) - offset) * parseBpm(bpm) / 60;
}

export function performanceProfile(count) {
  const light = count >= LARGE_COUNT;
  return { light, fps: light ? 30 : 60, maxTargets: light ? 32 : 80 };
}

export function danceProfile(kind, random = Math.random, light = false) {
  const panel = kind === 'panel', cow = kind === 'cow', particle = kind === 'particle';
  const multiplier = light ? .7 : 1;
  return {
    kind, cycleBeats: panel || cow ? 2 : 1,
    height: (panel ? 5 : cow ? 85 + random() * 45 : particle ? 32 + random() * 20 : 50 + random() * 20) * multiplier,
    travel: (random() * 2 - 1) * (panel ? 2 : cow ? 45 : particle ? 35 : light ? 3 : 8) * multiplier,
    twist: (random() * 2 - 1) * (panel ? .4 : cow ? 24 : particle ? 18 : light ? 3 : 8),
    soften: light ? .55 : 1,
    spin: cow && !light && random() < .28 ? 360 : 0
  };
}

/** All trajectories share the media clock. Variation affects distance, never BPM. */
export function sampleDance(beat, profile) {
  const p = positiveMod(beat, profile.cycleBeats) / profile.cycleBeats;
  const direction = positiveMod(Math.floor(beat / profile.cycleBeats), 2) ? -1 : 1;
  const panel = profile.kind === 'panel';
  const soften = profile.soften ?? 1;
  let x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1;
  if (p < .12) {
    const press = Math.sin(Math.PI * p / .12);
    scaleX += press * (panel ? .006 : .22) * soften;
    scaleY -= press * (panel ? .015 : .35) * soften;
    y = press * (panel ? 1 : 4);
  } else if (p < .8) {
    const t = (p - .12) / .68, arc = Math.sin(Math.PI * t);
    y = -profile.height * 4 * t * (1 - t);
    x = profile.travel * arc * direction;
    rotation = profile.twist * arc * direction + profile.spin * t;
    scaleX -= arc * (panel ? .002 : .10) * soften;
    scaleY += arc * (panel ? .006 : .18) * soften;
  } else {
    const t = (p - .8) / .2;
    const impact = Math.sin(t * Math.PI * 2) * (1 - t);
    scaleX += impact * (panel ? .006 : .3) * soften;
    scaleY -= impact * (panel ? .014 : .4) * soften;
    y = impact > 0 ? impact * 4 : impact * profile.height * .12;
    rotation = profile.spin;
  }
  return { x, y, rotation, scaleX, scaleY };
}
