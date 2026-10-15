const pad = value => String(value).padStart(2, '0');
const chip = (token, label) => `<button class="syntax-token ${token.role}" data-token="${token.id}" title="选择第 ${token.id} 词">${token.word}<small>#${pad(token.id)} · ${label}</small></button>`;

export function renderSyntax(model) {
  const groups = new Map(model.groups.map(g => [g.id, g]));
  const bySource = new Map(model.clauses.filter(c => c.kind === 'relative').map(c => [c.source, c]));
  const headOf = group => `<div class="np-head"><span class="np-group">${group.id} 组</span>${group.city ? `<div class="city-pair">${chip(model.tokens[group.cityToken - 1], '地名定语')}<span class="city-pointer" aria-label="修饰名词">修饰 →</span>` : ''}${chip(model.tokens[group.nounToken - 1], '复数名词')}${group.city ? '</div>' : ''}<span class="np-range">#${pad(group.span[0])}–${pad(group.span[1])}</span></div>`;
  // Very deep editable readings exceed HTML's nesting limit. Keep the exact
  // spans and references in a flat, labelled view instead of losing containment.
  const flatNP = id => {
    const rows = [], pending = [id];
    while (pending.length) {
      const key = pending.pop(), group = groups.get(key), clause = bySource.get(key);
      pending.push(...[...group.children].reverse());
      const head = `<div class="np-box" data-np="${key}">${headOf(group)}<p class="flat-children">第 ${group.depth + 1} 层${group.children.length ? ` · 它的对手：${group.children.join('、')}（在后续行展开）` : ' · 没有额外对手'}</p></div>`;
      rows.push(key === id ? head : `<details class="relative-box" data-clause-box="${clause.verb}"><summary><button data-token="${clause.verb}" class="clause-caption">从句 #${pad(clause.span[0])}–${pad(clause.span[1])}<b>整段修饰 ${clause.target} 组名词 #${pad(groups.get(clause.target).nounToken)} ↗</b></button><span class="clause-disclosure">⌄</span></summary><div class="relative-body">${head}<div class="relative-predicate">${chip(model.tokens[clause.verb - 1], '从句动词')}<span>${key} 组欺负 ${clause.target} 组</span></div></div></details>`);
    }
    return `<div class="syntax-flat"><p>套娃很深，以下改用层级列表。每段范围与修饰对象仍完整保留。</p>${rows.join('')}</div>`;
  };
  const np = (id, depth = 0) => {
    const group = groups.get(id);
    if (group.implicit) return `<div class="np-implicit">${id} 组：${id === model.subject ? 'you（省略的主语）' : '省略的对象'}<small>句子未写出，不计入词数</small></div>`;
    if (depth >= 10 && group.children.length) return flatNP(id);
    const head = headOf(group);
    const relatives = group.children.map(childID => {
      const clause = bySource.get(childID);
      return `<details class="relative-box" data-clause-box="${clause.verb}" ${depth < 2 ? 'open' : ''}><summary><span class="clause-branch" aria-hidden="true">↳</span><button data-token="${clause.verb}" class="clause-caption">从句 #${pad(clause.span[0])}–${pad(clause.span[1])}<b>整段修饰 ${id} 组名词 #${pad(group.nounToken)} ↗</b></button><span class="clause-disclosure">⌄</span></summary><div class="relative-body">${np(childID, depth + 1)}<div class="relative-predicate">${chip(model.tokens[clause.verb - 1], '从句动词')}<span>欺负 <b>${id} 组</b>（省略的 that）<br><small>↑ 回指本层框外的 #${pad(group.nounToken)} 名词</small></span></div></div></details>`;
    }).join('');
    return `<div class="np-box" data-np="${id}">${head}${relatives ? `<div class="np-children">${relatives}</div>` : '<span class="no-modifier">这个名词没有关系从句修饰</span>'}</div>`;
  };
  return `<div class="syntax-subject"><span class="syntax-slot">主语名词短语 · ${model.subject} 组</span>${np(model.subject)}</div><div class="syntax-main-verb"><span class="syntax-slot">主句谓语</span>${chip(model.tokens[model.mainVerb - 1], '欺负')}<span class="main-direction">⟶</span></div><div class="syntax-object"><span class="syntax-slot">宾语名词短语 · ${model.object} 组</span>${np(model.object)}</div>`;
}

export function renderBrackets(model) {
  const groups = new Map(model.groups.map(g => [g.id, g]));
  const clauses = new Map(model.clauses.filter(c => c.kind === 'relative').map(c => [c.source, c]));
  const flat = model.groups.some(g => g.depth > 30);
  const np = id => {
    const g = groups.get(id);
    if (g.implicit) return `<span class="bracket-implicit">（省略的 ${id === model.subject ? 'you' : '对象'}）</span>`;
    const text = `[<b>${id}</b> ${g.city ? `Buffalo<sup>#${g.cityToken}</sup> ` : ''}buffalo<sup>#${g.nounToken}</sup>${g.children.map(child => {
      const relative = `{${np(child)} <button data-token="${clauses.get(child).verb}">buffalo<sup>#${clauses.get(child).verb}</sup></button> → ${id}}`;
      return flat ? relative : `<span class="bracket-relative">${relative}</span>`;
    }).join('')}]`;
    return flat ? text : `<span class="bracket-np">${text}</span>`;
  };
  return `<p class="syntax-intro">[方括号] 是名词短语，{花括号} 是修饰前方名词的从句。每个词旁的编号对应原句；橙色箭头指向从句修饰对象。</p><div class="bracket-read">${np(model.subject)} <button class="bracket-main" data-token="${model.mainVerb}">buffalo<sup>#${model.mainVerb}</sup></button> ${np(model.object)}</div>`;
}
