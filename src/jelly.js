import { beatPosition, danceProfile, performanceProfile, sampleDance } from './beat.js';

// One RAF and one audio clock. Offscreen targets do not consume the motion budget.
export function createJelly({ getTime, getBpm, getCount, getOffset, onBeat, onStats }) {
  let enabled = false, frame = 0, observer, records = [], active = [];
  let lastFrame = 0, lastTime = -1, lastOffset = null, lastBpm = null, lastBeat = null, force = false;
  let quality = performanceProfile(8);
  const visible = new Set();
  const restore = record => {
    record.element.style.transform = record.original;
    record.element.classList.remove('is-dancing');
  };
  const clearTargets = () => {
    observer?.disconnect();
    records.forEach(restore);
    records = [];
    active = [];
    visible.clear();
    document.querySelector('#jelly-overlay').replaceChildren();
  };
  const chooseActive = () => {
    const stage = document.querySelector('#arena-stage');
    const fullscreen = document.fullscreenElement === stage || stage.classList.contains('stage-expanded');
    const next = records.filter(r => visible.has(r.anchor) && r.element.isConnected && (!fullscreen || stage.contains(r.element)))
      .sort((a, b) => b.priority - a.priority).slice(0, quality.maxTargets);
    const keep = new Set(next);
    active.filter(r => !keep.has(r)).forEach(restore);
    next.forEach(r => r.element.classList.add('is-dancing'));
    active = next;
    force = true;
    onStats?.({ ...quality, active: active.length });
  };
  const collect = () => {
    clearTargets();
    quality = performanceProfile(getCount());
    const add = (element, kind, anchor = element, priority = 0) => {
      records.push({ element, anchor, priority, original: element.style.transform, profile: danceProfile(kind, Math.random, quality.light) });
    };
    document.querySelectorAll('.spring-item:not(.topbar):not(.arena-card)').forEach(el => add(el, 'panel', el, 1));
    document.querySelectorAll('.word').forEach(el => add(el, 'word', el.parentElement, el.classList.contains('active') ? 25 : 10));
    document.querySelectorAll('.fighter-art').forEach(el => add(el, 'cow', el.closest('.fighter'), el.closest('.selected') ? 40 : 20));
    document.querySelectorAll('.hero-doodle, .brand-mark, .analysis-icon, .translation-mark').forEach(el => add(el, 'word', el.parentElement, 3));
    document.querySelectorAll('.record').forEach(el => add(el, 'record', el, 3));
    const overlay = document.querySelector('#jelly-overlay');
    ['哞！', 'BOING', '踩点！', 'K.O.?', '好牛的拍子', '✦', '别抢拍', '这局我领舞'].slice(0, quality.light ? 4 : 8).forEach((text, index) => {
      const el = document.createElement('span');
      el.textContent = text;
      el.style.cssText = `left:${8 + index * 11}%;top:${18 + index % 3 * 27}%;font-size:${14 + index % 3 * 3}px;`;
      overlay.append(el);
      add(el, 'particle', overlay, 2);
    });
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      if (enabled) chooseActive();
    });
    new Set(records.map(r => r.anchor)).forEach(anchor => observer.observe(anchor));
    force = true;
  };
  const tick = timestamp => {
    if (!enabled) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden || timestamp - lastFrame < 1000 / quality.fps - 1) return;
    const time = getTime(), offset = getOffset(), bpm = getBpm();
    if (!force && time === lastTime && offset === lastOffset && bpm === lastBpm) return;
    lastFrame = timestamp;
    lastTime = time;
    lastOffset = offset;
    lastBpm = bpm;
    force = false;
    const beat = beatPosition(time, offset, bpm);
    for (const record of active) {
      if (record.profile.kind === 'record') {
        record.element.style.transform = `rotate(${beat * 90 % 360}deg)`;
        continue;
      }
      const pose = sampleDance(beat, record.profile);
      record.element.style.transform = `translate(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px) rotate(${pose.rotation.toFixed(2)}deg) scale(${pose.scaleX.toFixed(3)},${pose.scaleY.toFixed(3)})`;
    }
    const integerBeat = Math.floor(beat);
    if (integerBeat !== lastBeat) { lastBeat = integerBeat; onBeat?.(integerBeat); }
  };
  return {
    set(value) {
      enabled = value;
      cancelAnimationFrame(frame);
      if (enabled) { collect(); lastFrame = 0; lastBeat = null; frame = requestAnimationFrame(tick); }
      else { clearTargets(); onStats?.({ ...quality, active: 0 }); }
    },
    refresh() { if (enabled) collect(); }
  };
}
