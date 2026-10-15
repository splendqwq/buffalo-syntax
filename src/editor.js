import { compileTree, groupName, interpret, MAX_COUNT, treeOf } from './engine.js';

export function branchIDs(model, id) {
  const groups = new Map(model.groups.map(g => [g.id, g])), ids = new Set(), pending = [id];
  while (pending.length) {
    const group = groups.get(pending.pop());
    if (!group || ids.has(group.id)) continue;
    ids.add(group.id);
    pending.push(...group.children);
  }
  return ids;
}

export function moveTargets(model, source) {
  const group = model.groups.find(g => g.id === source);
  if (!group?.parent) return [];
  const blocked = branchIDs(model, source);
  return model.groups.filter(g => !g.implicit && !blocked.has(g.id) && g.id !== group.parent).map(g => g.id);
}

/** Transactions modify a copy and compile it before returning. A failure can
 * never leave the live model partially changed. */
export function editTree(model, action) {
  const tree = treeOf(model), byID = new Map(tree.groups.map(g => [g.id, g]));
  const group = byID.get(action.group);
  if (action.type === 'materialize') {
    tree.groups.forEach(g => { g.implicit = false; });
  } else {
    if (tree.groups.some(g => g.implicit)) throw new Error('先点“让双方上场”，再安排它们的恩怨。');
    if (action.type === 'swap') [tree.subject, tree.object] = [tree.object, tree.subject];
    else if (!group) throw new Error('请先选一组水牛。');
    else if (action.type === 'city') group.city = !group.city;
    else if (action.type === 'add') {
      const index = Math.max(...tree.groups.map(g => g.index)) + 1, id = groupName(index);
      tree.groups.push({ id, index, implicit: false, city: false, children: [] });
      group.children.push(id);
    } else if (action.type === 'remove') {
      const original = model.groups.find(g => g.id === group.id);
      if (!original.parent) throw new Error('主赛双方留在场上；可以撤掉它们的对手。');
      const removed = branchIDs(model, group.id);
      byID.get(original.parent).children = byID.get(original.parent).children.filter(id => id !== group.id);
      tree.groups = tree.groups.filter(g => !removed.has(g.id));
    } else if (action.type === 'move') {
      if (!moveTargets(model, group.id).includes(action.target)) throw new Error('请选择亮起的另一组水牛；不能欺负自己或自己的对手分支。');
      const parent = model.groups.find(g => g.id === group.id).parent;
      byID.get(parent).children = byID.get(parent).children.filter(id => id !== group.id);
      byID.get(action.target).children.push(group.id);
    } else if (action.type === 'order') {
      const parent = model.groups.find(g => g.id === group.id).parent;
      if (!parent) throw new Error('主赛双方可用“互换”改变顺序。');
      const siblings = byID.get(parent).children, index = siblings.indexOf(group.id), next = index + action.direction;
      if (![-1, 1].includes(action.direction) || next < 0 || next >= siblings.length) throw new Error('已经排在这一边的最前面了。');
      [siblings[index], siblings[next]] = [siblings[next], siblings[index]];
    } else throw new Error('未知编辑动作。');
  }
  tree.classic = false;
  tree.edited = true;
  return compileTree(tree);
}

export class EditHistory {
  constructor(model, limit = 50) { this.items = [treeOf(model)]; this.position = 0; this.limit = limit; }
  get canUndo() { return this.position > 0; }
  get canRedo() { return this.position < this.items.length - 1; }
  push(model) {
    const tree = treeOf(model);
    if (JSON.stringify(tree) === JSON.stringify(this.items[this.position])) return false;
    this.items.splice(this.position + 1);
    this.items.push(tree);
    if (this.items.length > this.limit + 1) this.items.shift();
    this.position = this.items.length - 1;
    return true;
  }
  undo() { if (!this.canUndo) return null; return compileTree(this.items[--this.position]); }
  redo() { if (!this.canRedo) return null; return compileTree(this.items[++this.position]); }
}

function readWords(text) {
  const input = text.trim().replace(/[.!！。]\s*$/, '').trim();
  if (!input) throw new Error('先放进一只 buffalo。正式句子会留在上方等你。');
  const words = input.split(/\s+/);
  if (words.length > MAX_COUNT) throw new Error(`草稿超过 ${MAX_COUNT} 词了；请减少一些水牛。`);
  if (words.some(word => word !== 'buffalo' && word !== 'Buffalo')) throw new Error('牛群里混进了别的文字。这里只收 buffalo 和 Buffalo，句末可加句号。');
  return words;
}

/** NP = [Buffalo] buffalo { NP buffalo }; S = NP buffalo NP.
 * Collapse each forced city+noun pair into a head unit. Suffix viability over
 * (position, open NP count, main-clause phase) is O(n²), instead of enumerating
 * exponentially many parses. Three policies recover distinct legal readings.
 */
export function parseSentence(text, { seed = 0, current = null } = {}) {
  let words;
  try { words = readWords(text); } catch (error) { return { ok: false, error: error.message, candidates: [] }; }
  const sentence = words.join(' ') + '.', candidates = [];
  const add = (model, label) => {
    const signature = JSON.stringify(treeOf(model).groups.map(g => [g.id, g.city, g.children])) + model.subject + model.object;
    if (!candidates.some(c => c.signature === signature)) candidates.push({ model, label, signature });
  };
  if (current?.sentence === sentence) add(current, '保留当前恩怨');
  if (words.length <= 2 && words.every(w => w === 'buffalo')) {
    add(interpret(words.length, { seed }), '省略选手的命令句');
    return { ok: true, sentence, count: words.length, candidates };
  }
  const units = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'Buffalo') {
      if (words[i + 1] !== 'buffalo') return { ok: false, error: `第 ${i + 1} 词的 Buffalo 是产地牌，后面需要紧跟一个小写 buffalo。`, candidates: [] };
      units.push(true);
      i++;
    } else units.push(false);
  }
  const length = units.length;
  if (length < 3 || length % 2 === 0) return { ok: false, error: '这些选手和动作暂时配不成一整句。试试在末尾补一个 buffalo，或删掉最后一个词。', candidates: [] };
  const maxDepth = (length + 1) / 2, stride = maxDepth + 2, width = stride * 2;
  const viable = Array.from({ length: length + 1 }, () => new Uint8Array(width));
  viable[length][stride + 1] = 1;
  for (let i = length - 1; i >= 0; i--) {
    const row = viable[i], next = viable[i + 1];
    for (let phase = 0; phase < 2; phase++) for (let depth = 0; depth <= maxDepth; depth++) {
      const offset = phase * stride;
      const head = depth < maxDepth && next[offset + depth + 1];
      const verb = !units[i] && (depth >= 2 ? next[offset + depth - 1] : depth === 1 && phase === 0 ? next[stride] : 0);
      row[offset + depth] = head || verb ? 1 : 0;
    }
  }
  if (!viable[0][0]) return { ok: false, error: '这排词还缺一位选手或一个动作，暂时排不成完整比赛。草稿不会替换正式句子。', candidates: [] };
  for (const [policy, label] of [['balanced', '均匀安排对手'], ['shallow', '尽早开始主赛'], ['deep', '一层层套娃']]) {
    const groups = [], stack = [];
    let phase = 0, subject, object;
    for (let i = 0; i < length; i++) {
      const depth = stack.length, next = viable[i + 1], offset = phase * stride;
      const canHead = depth < maxDepth && next[offset + depth + 1];
      const canVerb = !units[i] && (depth >= 2 ? next[offset + depth - 1] : depth === 1 && phase === 0 ? next[stride] : 0);
      const preferVerb = policy === 'shallow' || (policy === 'balanced' && (depth >= 2 || (depth === 1 && i >= length / 3)));
      if (canHead && (!canVerb || !preferVerb)) {
        const index = groups.length, group = { id: groupName(index), index, city: units[i], implicit: false, children: [] };
        if (depth) stack.at(-1).children.push(group.id);
        else if (!phase) subject = group.id;
        else object = group.id;
        groups.push(group);
        stack.push(group);
      } else if (depth >= 2) stack.pop();
      else { stack.pop(); phase = 1; }
    }
    const model = compileTree({ seed, edited: true, subject, object, groups });
    // Compiler round-trip is the final boundary before a reading is offered.
    if (model.sentence !== sentence) throw new Error('解析与句子生成不一致。');
    add(model, label);
  }
  return { ok: true, sentence, count: words.length, candidates: candidates.slice(0, 3) };
}

export function repairDraft(text, options) {
  let words;
  try { words = readWords(text); } catch { return []; }
  const repairs = [], attempts = [
    [words.concat('buffalo'), '末尾补一个 buffalo'],
    [words.slice(0, -1), '删去最后一个词'],
    [words.map(word => word.toLowerCase()), '先让所有水牛产地随缘']
  ];
  for (const [next, label] of attempts) {
    const sentence = next.join(' ') + '.';
    if (repairs.some(r => r.sentence === sentence)) continue;
    const result = parseSentence(sentence, options);
    if (result.ok) repairs.push({ label, sentence, count: result.count });
  }
  return repairs;
}
