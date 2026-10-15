import { layoutTree } from './graph.js';
import { banterFor, bubbleLines } from './banter.js';
const pad = value => String(value).padStart(2, '0');

export function bubbleMarkup(quote) {
  const lines = bubbleLines(quote);
  const top = -58 - lines.length * 15 - 14;
  return `<path d="M-74 ${top}H74V-58H8L0-47L-8-58H-74Z" fill="#fff9ed" stroke="#aaa88f" stroke-width="1"/><text text-anchor="middle">${lines.map((line, index) => `<tspan x="0" y="${top + 17 + index * 15}">${line}</tspan>`).join('')}</text>`;
}

export function drawArena(svg, model, buffaloArt, rounds = new Map()) {
  const layout = layoutTree(model);
  const definitions = `<defs><marker id="arrow-main" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#333d45" stroke-width="1.5"/></marker><marker id="arrow-relative" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L8 5L1 9" fill="none" stroke="#c96542" stroke-width="1.5"/></marker></defs>`;
  const edges = model.edges.map(edge => {
    const from = layout.points.get(edge.source), to = layout.points.get(edge.target);
    const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
    const sx = from.x + dx / distance * 43, sy = from.y + dy / distance * 43;
    const ex = to.x - dx / distance * 43, ey = to.y - dy / distance * 43;
    const lx = (sx + ex) / 2, ly = (sy + ey) / 2 - 7;
    const main = edge.kind !== 'relative';
    const path = `M${sx} ${sy}C${sx} ${(sy + ey) / 2},${ex} ${(sy + ey) / 2},${ex} ${ey}`;
    return `<g class="edge-wrap" data-edge-token="${edge.token}" role="button" tabindex="0" aria-label="#${edge.token}，${edge.source} 组欺负 ${edge.target} 组"><title>#${edge.token}：${edge.source} 欺负 ${edge.target}${main ? '，主句' : '，从句修饰 ' + edge.target + ' 组'}</title><path d="${path}" fill="none" stroke="transparent" stroke-width="18"/><path class="fight-edge ${main ? 'main' : ''}" data-edge="${edge.token}" d="${path}" marker-end="url(#arrow-${main ? 'main' : 'relative'})"/><rect class="edge-label-bg" x="${lx - 53}" y="${ly - 14}" width="106" height="34" rx="6"/><text class="edge-label" x="${lx}" y="${ly}" text-anchor="middle">${edge.source} 欺负 ${edge.target}</text><text class="edge-caption" x="${lx}" y="${ly + 13}" text-anchor="middle">#${pad(edge.token)} · ${main ? (edge.kind === 'imperative' ? '祈使句' : '主句') : `修饰 ${edge.target} 组`}</text></g>`;
  }).join('');
  const nodes = model.groups.map(group => {
    const banter = banterFor(group, model, rounds.get(group.id) || 0);
    const { x, y } = layout.points.get(group.id);
    const name = group.implicit ? (group.id === model.subject ? `${group.id} · 省略的你` : `${group.id} · 省略的对象`) : `${group.id} 组水牛`;
    const role = group.id === model.subject ? '主句主语' : group.id === model.object ? '主句宾语' : `修饰 ${group.parent} 组`;
    const location = group.implicit ? '隐含成分 · 不计词数' : `${group.city ? '布法罗出品' : '产地随缘'} · #${pad(group.nounToken)}`;
    const art = group.implicit ? `<g class="fighter-art"><text x="0" y="8" text-anchor="middle" font-family="Georgia,serif" font-size="27" fill="#8c937a" font-style="italic">${group.id === model.subject ? 'you' : '…'}</text></g>` : `<g class="avatar-scale" transform="scale(.42)">${buffaloArt(group.index)}</g>`;
    return `<g class="fighter ${group.implicit ? 'implicit' : ''}" data-group="${group.id}" transform="translate(${x},${y})" role="button" tabindex="0" aria-label="${name}；被 ${group.incoming.map(e => e.source).join('、') || '无'} 组欺负；正在欺负 ${group.outgoing.map(e => e.target).join('、') || '无'} 组"><title>${name} · ${banter.nickname}：${role}，${location}。${banter.quote}</title><circle class="fighter-halo" cy="0" r="37"/>${art}<g class="comic-bubble">${bubbleMarkup(banter.quote)}</g><rect class="fighter-ribbon" x="-49" y="43" width="98" height="22" rx="11"/><text class="fighter-id" x="0" y="58" text-anchor="middle">${name}</text><text class="fighter-location" x="0" y="81" text-anchor="middle">${location}</text><text class="fighter-badge" x="0" y="-44" text-anchor="middle">${role}${group.incoming.length > 1 ? ' · 围殴中' : ''}</text></g>`;
  }).join('');
  svg.innerHTML = definitions + `<g id="arena-world">${edges}${nodes}</g>`;
  return layout;
}
