// The Tideline mark, drawn inline so the Popup shows it crisp at any size and
// in either build (the Chrome build ships no SVG files). Geometry and colours
// are docs/design/brand/icon.svg's; see the brand README.

const SVG = 'http://www.w3.org/2000/svg';

type Shape = [tag: string, attributes: Record<string, string>, children?: Shape[]];

/** The open loop falling into a short arrow, on the 128 grid, in `stroke`. */
const line = (stroke: string): Shape => [
  'g',
  { fill: 'none', stroke, 'stroke-width': '11', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  [
    ['path', { d: 'M84.8 60 A22 22 0 1 0 64 72 V101' }],
    ['path', { d: 'M53 90 64 101 75 90' }],
  ],
];

const stop = (offset: string, color: string, opacity = '1'): Shape => [
  'stop',
  { offset, 'stop-color': color, 'stop-opacity': opacity },
];

/** The Pearl gradient the line is drawn in. */
const pearl = (id: string): Shape => [
  'linearGradient',
  { id, x1: '0', y1: '0', x2: '.3', y2: '1' },
  [stop('0', '#e6f4fb'), stop('1', '#93cbe8')],
];

/** The app icon: the night tile with its sheen and hairline, and the line in Pearl. */
const TILE: Shape[] = [
  [
    'defs',
    {},
    [
      [
        'linearGradient',
        { id: 'sf-tile', x1: '0', y1: '0', x2: '1', y2: '1' },
        [stop('0', '#22386b'), stop('.55', '#131f3a'), stop('1', '#0b1220')],
      ],
      ['radialGradient', { id: 'sf-sheen', cx: '.2', cy: '.08', r: '.75' }, [stop('0', '#fff', '.12'), stop('1', '#fff', '0')]],
      pearl('sf-tile-pearl'),
    ],
  ],
  ['rect', { width: '128', height: '128', rx: '30', fill: 'url(#sf-tile)' }],
  ['rect', { width: '128', height: '128', rx: '30', fill: 'url(#sf-sheen)' }],
  [
    'rect',
    {
      x: '.75',
      y: '.75',
      width: '126.5',
      height: '126.5',
      rx: '29.25',
      fill: 'none',
      stroke: '#fff',
      'stroke-opacity': '.08',
      'stroke-width': '1.5',
    },
  ],
  line('url(#sf-tile-pearl)'),
];

/** The line alone in Pearl, for the Auto-Scroll card's watermark. */
const LINE: Shape[] = [['defs', {}, [pearl('sf-line-pearl')]], line('url(#sf-line-pearl)')];

/** A decorative drawing of the mark, hidden from assistive technology: `tile` is the app icon, `line` the stroke alone. */
export function drawMark(document: Document, kind: 'tile' | 'line', className: string): SVGSVGElement {
  const draw = ([tag, attributes, children = []]: Shape): SVGElement => {
    const node = document.createElementNS(SVG, tag) as SVGElement;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    node.append(...children.map(draw));
    return node;
  };
  const svg = draw([
    'svg',
    { viewBox: '0 0 128 128', class: className, 'aria-hidden': 'true', focusable: 'false' },
    kind === 'tile' ? TILE : LINE,
  ]) as SVGSVGElement;
  return svg;
}
