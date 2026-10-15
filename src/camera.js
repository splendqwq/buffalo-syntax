import { fitCamera, zoomAt } from './graph.js';

export function createCamera(svg, viewport, onChange) {
  let camera = { scale: 1, x: 0, y: 0 }, bounds = { width: 800, height: 450 };
  let size = { width: 800, height: 450 }, dragged = false, suppressClick = false;
  const pointers = new Map();
  const apply = () => {
    svg.querySelector('#arena-world')?.setAttribute('transform', `translate(${camera.x},${camera.y}) scale(${camera.scale})`);
    onChange?.(camera);
  };
  const fit = nextBounds => {
    if (nextBounds) bounds = nextBounds;
    camera = fitCamera(bounds, size);
    apply();
  };
  const resize = () => {
    const rect = viewport.getBoundingClientRect();
    size = { width: Math.max(200, rect.width), height: Math.max(200, rect.height) };
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    fit();
  };
  const local = event => {
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const zoom = (factor, anchor = { x: size.width / 2, y: size.height / 2 }) => {
    camera = zoomAt(camera, factor, anchor);
    apply();
  };
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
    zoom(Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.003), local(event));
  }, { passive: false });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const origin = local(event);
    pointers.set(event.pointerId, { ...origin, startX: origin.x, startY: origin.y });
    dragged = false;
    if (pointers.size > 1) suppressClick = true;
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()], old = pointers.get(event.pointerId), next = local(event);
    pointers.set(event.pointerId, { ...next, startX: old.startX, startY: old.startY });
    if (Math.hypot(next.x - old.startX, next.y - old.startY) > 4 || pointers.size > 1) dragged = true;
    if (!dragged) return;
    if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      camera.x += next.x - old.x;
      camera.y += next.y - old.y;
    } else {
      const after = [...pointers.values()];
      const distance = values => Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      const midpoint = values => ({ x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 });
      const previousMid = midpoint(before), mid = midpoint(after);
      camera.x += mid.x - previousMid.x;
      camera.y += mid.y - previousMid.y;
      camera = zoomAt(camera, distance(after) / Math.max(1, distance(before)), mid);
    }
    viewport.classList.add('is-panning');
    apply();
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (dragged) suppressClick = true;
    if (!pointers.size) viewport.classList.remove('is-panning');
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(type, release);
  svg.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  svg.addEventListener('keydown', event => {
    const deltas = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
    if (deltas[event.key]) { event.preventDefault(); camera.x += deltas[event.key][0]; camera.y += deltas[event.key][1]; apply(); }
    else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? 1 / 1.3 : 1.3); }
    else if (event.key === '0') { event.preventDefault(); fit(); }
  });
  new ResizeObserver(resize).observe(viewport);
  resize();
  return { fit, zoom, focus(point, close = false) {
    if (close) camera.scale = 1.3;
    const x = point.x * camera.scale + camera.x, y = point.y * camera.scale + camera.y;
    if (close || x < 65 || x > size.width - 65 || y < 65 || y > size.height - 65) {
      camera.x = size.width / 2 - point.x * camera.scale;
      camera.y = size.height / 2 - point.y * camera.scale;
      apply();
    }
  } };
}
