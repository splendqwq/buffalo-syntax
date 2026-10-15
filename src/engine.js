export const MAX_COUNT = 1000;

export function groupName(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

// This small, serializable tree is the only editable state. Token numbers,
// references and spans are derived together, never patched independently.
export function treeOf(model) {
  return { seed: model.seed, classic: model.classic, edited: model.edited || false,
    subject: model.subject, object: model.object,
    groups: model.groups.map(({ id, index, implicit, city, children }) => ({ id, index, implicit, city, children: [...children] })) };
}

export function compileTree(tree) {
  if (!tree || !Array.isArray(tree.groups) || tree.groups.length < 2 || tree.groups.length > 501) throw new Error('需要保留主赛双方。');
  if (tree.groups.some(g => !g || !Array.isArray(g.children) || typeof g.implicit !== 'boolean' || typeof g.city !== 'boolean')) throw new Error('水牛信息不完整，保留当前句子。');
  const groups = tree.groups.map(g => ({ ...g, children: [...g.children], parent: null, depth: 0, span: null,
    nounToken: null, cityToken: null, incoming: [], outgoing: [] }));
  const byID = new Map(groups.map(g => [g.id, g]));
  const subject = byID.get(tree.subject), object = byID.get(tree.object);
  if (byID.size !== groups.length || !subject || !object || subject === object) throw new Error('主赛双方必须是两组不同的水牛。');
  const seen = new Set();
  const visit = (group, depth) => {
    if (!group || seen.has(group.id)) throw new Error('这条连线会形成环，或让同一组重复上场。');
    if (!Number.isSafeInteger(group.index) || group.index < 0 || group.id !== groupName(group.index)) throw new Error('水牛组号无效。');
    seen.add(group.id);
    group.depth = depth;
    if (group.implicit && (group.city || group.children.length)) throw new Error('请先让省略的选手上场。');
    for (const id of group.children) {
      if (id === tree.subject || id === tree.object) throw new Error('主赛双方必须留在场上。');
      const child = byID.get(id);
      visit(child, depth + 1);
      child.parent = group.id;
    }
  };
  visit(subject, 0);
  visit(object, 0);
  if (seen.size !== groups.length || (object.implicit && !subject.implicit) || groups.some(g => g.implicit && g !== subject && g !== object)) throw new Error('每组水牛都需要接入这场比赛。');
  const count = groups.reduce((sum, g) => sum + (g.implicit ? 0 : 1 + Number(g.city)), 0) + groups.length - 1;
  if (count > MAX_COUNT) throw new RangeError(`最多容纳 ${MAX_COUNT} 个 buffalo；请先撤掉一些对手。`);
  if (count < 1) throw new Error('至少保留一个 buffalo。');
  const tokens = [], edges = [], clauses = [];
  let mainVerb;
  const addToken = (role, group, extra = {}) => {
    const token = { id: tokens.length + 1, word: role === 'city' ? 'Buffalo' : 'buffalo', role, group: group?.id ?? null, ...extra };
    tokens.push(token);
    if (role === 'noun') group.nounToken = token.id;
    if (role === 'city') group.cityToken = token.id;
    return token;
  };
  const addVerb = (source, target, kind, depth, start) => {
    const token = addToken('verb', null, { source: source.id, target: target.id, kind, depth });
    const edge = { id: `e${token.id}`, token: token.id, source: source.id, target: target.id, kind };
    edges.push(edge);
    clauses.push({ source: source.id, target: target.id, verb: token.id, kind, depth, span: [start ?? token.id, token.id] });
    source.outgoing.push(edge);
    target.incoming.push(edge);
    if (kind !== 'relative') mainVerb = token.id;
  };
  const emitNP = (group, depth) => {
    if (group.implicit) return;
    const start = tokens.length + 1;
    if (group.city) addToken('city', group, { depth });
    addToken('noun', group, { depth });
    for (const childID of group.children) {
      const child = byID.get(childID), clauseStart = tokens.length + 1;
      emitNP(child, depth + 1);
      addVerb(child, group, 'relative', depth + 1, clauseStart);
    }
    group.span = [start, tokens.length];
  };
  emitNP(subject, 0);
  addVerb(subject, object, subject.implicit ? 'imperative' : 'main', 0);
  emitNP(object, 0);
  const label = group => `${group.id} 组${group.city ? '布法罗的' : ''}水牛`;
  const attackers = group => group.children.map(id => `${id} 组`).join('、');
  let meaning = subject.implicit ? object.implicit ? '（你）去欺负（某个对象）！主语与宾语都省略了。' : `（你）去欺负 ${label(object)}！这是一个祈使句。`
    : `${label(subject)}${subject.children.length ? `（被 ${attackers(subject)}欺负）` : ''}，正在欺负 ${label(object)}${object.children.length ? `（被 ${attackers(object)}欺负）` : ''}。`;
  if (groups.some(g => g.depth > 1)) meaning += '其他嵌套恩怨见下方完整关系。';
  return { count, seed: tree.seed >>> 0, classic: Boolean(tree.classic), edited: Boolean(tree.edited), tokens, groups, edges, clauses,
    subject: subject.id, object: object.id, mainVerb, sentence: tokens.map(t => t.word).join(' ') + '.', meaning };
}

/** Random attachment tree. NP → [Buffalo] buffalo { NP buffalo }.
 * Stacked object relatives are explicitly bracketed in the experimental reading.
 */
export function interpret(count, { seed = Math.floor(Math.random() * 4294967296), classic = false } = {}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_COUNT) throw new RangeError(`请输入 1–${MAX_COUNT} 之间的整数。`);
  const random = seededRandom(seed);
  const groups = [];
  const addGroup = (implicit = false) => {
    const group = { id: groupName(groups.length), index: groups.length, implicit, city: false, nounToken: null, cityToken: null, incoming: [], outgoing: [], children: [], parent: null, depth: 0, span: null };
    groups.push(group);
    return group;
  };
  const attach = (child, parent) => {
    child.parent = parent.id;
    child.depth = parent.depth + 1;
    parent.children.push(child.id);
  };
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  let subject, object;
  if (count <= 2) {
    subject = addGroup(true);
    object = addGroup(count === 1);
  } else {
    const isClassic = classic && count === 8;
    const minimum = Math.max(count >= 7 && !isClassic ? 4 : 2, Math.ceil((count + 1) / 3));
    const maximum = Math.floor((count + 1) / 2);
    const totalGroups = isClassic ? 3 : minimum + Math.floor(random() * (maximum - minimum + 1));
    for (let i = 0; i < totalGroups; i++) addGroup();
    subject = groups[0];
    object = isClassic ? groups[2] : groups[1];
    if (isClassic) attach(groups[1], subject);
    else {
      // Four mentions suffice for a genuine fork. Give two relatives a shared head.
      const anchor = random() < 0.5 ? subject : object;
      for (let i = 2; i < Math.min(4, totalGroups); i++) attach(groups[i], anchor);
      for (let i = 4; i < totalGroups; i++) {
        const candidates = groups.slice(0, i).filter(g => g.children.length < (g === subject ? 2 : 3));
        const weights = candidates.map(g => 1 / (1 + g.depth * 0.65));
        let ticket = random() * weights.reduce((a, b) => a + b, 0), chosen = candidates.at(-1);
        for (let j = 0; j < candidates.length; j++) {
          ticket -= weights[j];
          if (ticket <= 0) { chosen = candidates[j]; break; }
        }
        attach(groups[i], chosen);
      }
      groups.forEach(group => shuffle(group.children));
    }
    const cityCount = count - (2 * totalGroups - 1);
    const cityGroups = isClassic ? groups : shuffle([...groups]);
    for (let i = 0; i < cityCount; i++) cityGroups[i].city = true;
  }
  return compileTree({ seed, classic: classic && count === 8, groups, subject: subject.id, object: object.id });
}

export function describeToken(token, model) {
  const group = model.groups.find(group => group.id === token.group);
  if (token.role === 'city') return { pos: '专有名词 · 地名定语', shortPos: '地名定语', gloss: '布法罗的', relation: `修饰 ${token.group} 组的名词 #${String(group.nounToken).padStart(2, '0')}`, detail: `#${token.id} Buffalo → #${group.nounToken} buffalo：地点修饰 ${token.group} 组水牛。蓝色小框只修饰这个名词，不修饰动作。` };
  if (token.role === 'noun') return { pos: '名词 · 复数', shortPos: '名词', gloss: '水牛', relation: `指代 ${token.group} 组水牛`, detail: `这是 ${token.group} 组水牛。${group.city ? `地名定语 #${group.cityToken} 说明它们来自布法罗。` : '没有地名定语。'}${group.children.length ? `${group.children.length} 段关系从句共同修饰这个名词，点击从句框可查看整段范围。` : ''}` };
  const clause = model.clauses.find(c => c.verb === token.id);
  const target = model.groups.find(g => g.id === token.target);
  return { pos: '动词 · 及物', shortPos: '动词', gloss: '欺负', relation: `${token.source} 组 → 欺负 → ${token.target} 组`, detail: token.kind === 'relative' ? `从句 #${clause.span[0]}–#${clause.span[1]} 整段修饰 ${token.target} 组的名词 #${target.nounToken}。${token.source} 组是施动者，省略的 that 指回 ${token.target} 组（宾语）。` : token.kind === 'imperative' ? `祈使句：${token.source} 是省略的 you，${token.target} 是动作对象。虚线框表示省略成分。` : `主句谓语：${token.source} 组欺负 ${token.target} 组；其他从句可以分别挂在主语或宾语上。` };
}
