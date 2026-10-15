import { MAX_COUNT, compileTree, treeOf } from './engine.js';
import { EditHistory, branchIDs, editTree, moveTargets, parseSentence, repairDraft } from './editor.js';

const $ = selector => document.querySelector(selector);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createEditing({ getModel, applyModel, toast, refreshJelly }) {
  const history = new EditHistory(getModel());
  let selected = getModel().subject, editing = false, linking = null;
  let dirty = false, timer, candidates = [], chosen = 0;
  const draft = $('#sentence-draft');
  draft.value = getModel().sentence;

  function syncHistory() {
    document.querySelectorAll('[data-edit-action="undo"]').forEach(b => { b.disabled = !history.canUndo; });
    document.querySelectorAll('[data-edit-action="redo"]').forEach(b => { b.disabled = !history.canRedo; });
  }

  function markTargets() {
    const targets = new Set(linking ? moveTargets(getModel(), linking) : []);
    $('#arena').classList.toggle('choosing-target', Boolean(linking));
    document.querySelectorAll('#arena [data-group]').forEach(node => {
      const id = node.dataset.group;
      node.classList.toggle('move-source', id === linking);
      node.classList.toggle('move-target', targets.has(id));
      node.classList.toggle('move-blocked', Boolean(linking) && id !== linking && !targets.has(id));
    });
  }

  function cancelLink(message = '') {
    linking = null;
    $('#move-picker').hidden = true;
    markTargets();
    if (message) $('#edit-status').textContent = message;
  }

  function select(id) {
    if (linking && id !== linking) cancelLink();
    selected = id;
    const model = getModel(), group = model.groups.find(g => g.id === id);
    if (!group) return;
    const implicit = model.groups.some(g => g.implicit);
    const branch = branchIDs(model, id), cost = [...branch].reduce((sum, key) => sum + 2 + Number(model.groups.find(g => g.id === key).city), 0);
    const siblings = group.parent ? model.groups.find(g => g.id === group.parent).children : [];
    const index = siblings.indexOf(id);
    $('#edit-group-title').textContent = `${id} 组${group.implicit ? ' · 还没写出来' : '水牛'}`;
    $('#edit-group-info').textContent = group.parent ? `正在欺负 ${group.parent} 组 · ${group.children.length} 组对手跟着它` : implicit ? '先让省略的双方出现，再开始安排。' : `主赛${id === model.subject ? '发起方' : '被挑战方'} · 点其他水牛可编辑它们`;
    $('#edit-word-count').textContent = `✓ 正式句子 ${model.count} 词`;
    $('#edit-materialize').hidden = !implicit;
    $('#edit-city').textContent = group.city ? '摘掉布法罗产地牌 · −1 词' : '挂上布法罗产地牌 · +1 词';
    $('#edit-city').disabled = implicit || (!group.city && model.count === MAX_COUNT);
    $('#edit-add').textContent = `+ 添个对手欺负 ${id} · +2 词`;
    $('#edit-add').disabled = implicit || model.count + 2 > MAX_COUNT;
    $('#edit-move').textContent = `⤳ 改 ${id} 欺负谁 · 词数不变`;
    $('#edit-move').disabled = implicit || !group.parent || !moveTargets(model, id).length;
    $('#edit-swap').disabled = implicit;
    $('#edit-swap').textContent = `⇄ 主赛 ${model.subject} / ${model.object} 互换 · 词数不变`;
    $('#edit-remove').textContent = group.parent ? `撤掉 ${id}${branch.size > 1 ? ` 及 ${branch.size - 1} 组对手` : ' 组'} · −${cost} 词` : '主赛双方留场';
    $('#edit-remove').disabled = implicit || !group.parent;
    $('#edit-order').hidden = siblings.length < 2;
    $('[data-edit-action="earlier"]').disabled = index <= 0;
    $('[data-edit-action="later"]').disabled = index < 0 || index >= siblings.length - 1;
    if (!linking) $('#edit-status').textContent = implicit ? '补齐双方会得到 3 词句，并同步更新比赛图。' : group.parent ? `${id} 改对象时，会带着自己的对手一起搬家。撤退也会带走整条分支；随时可以撤销。` : '点水牛选中它，再安排对手。主赛双方可以互换；新增对手会自动接入句子。';
    markTargets();
  }

  function setEditing(value) {
    editing = value;
    if (!value) cancelLink();
    $('#herd-editor').hidden = !value;
    $('#arena-edit-toggle').setAttribute('aria-expanded', String(value));
    $('#arena-edit-toggle').textContent = value ? '✓ 完成编辑' : '✎ 编辑恩怨';
    $('#arena-stage').classList.toggle('editing-on', value);
    select(selected);
    refreshJelly();
  }

  function commit(next, { group = selected, message = '恩怨已更新，句子也排好了。' } = {}) {
    history.push(next);
    cancelLink();
    applyModel(next, group);
    toast(message);
  }

  function doAction(action) {
    try {
      const old = getModel(), next = editTree(old, action);
      let group = action.group || selected;
      if (action.type === 'add') group = next.groups.at(-1).id;
      if (action.type === 'remove') group = old.groups.find(g => g.id === action.group).parent;
      const delta = next.count - old.count;
      commit(next, { group, message: `已更新 · ${old.count} → ${next.count} 词${delta ? `（${delta > 0 ? '+' : ''}${delta}）` : ' · 词数不变'}` });
    } catch (error) {
      $('#edit-status').textContent = error.message;
      toast(error.message);
    }
  }

  function moveTo(target) {
    if (!linking) return false;
    if (!moveTargets(getModel(), linking).includes(target)) {
      $('#edit-status').textContent = '这组暂时不能接：请点绿色亮圈，避免自己欺负自己、接成环或重复原来的恩怨。';
      return true;
    }
    doAction({ type: 'move', group: linking, target });
    return true;
  }

  function showPreview() {
    document.querySelectorAll('[data-reading]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.reading) === chosen)));
    const next = candidates[chosen]?.model;
    if (!next) return;
    $('#draft-preview').hidden = false;
    $('#draft-preview').innerHTML = `<p>${escape(next.meaning)}</p><div class="preview-words" aria-label="草稿逐词身份">${next.tokens.map(t => `<span class="preview-word ${t.role}" title="第 ${t.id} 词"><small>${t.id}</small>${t.word}<b>${t.role === 'city' ? `产地 → ${t.group}` : t.role === 'noun' ? `${t.group} 组水牛` : `${t.source} → ${t.target}`}</b></span>`).join('')}</div><details><summary>核对全部 ${next.edges.length} 条恩怨</summary><ul>${next.edges.map(e => `<li>${e.source} 组 → 欺负 → ${e.target} 组${e.kind === 'relative' ? `（这段说明 ${e.target} 组）` : '（主赛）'}</li>`).join('')}</ul></details>`;
    const live = getModel();
    const unchanged = next.subject === live.subject && next.object === live.object && JSON.stringify(treeOf(next).groups) === JSON.stringify(treeOf(live).groups);
    $('#apply-draft').disabled = unchanged;
    $('#apply-draft').textContent = unchanged ? '这就是当前正式读法' : `应用这份读法 · ${next.count} 词 → 同步比赛图`;
  }

  function analyzeDraft() {
    clearTimeout(timer);
    const current = getModel(), result = parseSentence(draft.value, { seed: current.seed, current });
    candidates = result.candidates;
    chosen = 0;
    draft.setAttribute('aria-invalid', String(!result.ok));
    $('#draft-status').classList.toggle('draft-error', !result.ok);
    $('#draft-candidates').replaceChildren();
    $('#draft-preview').hidden = true;
    $('#apply-draft').disabled = true;
    $('#draft-repairs').replaceChildren();
    $('#draft-count').textContent = result.ok ? `正式 ${current.count} 词 → 草稿 ${result.count} 词` : `正式 ${current.count} 词 · 保持有效`;
    if (!result.ok) {
      $('#draft-status').textContent = result.error;
      const repairs = repairDraft(draft.value, { seed: current.seed });
      for (const repair of repairs) {
        const button = document.createElement('button');
        button.textContent = `${repair.label} · ${repair.count} 词`;
        button.addEventListener('click', () => { draft.value = repair.sentence; dirty = true; analyzeDraft(); });
        $('#draft-repairs').append(button);
      }
      return;
    }
    $('#draft-status').textContent = candidates.length > 1 ? `✓ 排得成句子。有 ${candidates.length} 种可选恩怨读法；点一张卡看预演，再应用。${dirty ? '' : '当前关系也在候选里。'}` : '✓ 排得成句子。下面是它的完整比赛安排；应用后同步所有视图。';
    $('#draft-candidates').innerHTML = candidates.map(({ model: next, label }, i) => {
      const root = next.groups.find(g => g.id === next.subject), object = next.groups.find(g => g.id === next.object);
      const name = g => g.implicit ? g.id === next.subject ? '省略的你' : '省略的对象' : `${g.id} 组${g.city ? ' · 布法罗' : ''}`;
      return `<button class="reading-card" data-reading="${i}" aria-pressed="${i === 0}"><span>${label}</span><b>${name(root)} <i>→</i> ${name(object)}</b><small>主赛 · ${next.groups.filter(g => !g.implicit).length} 组选手 / ${next.edges.length} 条恩怨<br>${next.edges.filter(e => e.kind === 'relative').slice(0, 4).map(e => `${e.source} 欺负 ${e.target}`).join(' · ') || '没有额外对手'}${next.edges.length > 5 ? ' …' : ''}</small></button>`;
    }).join('');
    showPreview();
  }

  function scheduleDraft() {
    dirty = true;
    clearTimeout(timer);
    candidates = [];
    $('#apply-draft').disabled = true;
    $('#draft-candidates').replaceChildren();
    $('#draft-preview').hidden = true;
    $('#draft-repairs').replaceChildren();
    $('#draft-status').textContent = '正在安排草稿里的水牛…';
    timer = setTimeout(analyzeDraft, 180);
  }

  function syncModel() {
    syncHistory();
    if (!getModel().groups.some(g => g.id === selected)) selected = getModel().subject;
    select(selected);
    if (!dirty) draft.value = getModel().sentence;
    if ($('#text-editor').open) analyzeDraft();
    else { clearTimeout(timer); candidates = []; $('#apply-draft').disabled = true; }
    $('.valid-reading').textContent = `✓ 正式句子已配好恩怨 · ${getModel().count} 词`;
  }

  $('#arena-edit-toggle').addEventListener('click', () => setEditing(!editing));
  $('#edit-on-map').addEventListener('click', () => { setEditing(true); $('#arena-stage').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#arena-edit-toggle').focus({ preventScroll: true }); });
  $('#edit-move').addEventListener('click', () => {
    linking = selected;
    const model = getModel(), targets = moveTargets(model, linking);
    $('#edit-target').innerHTML = '<option value="">点图中绿色亮圈，或在此选择</option>' + targets.map(id => `<option value="${id}">${id} 组 · ${model.groups.find(g => g.id === id).city ? '来自布法罗' : '产地随缘'}</option>`).join('');
    $('#apply-move').disabled = true;
    $('#move-picker').hidden = false;
    $('#edit-status').textContent = `现在为 ${linking} 组挑新对象。点图中绿色亮圈即可接上；它的整条对手分支会一起搬家。`;
    markTargets();
  });
  $('#edit-target').addEventListener('change', () => { $('#apply-move').disabled = !$('#edit-target').value; });
  $('#apply-move').addEventListener('click', () => moveTo($('#edit-target').value));
  $('#cancel-move').addEventListener('click', () => { cancelLink('已取消连线。原来的恩怨都还在。'); select(selected); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.editAction;
    if (action === 'undo' || action === 'redo') {
      const next = history[action]();
      if (!next) return;
      cancelLink();
      applyModel(next, selected);
      toast(action === 'undo' ? '已撤销，句子与图一起回到上一步。' : '已重做，句子与图一起更新。');
    } else doAction(action === 'earlier' || action === 'later' ? { type: 'order', group: selected, direction: action === 'earlier' ? -1 : 1 } : { type: action, group: selected });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && linking) { cancelLink(); select(selected); }
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const action = key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' ? 'redo' : null;
    if (action) { event.preventDefault(); $(`[data-edit-action="${action}"]`).click(); }
  });
  $('#text-editor').addEventListener('toggle', () => {
    document.body.classList.toggle('text-editing', $('#text-editor').open);
    if ($('#text-editor').open) analyzeDraft();
    refreshJelly();
  });
  draft.addEventListener('input', scheduleDraft);
  $('#draft-add').addEventListener('click', () => { draft.value = `${draft.value.trim().replace(/[.!！。]$/, '').trim()} buffalo.`.trim(); scheduleDraft(); });
  $('#draft-remove').addEventListener('click', () => { draft.value = draft.value.trim().replace(/[.!！。]$/, '').trim().split(/\s+/).slice(0, -1).join(' '); scheduleDraft(); });
  $('#draft-load').addEventListener('click', () => { dirty = false; draft.value = getModel().sentence; analyzeDraft(); });
  $('#draft-candidates').addEventListener('click', event => {
    const card = event.target.closest('[data-reading]');
    if (card) { chosen = Number(card.dataset.reading); showPreview(); }
  });
  $('#apply-draft').addEventListener('click', () => {
    const next = candidates[chosen]?.model;
    if (!next) return;
    // The parsed snapshot is still compiled at the commit boundary.
    const compiled = compileTree({ ...treeOf(next), classic: false, edited: true });
    dirty = false;
    commit(compiled, { group: compiled.subject, message: `草稿已上场 · ${compiled.count} 词，句子、比赛图与释义已同步。` });
  });
  return { commit, syncModel, select, handleGroupClick: id => linking ? moveTo(id) : false };
}
