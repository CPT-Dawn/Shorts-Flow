/**
 * An icon in the weight of YouTube's own (24 px grid, 2 px round lines) as an
 * inline SVG drawn in the current text colour, hidden from screen readers.
 * `paths` are its path data on the 24 px grid. Outline icons stroke them;
 * `filled` ones fill them instead.
 */
export function drawIcon(
  document: Document,
  paths: string[],
  { size = 24, filled = false, className }: { size?: number; filled?: boolean; className?: string } = {},
): SVGSVGElement {
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  const attributes = {
    viewBox: '0 0 24 24',
    width: String(size),
    height: String(size),
    focusable: 'false',
    'aria-hidden': 'true',
    fill: filled ? 'currentColor' : 'none',
    stroke: filled ? 'none' : 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...(className && { class: className }),
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
