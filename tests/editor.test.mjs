import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTree, interpret, treeOf, MAX_COUNT } from '../src/engine.js';
import { branchIDs, editTree, EditHistory, moveTargets, parseSentence, repairDraft } from '../src/editor.js';
import { layoutTree } from '../src/graph.js';
import { renderSyntax, renderBrackets } from '../src/syntax.js';

function consistent(model) {
  assert.equal(model.tokens.length, model.count);
  assert.equal(model.sentence.split(' ').length, model.count);
  assert.equal(model.edges.length, model.groups.length - 1);
  const groups = new Map(model.groups.map(g => [g.id, g]));
  for (const group of model.groups) {
    if (!group.implicit) assert.equal(model.tokens[group.nounToken - 1].group, group.id);
    if (group.city) assert.equal(group.cityToken + 1, group.nounToken);
    for (const child of group.children) assert.equal(groups.get(child).parent, group.id);
  }
  for (const clause of model.clauses.filter(c => c.kind === 'relative')) {
    const source = groups.get(clause.source), target = groups.get(clause.target);
    assert.deepEqual(clause.span, [source.span[0], source.span[1] + 1]);
    assert.equal(clause.verb, clause.span[1]);
    assert.ok(target.nounToken < clause.span[0] && clause.span[1] <= target.span[1]);
  }
  assert.equal(layoutTree(model).points.size, groups.size);
  assert.equal(compileTree(treeOf(model)).sentence, model.sentence);
  assert.ok(parseSentence(model.sentence).ok);
}

test('graph editing changes the actual sentence and keeps every role/reference synchronized', () => {
  const classic = interpret(8, { classic: true, seed: 6 }), original = JSON.stringify(classic);
  let model = editTree(classic, { type: 'city', group: 'B' });
  assert.equal(model.count, 7);
  assert.equal(model.sentence, 'Buffalo buffalo buffalo buffalo buffalo Buffalo buffalo.');
  model = editTree(model, { type: 'add', group: 'B' });
  const added = model.groups.at(-1).id;
  assert.equal(model.count, 9);
  assert.equal(model.groups.at(-1).parent, 'B');
  const before = model.sentence;
  model = editTree(model, { type: 'move', group: 'B', target: 'C' });
  assert.equal(model.groups.find(g => g.id === 'B').parent, 'C');
  assert.equal(model.groups.find(g => g.id === added).parent, 'B');
  assert.equal(model.count, 9);
  assert.notEqual(model.sentence, before);
  consistent(model);
  model = editTree(model, { type: 'remove', group: 'B' });
  assert.deepEqual(model.groups.map(g => g.id), ['A', 'C']);
  assert.equal(model.count, 5);
  consistent(model);
  model = editTree(model, { type: 'swap' });
  assert.equal(model.subject, 'C');
  assert.equal(model.object, 'A');
  consistent(model);
  assert.equal(JSON.stringify(classic), original, 'transactions must not mutate their input');
});

test('self-links, cycles, root removal, disconnected or duplicate trees fail atomically', () => {
  let model = interpret(8, { classic: true, seed: 9 });
  model = editTree(model, { type: 'add', group: 'B' });
  const added = model.groups.at(-1).id, original = JSON.stringify(model);
  assert.deepEqual([...branchIDs(model, 'B')], ['B', added]);
  assert.deepEqual(moveTargets(model, 'B'), ['C']);
  for (const target of ['B', added, 'A', 'MISSING']) assert.throws(() => editTree(model, { type: 'move', group: 'B', target }));
  assert.throws(() => editTree(model, { type: 'remove', group: model.subject }));
  const loop = treeOf(model);
  loop.groups.find(g => g.id === added).children.push('B');
  assert.throws(() => compileTree(loop));
  const disconnected = treeOf(model);
  disconnected.groups.find(g => g.id === 'A').children = [];
  assert.throws(() => compileTree(disconnected));
  const duplicate = treeOf(model);
  duplicate.groups.find(g => g.id === 'C').children.push('B');
  assert.throws(() => compileTree(duplicate));
  assert.equal(JSON.stringify(model), original);
});

test('word limits and one/two-word ellipsis cannot be broken by editing', () => {
  for (const count of [1, 2]) {
    const model = interpret(count);
    assert.throws(() => editTree(model, { type: 'city', group: 'B' }));
    const full = editTree(model, { type: 'materialize' });
    assert.equal(full.count, 3);
    assert.equal(full.sentence, 'buffalo buffalo buffalo.');
    consistent(full);
  }
  const large = interpret(MAX_COUNT, { seed: 22 }), original = JSON.stringify(large);
  const noCity = large.groups.find(g => !g.city);
  assert.throws(() => editTree(large, { type: 'city', group: noCity.id }));
  assert.throws(() => editTree(large, { type: 'add', group: large.subject }));
  assert.equal(JSON.stringify(large), original);
});

test('reordering opponents moves whole phrases without changing their relations or word count', () => {
  let model = interpret(3, { seed: 2 });
  model = editTree(model, { type: 'add', group: 'A' });
  model = editTree(model, { type: 'add', group: 'A' });
  model = editTree(model, { type: 'city', group: 'C' });
  const next = editTree(model, { type: 'order', group: 'C', direction: 1 });
  assert.deepEqual(next.groups[0].children, ['D', 'C']);
  assert.equal(next.count, model.count);
  assert.notEqual(next.sentence, model.sentence);
  assert.deepEqual(next.edges.map(e => `${e.source}>${e.target}`).sort(), model.edges.map(e => `${e.source}>${e.target}`).sort());
  consistent(next);
});

test('undo/redo restores complete readings, drops abandoned redo and bounds history', () => {
  const start = interpret(8, { classic: true, seed: 8 }), history = new EditHistory(start, 3);
  const next = editTree(start, { type: 'add', group: 'A' });
  history.push(next);
  assert.deepEqual(history.undo(), start);
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.redo(), next);
  history.undo();
  const alternate = editTree(start, { type: 'swap' });
  history.push(alternate);
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(), null);
  let current = alternate;
  for (let i = 0; i < 10; i++) { current = editTree(current, { type: 'city', group: 'A' }); history.push(current); }
  assert.equal(history.items.length, 4);
  for (let i = 0; i < 3; i++) assert.ok(history.undo());
  assert.equal(history.undo(), null);
});

// Independent small CFG recognizer: exhaustive capitalization strings exercise
// acceptance, not just round-tripping this parser's own output.
function grammarAccepts(words) {
  const n = words.length;
  if (n <= 2 && words.every(w => w === 'buffalo')) return true;
  const np = Array.from({ length: n + 1 }, () => Array(n + 1).fill(false));
  for (let length = 1; length <= n; length++) for (let start = 0; start + length <= n; start++) {
    const end = start + length;
    if (length === 1 && words[start] === 'buffalo') np[start][end] = true;
    if (length === 2 && words[start] === 'Buffalo' && words[start + 1] === 'buffalo') np[start][end] = true;
    if (words[end - 1] !== 'buffalo') continue;
    for (let split = start + 1; split < end - 1; split++) if (np[start][split] && np[split][end - 1]) np[start][end] = true;
  }
  for (let verb = 1; verb < n - 1; verb++) if (np[0][verb] && words[verb] === 'buffalo' && np[verb + 1][n]) return true;
  return false;
}

test('direct editor accepts exactly the supported grammar for every capitalization string up to ten words', () => {
  for (let n = 1; n <= 10; n++) for (let mask = 0; mask < 2 ** n; mask++) {
    const words = Array.from({ length: n }, (_, i) => mask & 2 ** i ? 'Buffalo' : 'buffalo');
    const result = parseSentence(words.join(' ') + '.');
    assert.equal(result.ok, grammarAccepts(words), words.join(' '));
    for (const { model } of result.candidates) assert.equal(model.sentence, words.join(' ') + '.');
  }
});

test('ambiguity is selectable, existing meaning is preserved and large drafts remain bounded', () => {
  const classic = interpret(8, { classic: true, seed: 1 });
  const current = parseSentence(classic.sentence, { current: classic });
  assert.equal(current.candidates[0].model, classic);
  assert.equal(current.candidates[0].label, '保留当前恩怨');
  const ambiguous = parseSentence('buffalo buffalo buffalo buffalo buffalo buffalo buffalo.');
  assert.equal(ambiguous.candidates.length, 3);
  assert.equal(new Set(ambiguous.candidates.map(c => c.signature)).size, 3);
  for (const count of [1, 2, 3, 8, 18, 32, 100, 999, 1000]) {
    const model = interpret(count, { seed: count * 17 });
    const result = parseSentence(model.sentence);
    assert.ok(result.ok, `count ${count}`);
    assert.ok(result.candidates.length <= 3);
    for (const candidate of result.candidates) consistent(candidate.model);
  }
});

test('invalid drafts stay uncommittable; friendly repairs themselves compile', () => {
  for (const text of ['', 'cow', '<script>alert(1)</script>', 'BUFFALO', 'buffalo, buffalo', 'Buffalo.', 'Buffalo Buffalo buffalo.', 'buffalo buffalo buffalo buffalo.', 'buffalo '.repeat(1001)]) {
    const result = parseSentence(text);
    assert.equal(result.ok, false, text);
    assert.equal(result.candidates.length, 0);
    assert.ok(result.error);
  }
  const repairs = repairDraft('buffalo buffalo buffalo buffalo.');
  assert.ok(repairs.length >= 2);
  for (const repair of repairs) assert.ok(parseSentence(repair.sentence).ok);
  assert.equal(parseSentence('  buffalo\n buffalo\t buffalo!  ').sentence, 'buffalo buffalo buffalo.');
});

test('extreme editable nesting keeps every token and modifier in a bounded-depth syntax view', () => {
  const model = parseSentence(Array(999).fill('buffalo').join(' ')).candidates.at(-1).model;
  assert.ok(model.groups.some(g => g.depth > 400));
  const html = renderSyntax(model), brackets = renderBrackets(model);
  assert.ok(html.includes('层级列表'));
  for (const token of model.tokens) assert.ok(html.includes(`data-token="${token.id}"`));
  for (const clause of model.clauses.filter(c => c.kind === 'relative')) {
    assert.ok(html.includes(`data-clause-box="${clause.verb}"`));
    assert.ok(html.includes(`整段修饰 ${clause.target} 组名词`));
    assert.ok(brackets.includes(`data-token="${clause.verb}"`));
  }
  let depth = 0, maximum = 0;
  for (const [tag] of html.matchAll(/<\/?(?:div|details)\b[^>]*>/g)) {
    depth += tag.startsWith('</') ? -1 : 1;
    maximum = Math.max(maximum, depth);
  }
  assert.equal(depth, 0);
  assert.ok(maximum < 70, `HTML nesting depth ${maximum}`);
});
