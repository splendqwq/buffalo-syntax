/** Layout the attachment tree rather than a token-order chain. */
export function layoutTree(model) {
  const neighbours = new Map(model.groups.map(group => [group.id, []]));
  for (const edge of model.edges) {
    neighbours.get(edge.source).push(edge.target);
    neighbours.get(edge.target).push(edge.source);
  }
  const degrees = new Map([...neighbours].map(([id, peers]) => [id, peers.length]));
  let leaves = [...degrees].filter(([, degree]) => degree <= 1).map(([id]) => id), remaining = degrees.size;
  while (remaining > 2) {
    remaining -= leaves.length;
    const next = [];
    for (const leaf of leaves) for (const peer of neighbours.get(leaf)) {
      degrees.set(peer, degrees.get(peer) - 1);
      if (degrees.get(peer) === 1) next.push(peer);
    }
    leaves = next;
  }
  const root = leaves[0] || model.subject;
  const points = new Map();
  let leaf = 0, maximumDepth = 0;
  const walk = (id, depth, parent = null) => {
    const children = neighbours.get(id).filter(peer => peer !== parent);
    const childPoints = children.map(child => walk(child, depth + 1, id));
    const x = childPoints.length ? (childPoints[0].x + childPoints.at(-1).x) / 2 : 100 + leaf++ * 170;
    const point = { x, y: 100 + depth * 220 };
    maximumDepth = Math.max(maximumDepth, depth);
    points.set(id, point);
    return point;
  };
  walk(root, 0);
  return { points, root, width: Math.max(230, (leaf - 1) * 170 + 200), height: maximumDepth * 220 + 210 };
}

export function fitCamera(bounds, viewport, padding = 38) {
  const scale = Math.max(0.005, Math.min(1.1, (viewport.width - padding * 2) / bounds.width, (viewport.height - padding * 2) / bounds.height));
  return { scale, x: (viewport.width - bounds.width * scale) / 2, y: (viewport.height - bounds.height * scale) / 2 };
}

export function zoomAt(camera, factor, anchor) {
  const scale = Math.max(0.005, Math.min(4.5, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { scale, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}
