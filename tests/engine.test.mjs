import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret, describeToken, groupName, MAX_COUNT } from '../src/engine.js';
import { layoutTree, fitCamera, zoomAt } from '../src/graph.js';
import { renderSyntax, renderBrackets } from '../src/syntax.js';

test('the classic eight-word sentence resolves B → A → C', () => {
  const result = interpret(8, { classic: true, seed: 123 });
  assert.equal(result.sentence, 'Buffalo buffalo Buffalo buffalo buffalo buffalo Buffalo buffalo.');
  assert.deepEqual(result.tokens.map(t => t.role), ['city', 'noun', 'city', 'noun', 'verb', 'verb', 'city', 'noun']);
  assert.deepEqual(result.edges.map(e => [e.source, e.target, e.token]), [['B', 'A', 5], ['A', 'C', 6]]);
  assert.match(result.meaning, /被 B 组欺负/);
});

test('every supported count has exactly x buffalo tokens and complete consistent references', () => {
  for (let count = 1; count <= MAX_COUNT; count++) {
    const result = interpret(count, { seed: count * 17 });
    assert.equal(result.tokens.length, count);
    assert.equal(result.sentence.match(/\bbuffalo\b/gi).length, count);
    assert.ok(result.tokens.every((token, index) => token.id === index + 1));
    const groups = new Map(result.groups.map(group => [group.id, group]));
    assert.equal(groups.size, result.groups.length);
    for (const token of result.tokens) {
      const description = describeToken(token, result);
      assert.ok(description.pos && description.relation && description.detail);
      if (token.role === 'city') {
        const group = groups.get(token.group);
        assert.equal(result.tokens[group.nounToken - 1].role, 'noun');
        assert.equal(group.cityToken, token.id);
        assert.equal(group.nounToken, token.id + 1);
      } else if (token.role === 'noun') {
        assert.equal(groups.get(token.group).nounToken, token.id);
        assert.equal(groups.get(token.group).implicit, false);
      } else {
        assert.ok(groups.has(token.source) && groups.has(token.target));
        assert.notEqual(token.source, token.target);
        const edge = result.edges.find(edge => edge.token === token.id);
        assert.equal(edge.source, token.source);
        assert.equal(edge.target, token.target);
        assert.ok(groups.get(token.source).outgoing.includes(edge));
        assert.ok(groups.get(token.target).incoming.includes(edge));
      }
    }
    if (count >= 3) {
      assert.ok(result.groups.every(g => !g.implicit));
      assert.equal(result.edges.filter(e => e.kind === 'main').length, 1);
      assert.equal(result.edges.length, result.groups.length - 1);
      // Every modifier is a contiguous phrase; its verb closes the child's NP.
      // Both sentence NPs may branch, and object relatives follow the main verb.
      const main = result.tokens.find(t => t.kind === 'main');
      assert.equal(main.source, result.subject);
      assert.equal(main.target, result.object);
      assert.equal(groups.get(result.subject).span[1] + 1, main.id);
      assert.equal(groups.get(result.object).span[0], main.id + 1);
      assert.equal(groups.get(result.object).span[1], count);
      for (const edge of result.edges.filter(e => e.kind === 'relative')) {
        const subject = groups.get(edge.source), object = groups.get(edge.target);
        const clause = result.clauses.find(c => c.verb === edge.token);
        assert.equal(subject.parent, object.id);
        assert.ok(object.children.includes(subject.id));
        assert.equal(clause.span[0], subject.span[0]);
        assert.equal(clause.span[1], subject.span[1] + 1);
        assert.equal(clause.span[1], edge.token);
        assert.ok(object.nounToken < subject.span[0] && edge.token <= object.span[1]);
      }
      const neighbours = new Map(result.groups.map(g => [g.id, []]));
      for (const edge of result.edges) {
        neighbours.get(edge.source).push(edge.target);
        neighbours.get(edge.target).push(edge.source);
      }
      const seen = new Set(), pending = [result.subject];
      while (pending.length) { const id = pending.pop(); if (seen.has(id)) continue; seen.add(id); pending.push(...neighbours.get(id)); }
      assert.equal(seen.size, groups.size, 'the graph must be connected');
      if (count >= 7) assert.ok([...neighbours.values()].some(n => n.length >= 3), 'a real fork is required');
      const layout = layoutTree(result);
      assert.equal(layout.points.size, groups.size);
      for (const point of layout.points.values()) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(point.x >= 0 && point.x <= layout.width && point.y >= 0 && point.y <= layout.height);
      }
    }
  }
});

test('one and two words model ellipsis instead of inventing extra words', () => {
  const one = interpret(1), two = interpret(2);
  assert.equal(one.sentence, 'buffalo.');
  assert.ok(one.groups.every(g => g.implicit));
  assert.equal(two.sentence, 'buffalo buffalo.');
  assert.equal(two.groups[0].implicit, true);
  assert.equal(two.groups[1].implicit, false);
  assert.equal(two.tokens[0].target, two.tokens[1].group);
});

test('invalid inputs are rejected without coercion or truncation', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, '8', null, undefined, MAX_COUNT + 1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => interpret(value), RangeError);
  }
});

test('group labels stay unique beyond Z', () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 701, 702].map(groupName), ['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
});

test('seeds replay exactly and different draws actually change tree topology', () => {
  assert.deepEqual(interpret(32, { seed: 0 }), interpret(32, { seed: 0 }));
  const shapes = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const model = interpret(32, { seed });
    shapes.add(model.edges.map(e => `${e.source}>${e.target}`).sort().join(','));
  }
  assert.ok(shapes.size > 20);
});

test('syntax views expose every modifier target and exact phrase span', () => {
  for (const count of [1, 2, 8, 18, 32, 1000]) {
    const model = interpret(count, { seed: 42 });
    const html = renderSyntax(model), brackets = renderBrackets(model);
    for (const token of model.tokens) assert.ok(html.includes(`data-token="${token.id}"`));
    for (const clause of model.clauses.filter(c => c.kind === 'relative')) {
      assert.ok(html.includes(`data-clause-box="${clause.verb}"`));
      assert.ok(html.includes(`整段修饰 ${clause.target} 组名词`));
      assert.ok(brackets.includes(`→ ${clause.target}`));
    }
  }
});

test('zoom stays anchored under the cursor and fit contains large trees', () => {
  const camera = { x: -120, y: 40, scale: .7 }, cursor = { x: 340, y: 210 };
  const world = { x: (cursor.x - camera.x) / camera.scale, y: (cursor.y - camera.y) / camera.scale };
  const changed = zoomAt(camera, 1.5, cursor);
  assert.ok(Math.abs(world.x * changed.scale + changed.x - cursor.x) < 1e-9);
  assert.ok(Math.abs(world.y * changed.scale + changed.y - cursor.y) < 1e-9);
  assert.equal(zoomAt(camera, 1e9, cursor).scale, 4.5);
  assert.equal(zoomAt(camera, 1e-9, cursor).scale, .005);
  for (const width of [320, 640, 1600]) {
    const layout = layoutTree(interpret(1000, { seed: 5 }));
    const fit = fitCamera(layout, { width, height: 430 });
    assert.ok(fit.x >= 0 && fit.y >= 0);
    assert.ok(layout.width * fit.scale + fit.x <= width);
    assert.ok(layout.height * fit.scale + fit.y <= 430);
  }
});
