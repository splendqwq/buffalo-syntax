import { interpret, describeToken, MAX_COUNT } from './engine.js';
import { drawArena, bubbleMarkup } from './arena.js';
import { createCamera } from './camera.js';
import { renderSyntax, renderBrackets } from './syntax.js';
import { createJelly } from './jelly.js';
import { BPM, parseBpm, performanceProfile } from './beat.js';
import { createSilentClock, validateAudioFile } from './audio.js';
import { banterFor } from './banter.js';
import { createEditing } from './editing.js';

const $ = selector => document.querySelector(selector);
const pad = value => String(value).padStart(2, '0');
let model = interpret(8);
let selectedToken = model.groups[0].nounToken;
let selectedGroup = 'A';
let jellyOn = false;
let toastTimer;
let arenaLayout;
let beatOffset = 0;
let bpm = BPM;
let trackURL = null;
let trackName = '';
const silentClock = createSilentClock();
const banterRounds = new Map();
const audio = $('#bgm-audio');
audio.volume = 0.35;
const danceTime = () => trackURL ? audio.currentTime : silentClock.time();
const jelly = createJelly({
  getTime: danceTime, getBpm: () => bpm, getCount: () => model.count, getOffset: () => beatOffset,
  onBeat(beat) {
    const index = ((beat % 4) + 4) % 4;
    document.querySelectorAll('.beat-meter').forEach(meter => [...meter.children].forEach((dot, i) => dot.classList.toggle('beat-active', i === index)));
    $('#arena-stage').dataset.beat = String(beat);
  },
  onStats(stats) {
    $('#arena-stage').dataset.danceActive = stats.active;
    $('#arena-stage').dataset.danceFps = stats.fps;
    $('#arena-stage').dataset.motionQuality = stats.light ? 'light' : 'full';
  }
});
const camera = createCamera($('#arena'), $('#arena-viewport'), value => {
  $('#zoom-value').textContent = `${value.scale < .1 ? (value.scale * 100).toFixed(1) : Math.round(value.scale * 100)}%`;
  const legible = model.groups.length <= 20;
  for (const [selector, natural, minimum] of [['.fighter-id', 11, 9], ['.fighter-location', 9, 7], ['.fighter-badge', 9, 6], ['.edge-label', 12, 7], ['.edge-caption', 9, 6]]) {
    document.querySelectorAll(`#arena ${selector}`).forEach(label => { label.style.fontSize = `${legible ? Math.max(natural, minimum / value.scale) : natural}px`; });
  }
});
const editing = createEditing({ getModel: () => model, applyModel, toast, refreshJelly: () => jelly.refresh() });

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2800);
}

function buffaloArt(index) {
  const mood = (index + model.seed) % 4;
  const body = ['#b58d70', '#a69bc0', '#88aaa3', '#b8af6d'][index % 4];
  const head = ['#77533e', '#79688a', '#537e77', '#7b7848'][index % 4];
  const eyes = [
    '<path d="M-24-12L-11-8M11-8L24-13" fill="none" stroke-width="3"/><circle cx="-17" cy="-2" r="3"/><circle cx="17" cy="-2" r="3"/>',
    '<path d="M-31-10L31-10" stroke-width="3"/><path d="M-28-10H-7L-9 4H-25ZM7-10H28L25 4H9Z" fill="#252a32"/><path d="M-22-8L-16 1M14-8L20 1" stroke="#eee9dc" stroke-width="1.4"/>',
    '<path d="M-24-7L-12 5M-12-7L-24 5M12-7L24 5M24-7L12 5" stroke-width="3"/><path d="M33-22Q46-8 36-6Q26-9 33-22Z" fill="#8ac5db" stroke-width="1"/>',
    '<ellipse cx="-17" cy="-3" rx="9" ry="11" fill="#faf8e8"/><ellipse cx="17" cy="-3" rx="9" ry="11" fill="#faf8e8"/><circle cx="-14" cy="-1" r="2.8"/><circle cx="14" cy="-1" r="2.8"/>'
  ][mood];
  return `<g class="fighter-art">
    <ellipse cx="0" cy="55" rx="60" ry="8" fill="#c8cbb8" opacity=".5"/>
    <g stroke="#3e4035" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-48 27L-44 52Q-39 57-33 52L-29 28M28 28L32 52Q39 57 44 51L48 26" fill="${head}"/>
      <path d="M-59 15C-62-14-39-38-5-32C27-40 55-21 57 10L48 36Q-2 57-49 34Z" fill="${body}"/>
      <path d="M-38-27C-57-19-72-28-71-48C-62-34-46-37-33-40M35-28C56-18 72-28 71-48C62-34 47-37 33-40" fill="#f8f4df"/>
      <path d="M-34-16Q-56-30-59-14Q-57-3-38 1M34-16Q56-30 59-14Q57-3 38 1" fill="${head}"/>
      <path d="M-40-22Q-40-43-17-45Q-1-53 17-44Q39-43 41-22L35 14Q29 37 0 39Q-28 37-35 14Z" fill="${head}"/>
      <path d="M-20-43L-17-52L-6-47L3-55L11-47L22-49L19-39" fill="${head}"/>
      ${eyes}
      <path d="M-32 13Q-34 0-18 3Q0 8 18 3Q34 0 32 13L29 25Q24 37 0 37Q-25 37-29 25Z" fill="#c9b48a"/>
      <ellipse cx="-12" cy="17" rx="3" ry="4" fill="#5f5741" stroke="none"/><ellipse cx="12" cy="17" rx="3" ry="4" fill="#5f5741" stroke="none"/>
      ${mood === 2 ? '<path d="M-8 28Q0 23 8 28L7 35Q0 42-5 36Z" fill="#d99e9c"/>' : mood === 3 ? '<ellipse cx="0" cy="29" rx="5" ry="4" fill="#655044"/>' : '<path d="M-7 28Q0 23 7 28" fill="none" stroke-width="1.6"/>'}
      <path d="M-41 25Q-55 18-58 29M41 25Q55 18 58 29" fill="none"/>
      <path d="M-61 21Q-76 21-73 35Q-70 46-55 40Q-48 38-51 29Z" fill="#cb6246"/><path d="M54 23Q70 18 74 30Q77 41 63 43Q52 44 51 34Z" fill="#cb6246"/>
      <path d="M-70 32L-56 30M58 31L70 29" stroke="#9d4933" stroke-width="1.4"/>
    </g>
    <path d="M-27-4L-24-1M25-3L28-6" stroke="#d29c7d" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

function renderArena() {
  arenaLayout = drawArena($('#arena'), model, buffaloArt, banterRounds);
  camera.fit(arenaLayout);
}

function render() {
  $('#token-count').textContent = `${pad(model.count)} 词 · 全是 BUFFALO`;
  $('#round-tag').innerHTML = `ROUND<b>${String(model.count).padStart(3, '0')}</b>`;
  $('#word-tab-count').textContent = pad(model.count);
  $('#tree-seed').textContent = model.edited ? '亲手安排的恩怨 · 句子与图同步' : model.classic ? '经典 8 词 · B → A → C' : '随机恩怨树 · 每次都可能换对手';
  const explicit = model.groups.filter(g => !g.implicit).length;
  $('#arena-stats').textContent = `${explicit} 组水牛${model.count <= 2 ? ' + 省略成分' : ''} / ${model.edges.length} 场欺负`;
  $('#sentence').innerHTML = model.tokens.map(token => `<span class="word-seat"><button class="word ${token.role}" data-token="${token.id}" aria-label="第 ${token.id} 词 ${token.word}，${describeToken(token, model).pos}" aria-pressed="false"><span class="word-index">${pad(token.id)}</span>${token.word}<span class="word-job">${token.role === 'city' ? `地点 → ${token.group} 组` : token.role === 'noun' ? `${token.group} 组 · 水牛` : `${token.source} → 欺负 → ${token.target}`}</span></button></span>`).join('') + '<span class="sentence-period" aria-hidden="true">.</span>';
  $('#token-table').innerHTML = model.tokens.map(token => {
    const description = describeToken(token, model);
    return `<tr class="token-row" data-token="${token.id}"><td><button class="table-word" data-token="${token.id}" aria-label="选择第 ${token.id} 词"><span class="number">${pad(token.id)}</span><span class="token-lexeme">${token.word}</span></button></td><td><span class="pos-badge ${token.role}" title="${description.pos}">${description.shortPos}</span></td><td class="relation-text">${description.relation}</td></tr>`;
  }).join('');
  $('#structure-panel').innerHTML = renderBrackets(model);
  $('#syntax-map').innerHTML = renderSyntax(model);
  syncSyntaxToggle();
  $('#translation-text').textContent = model.meaning;
  if ($('#copy-fallback')) $('#copy-fallback').value = model.sentence;
  $('#relation-list').innerHTML = model.edges.map(edge => `<li><button data-token="${edge.token}">${edge.source} 组 → 欺负 → ${edge.target} 组</button><small>#${pad(edge.token)} · ${edge.kind === 'relative' ? '关系从句' : edge.kind === 'imperative' ? '祈使句' : '主句'}</small></li>`).join('');
  document.querySelectorAll('[data-count]').forEach(button => {
    const active = Number(button.dataset.count) === model.count;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#minus').disabled = model.count === 1;
  $('#plus').disabled = model.count === MAX_COUNT;
  renderArena();
  selectToken(selectedToken, false);
  editing.syncModel();
  updatePerformanceNote();
  jelly.refresh();
}

function highlight() {
  const token = model.tokens[selectedToken - 1];
  const related = new Set(token.role === 'verb' ? [token.source, token.target] : [token.group]);
  const group = model.groups.find(g => g.id === token.group);
  const clause = model.clauses.find(c => c.verb === token.id);
  let span = [token.id, token.id], targetNoun = null, explanation;
  if (token.role === 'city') {
    span = [token.id, group.nounToken];
    targetNoun = group.nounToken;
    explanation = `地名 #${pad(token.id)} → 修饰 ${group.id} 组名词 #${pad(targetNoun)}。它只说明这组水牛来自哪里。`;
  } else if (token.role === 'noun') {
    span = group.span;
    targetNoun = token.id;
    explanation = `${group.id} 组名词短语 = #${pad(span[0])}–#${pad(span[1])}。${group.children.length ? `框内 ${group.children.length} 段从句都修饰名词 #${pad(token.id)}。` : '这里没有附加关系从句。'}`;
  } else if (token.kind === 'relative') {
    span = clause.span;
    targetNoun = model.groups.find(g => g.id === token.target).nounToken;
    explanation = `橙色范围 #${pad(span[0])}–#${pad(span[1])} 整段 → 修饰 ${token.target} 组名词 #${pad(targetNoun)}；其中 ${token.source} 组欺负 ${token.target} 组。`;
  } else explanation = `主句动作 #${pad(token.id)}：${token.source} 组 → 欺负 → ${token.target} 组。`;
  $('#scope-explanation').textContent = explanation;
  document.querySelectorAll('[data-token]').forEach(element => {
    const active = Number(element.dataset.token) === selectedToken;
    element.classList.toggle('active', active);
    element.classList.toggle('scope-active', Number(element.dataset.token) >= span[0] && Number(element.dataset.token) <= span[1]);
    element.classList.toggle('modifier-target', Number(element.dataset.token) === targetNoun);
    if (element.classList.contains('word')) element.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-group]').forEach(element => {
    element.classList.toggle('selected', element.dataset.group === selectedGroup);
    element.classList.toggle('related', related.has(element.dataset.group));
  });
  document.querySelectorAll('[data-edge]').forEach(element => element.classList.toggle('selected', Number(element.dataset.edge) === selectedToken));
  document.querySelectorAll('[data-np]').forEach(element => element.classList.toggle('np-selected', element.dataset.np === selectedGroup));
  document.querySelectorAll('[data-clause-box]').forEach(element => element.classList.toggle('clause-selected', Number(element.dataset.clauseBox) === selectedToken));
}

function showFighter(groupID) {
  const group = model.groups.find(g => g.id === groupID);
  if (!group) return;
  selectedGroup = groupID;
  const relationLinks = (edges, key) => edges.length ? edges.map(edge => `<button data-group-select="${edge[key]}">${edge[key]} 组</button>`).join('、') : '暂无，暂时安全';
  const banter = banterFor(group, model, banterRounds.get(group.id) || 0);
  $('#fighter-detail').innerHTML = `<div class="detail-group">${group.id} 组${group.implicit ? ' · 省略' : '水牛'}<small>${group.implicit ? (group.id === model.subject ? '主语 you' : '未写出的宾语') : group.city ? `Buffalo 出品 · #${pad(group.nounToken)}` : `产地不详 · #${pad(group.nounToken)}`}</small></div><div class="fight-stat"><span>挨打名单</span>被谁欺负：<b>${relationLinks(group.incoming, 'source')}</b></div><div class="fight-stat"><span>出拳对象</span>正在欺负：<b>${relationLinks(group.outgoing, 'target')}</b></div><div class="fighter-quote"><p><strong>${group.id} 组 · ${banter.nickname}</strong>“${banter.quote}”</p><button id="new-quip">♫ 换句狠话</button></div>`;
  editing.select(group.id);
}

function selectToken(id, scroll = true) {
  const token = model.tokens[id - 1];
  if (!token) return;
  selectedToken = id;
  const description = describeToken(token, model);
  $('#token-detail').innerHTML = `<div class="detail-top"><b>#${pad(id)} ${token.word} · ${description.pos}</b><span>${description.gloss}</span></div><p>${description.detail}</p>`;
  showFighter(token.role === 'verb' ? token.source : token.group);
  highlight();
  if (scroll) {
    const word = $(`#sentence [data-token="${id}"]`);
    const row = $(`#token-table tr[data-token="${id}"]`);
    keepInContainer(word, $('#sentence'));
    keepInContainer(row, $('.table-scroll'));
    camera.focus(arenaLayout.points.get(selectedGroup));
  }
}

function keepInContainer(element, container) {
  const itemRect = element.getBoundingClientRect(), containerRect = container.getBoundingClientRect();
  if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) container.scrollTop += itemRect.top - containerRect.top - 38;
  if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) container.scrollLeft += itemRect.left - containerRect.left - 20;
}

function selectGroup(id) {
  const group = model.groups.find(g => g.id === id);
  if (!group) return;
  if (group.nounToken) selectToken(group.nounToken);
  else { showFighter(id); highlight(); }
}

function generate(count, options = {}) {
  try {
    const next = interpret(count, options);
    banterRounds.clear();
    $('#arena-viewport').scrollTop = 0;
    $('#sentence').scrollTop = 0;
    $('.table-scroll').scrollTop = 0;
    editing.commit(next, { group: next.subject, message: `已开赛 · ${count} 个 buffalo。` });
  } catch (error) {
    $('#input-error').textContent = error.message;
    $('#input-error').hidden = false;
    $('#count-input').setAttribute('aria-invalid', 'true');
    $('#count-input').focus();
  }
}

function applyModel(next, preferredGroup) {
  model = next;
  const group = next.groups.find(g => g.id === preferredGroup) || next.groups.find(g => g.nounToken) || next.groups[0];
  selectedGroup = group.id;
  selectedToken = group.nounToken || next.mainVerb;
  $('#count-input').value = next.count;
  $('#count-input').removeAttribute('aria-invalid');
  $('#input-error').hidden = true;
  render();
}

$('#generator-form').addEventListener('submit', event => { event.preventDefault(); generate(Number($('#count-input').value)); });
const currentInputCount = () => {
  const value = Number($('#count-input').value);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_COUNT ? value : model.count;
};
$('#count-input').addEventListener('input', () => {
  $('#minus').disabled = currentInputCount() === 1;
  $('#plus').disabled = currentInputCount() === MAX_COUNT;
});
$('#minus').addEventListener('click', () => generate(Math.max(1, currentInputCount() - 1)));
$('#plus').addEventListener('click', () => generate(Math.min(MAX_COUNT, currentInputCount() + 1)));
$('#random-count').addEventListener('click', () => generate(7 + Math.floor(Math.random() * 34)));
$('#reroll').addEventListener('click', () => generate(model.count));
$('#classic-count').addEventListener('click', () => generate(8, { classic: true }));
$('#zoom-in').addEventListener('click', () => camera.zoom(1.35));
$('#zoom-out').addEventListener('click', () => camera.zoom(1 / 1.35));
$('#zoom-fit').addEventListener('click', () => camera.fit());
$('#zoom-focus').addEventListener('click', () => camera.focus(arenaLayout.points.get(selectedGroup), true));
function updateStageControls() {
  const active = document.fullscreenElement === $('#arena-stage') || $('#arena-stage').classList.contains('stage-expanded');
  $('#arena-fullscreen').textContent = active ? '↙ 退出全屏' : '⛶ 全屏';
  $('#arena-fullscreen').setAttribute('aria-label', active ? '退出全屏比赛图' : '全屏查看比赛图');
  jelly.refresh();
}
function closeExpandedStage() {
  $('#arena-stage').classList.remove('stage-expanded');
  document.body.classList.remove('stage-overlay-open');
  updateStageControls();
}
$('#arena-fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  if ($('#arena-stage').classList.contains('stage-expanded')) { closeExpandedStage(); return; }
  try { await $('#arena-stage').requestFullscreen(); }
  catch {
    $('#arena-stage').classList.add('stage-expanded');
    document.body.classList.add('stage-overlay-open');
    updateStageControls();
  }
});
document.addEventListener('fullscreenchange', updateStageControls);
function syncSyntaxToggle() {
  const boxes = [...document.querySelectorAll('.relative-box')];
  const expanded = boxes.length > 0 && boxes.every(box => box.open);
  $('#expand-syntax').setAttribute('aria-expanded', String(expanded));
  $('#expand-syntax').textContent = expanded ? '收起所有从句' : '展开所有从句';
  $('#expand-syntax').disabled = boxes.length === 0;
}
$('#syntax-map').addEventListener('toggle', syncSyntaxToggle, true);
$('#expand-syntax').addEventListener('click', () => {
  const expand = $('#expand-syntax').getAttribute('aria-expanded') !== 'true';
  document.querySelectorAll('.relative-box').forEach(box => { box.open = expand; });
  $('#expand-syntax').setAttribute('aria-expanded', String(expand));
  $('#expand-syntax').textContent = expand ? '收起所有从句' : '展开所有从句';
});
document.addEventListener('click', event => {
  if (event.target.closest('#new-quip')) {
    const group = model.groups.find(g => g.id === selectedGroup);
    const old = banterFor(group, model, banterRounds.get(group.id) || 0).quote;
    let round = (banterRounds.get(group.id) || 0) + 1;
    while (banterFor(group, model, round).quote === old) round++;
    banterRounds.set(group.id, round);
    const banter = banterFor(group, model, round);
    $(`#arena [data-group="${group.id}"] .comic-bubble`).innerHTML = bubbleMarkup(banter.quote);
    $(`#arena [data-group="${group.id}"] title`).textContent = `${group.id} 组水牛 · ${banter.nickname}：${banter.quote}`;
    showFighter(group.id);
    $('#new-quip').focus({ preventScroll: true });
    return;
  }
  const preset = event.target.closest('[data-count]');
  if (preset) generate(Number(preset.dataset.count));
  const token = event.target.closest('[data-token]');
  if (token) {
    if (token.classList.contains('clause-caption')) event.preventDefault();
    selectToken(Number(token.dataset.token));
  }
  const edge = event.target.closest('[data-edge-token]');
  if (edge) selectToken(Number(edge.dataset.edgeToken));
  const group = event.target.closest('[data-group], [data-group-select]');
  if (group) {
    const id = group.dataset.group || group.dataset.groupSelect;
    if (group.closest('#arena') && editing.handleGroupClick(id)) return;
    selectGroup(id);
  }
});
$('#arena').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  event.target.closest('[data-group], [data-edge-token]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

function setTab(target) {
  const words = target === 'words';
  for (const name of ['words', 'structure']) {
    const active = (name === 'words') === words;
    $(`#${name}-tab`).setAttribute('aria-selected', String(active));
    $(`#${name}-tab`).tabIndex = active ? 0 : -1;
    $(`#${name}-panel`).hidden = !active;
  }
}
$('#words-tab').addEventListener('click', () => setTab('words'));
$('#structure-tab').addEventListener('click', () => setTab('structure'));
$('.tabs').addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const target = event.key === 'Home' ? 'words' : event.key === 'End' ? 'structure' : $('#words-tab').getAttribute('aria-selected') === 'true' ? 'structure' : 'words';
  setTab(target);
  $(`#${target}-tab`).focus();
});

$('#copy-sentence').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(model.sentence);
    toast(`已复制 ${model.count} 个 buffalo。`);
  } catch {
    toast('浏览器未允许复制；可以在下方选择句子。');
    if (!$('#copy-fallback')) {
      const fallback = document.createElement('textarea');
      fallback.id = 'copy-fallback';
      fallback.setAttribute('aria-label', '可手动复制的完整句子');
      fallback.readOnly = true;
      fallback.style.cssText = 'width:100%;min-height:72px;margin-top:12px;background:var(--paper);border:1px solid var(--line);padding:10px;color:var(--ink)';
      $('.sentence-card').append(fallback);
    }
    $('#copy-fallback').value = model.sentence;
    $('#copy-fallback').focus();
    $('#copy-fallback').select();
  }
});

function audioStatus(message) { $('#audio-status').textContent = message; }
function updateSoundLabels() {
  $('#track-bpm').textContent = `${bpm} BPM / 大拍 ${Number((bpm / 2).toFixed(2))} BPM`;
  $('#stage-audio-label').textContent = `${trackURL ? '已选音乐' : '无音乐'} · ${bpm} BPM`;
  $('#audio-filename').textContent = trackName || '未选择文件';
  $('#audio-filename').title = trackName;
  $('#clear-audio').disabled = !trackURL;
  const ready = Boolean(trackURL) && audio.readyState >= 1;
  $('#restart-track').disabled = !ready;
  $('#align-beat').disabled = !ready;
}
function updatePerformanceNote() {
  const quality = performanceProfile(model.count);
  document.body.classList.toggle('jelly-light', jellyOn && quality.light);
  document.querySelectorAll('[data-performance-note]').forEach(note => {
    note.hidden = !quality.light;
    note.textContent = `${model.count} 词，牛群有点挤：Q 弹可能卡顿。${jellyOn ? '已自动减轻动画' : '开启后会自动减轻动画'}；随时关闭 Q 弹或按 Esc，让水牛落地。`;
  });
}
async function syncAudio() {
  if (!jellyOn) {
    audio.pause();
    audioStatus(trackURL ? '音乐已暂停。打开 Q 弹可继续播放。' : '还没选音乐。直接打开 Q 弹也能蹦。');
    return;
  }
  if (!trackURL) { audioStatus(`无音乐蹦迪中 · ${bpm} BPM。可随时关闭 Q 弹。`); return; }
  const playingURL = trackURL;
  try {
    await audio.play();
    if (playingURL !== trackURL) return;
    if (!jellyOn) { audio.pause(); return; }
    audioStatus(`音乐循环播放中 · ${bpm} BPM。水牛跟着播放进度一起蹦。`);
  } catch (error) {
    if (error.name === 'AbortError' || playingURL !== trackURL) return;
    setJelly(false);
    audioStatus(error.name === 'NotAllowedError' ? '浏览器阻止了音乐播放，请再点一次 Q 弹开关。' : '这段音乐暂时播不了，请换一份 MP3、M4A 或 WAV 文件。');
  }
}
function setJelly(value) {
  const starting = value && !jellyOn;
  jellyOn = value;
  if (value && !trackURL) silentClock.start();
  else silentClock.pause();
  document.body.classList.toggle('jelly-on', jellyOn);
  $('#jelly-toggle').setAttribute('aria-checked', String(jellyOn));
  $('#jelly-state').textContent = jellyOn ? '开' : '关';
  $('#stage-jelly-toggle').setAttribute('aria-checked', String(jellyOn));
  $('#stage-jelly-state').textContent = jellyOn ? '开' : '关';
  $('#jelly-land').hidden = !jellyOn;
  if (!jellyOn) document.querySelectorAll('.beat-active').forEach(dot => dot.classList.remove('beat-active'));
  jelly.set(jellyOn);
  updatePerformanceNote();
  if (starting && performanceProfile(model.count).light) toast('牛群有点挤，已自动减轻动画；卡顿时可随时关闭 Q 弹。');
  syncAudio();
}
$('#jelly-toggle').addEventListener('click', () => setJelly(!jellyOn));
$('#stage-jelly-toggle').addEventListener('click', () => setJelly(!jellyOn));
$('#jelly-land').addEventListener('click', () => setJelly(false));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (jellyOn) setJelly(false);
  if ($('#arena-stage').classList.contains('stage-expanded')) closeExpandedStage();
});
function clearAudio() {
  setJelly(false);
  audio.removeAttribute('src');
  audio.load();
  if (trackURL) URL.revokeObjectURL(trackURL);
  trackURL = null;
  trackName = '';
  beatOffset = 0;
  silentClock.reset();
  $('#audio-file').value = '';
  updateSoundLabels();
  updateTrackProgress();
  audioStatus('音乐已移除。直接打开 Q 弹也能蹦。');
}
$('#audio-file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  try { validateAudioFile(file); }
  catch (error) { audioStatus(error.message); event.target.value = ''; return; }
  setJelly(false);
  const oldURL = trackURL;
  trackURL = URL.createObjectURL(file);
  trackName = file.name;
  beatOffset = 0;
  silentClock.reset();
  audio.src = trackURL;
  audio.load();
  if (oldURL) URL.revokeObjectURL(oldURL);
  updateSoundLabels();
  updateTrackProgress();
  audioStatus('音乐已选好。填写歌曲 BPM，再打开 Q 弹开始播放。');
});
$('#clear-audio').addEventListener('click', clearAudio);
audio.addEventListener('error', () => {
  if (!trackURL) return;
  clearAudio();
  audioStatus('这段音频无法播放，请换一份 MP3、M4A 或 WAV 文件。也可以不配音乐直接蹦。');
});
$('#bpm-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const next = parseBpm($('#bpm-input').value);
    beatOffset = danceTime();
    bpm = next;
    $('#bpm-input').value = bpm;
    $('#bpm-input').removeAttribute('aria-invalid');
    $('#bpm-error').hidden = true;
    updateSoundLabels();
    if (jellyOn) syncAudio();
    toast(`已切换为 ${bpm} BPM；水牛每两拍跳一次。`);
  } catch (error) {
    $('#bpm-error').textContent = `${error.message} 当前仍使用 ${bpm} BPM。`;
    $('#bpm-error').hidden = false;
    $('#bpm-input').setAttribute('aria-invalid', 'true');
    $('#bpm-input').focus();
  }
});
$('#volume').addEventListener('input', event => {
  audio.volume = Number(event.target.value) / 100;
  $('#volume-value').textContent = `${event.target.value}%`;
});
const trackTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
let scrubbing = false;
function updateTrackProgress() {
  const duration = audio.duration;
  const ready = Number.isFinite(duration) && duration > 0;
  $('#audio-seek').disabled = !ready;
  if (!scrubbing) $('#audio-seek').value = ready ? audio.currentTime / duration * 100 : 0;
  $('#track-time').textContent = `${trackTime(audio.currentTime)} / ${ready ? trackTime(duration) : '--:--'}`;
}
for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'emptied']) audio.addEventListener(event, updateTrackProgress);
audio.addEventListener('loadedmetadata', updateSoundLabels);
$('#audio-seek').addEventListener('input', () => { scrubbing = true; });
$('#audio-seek').addEventListener('change', event => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Number(event.target.value) / 100 * audio.duration;
  scrubbing = false;
  updateTrackProgress();
});
for (const event of ['pointercancel', 'blur']) $('#audio-seek').addEventListener(event, () => { scrubbing = false; updateTrackProgress(); });
$('#restart-track').addEventListener('click', () => { audio.currentTime = 0; if (!jellyOn) setJelly(true); else syncAudio(); });
$('#align-beat').addEventListener('click', () => {
  if (audio.paused || !trackURL) { toast('先选音乐并打开 Q 弹，听到重拍时再点这里。'); return; }
  beatOffset = audio.currentTime;
  toast('已对齐这一拍。水牛会跟着同一节奏继续蹦。');
});
$('#dismiss-help').addEventListener('click', () => { $('#quick-help').hidden = true; $('#show-help').hidden = false; $('#show-help').focus({ preventScroll: true }); });
$('#show-help').addEventListener('click', () => { $('#quick-help').hidden = false; $('#show-help').hidden = true; $('#dismiss-help').focus({ preventScroll: true }); });
window.addEventListener('pagehide', () => { jelly.set(false); silentClock.pause(); audio.pause(); });
window.addEventListener('pageshow', event => { if (event.persisted) setJelly(false); });

render();
updateSoundLabels();
updateTrackProgress();
