// One post fanning out to many networks, as a menu preview's art: Peal's
// mark in the centre (as packages/peal-web/src/app/icon.svg draws it),
// joined by spokes to six nodes around it. Drawn for rasterising into
// pixels, so only its shapes count, in currentColor.

// The nodes' angles, in degrees, starting at the top.
const nodes = [0, 60, 120, 180, 240, 300];

const radius = 26;

const FanOutArt = () => (
  <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
    {nodes.map((angle) => {
      const x = 32 + radius * Math.sin((angle * Math.PI) / 180);
      const y = 32 - radius * Math.cos((angle * Math.PI) / 180);
      const inner = 0.5;

      return (
        <g key={angle}>
          <line
            x1={32 + (x - 32) * inner}
            y1={32 + (y - 32) * inner}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeWidth={2.2}
          />
          <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={2} />
        </g>
      );
    })}
    <g transform="translate(32 32) scale(0.5) translate(-32 -32)">
      <path d="M32 8L52.78 20L32 32Z" />
      <path d="M32 8L32 32L11.22 20Z" opacity={0.85} />
      <path d="M52.78 20L52.78 44L32 32Z" opacity={0.85} />
      <path d="M52.78 44L32 56L32 32Z" />
      <path d="M32 32L32 56L11.22 44Z" opacity={0.7} />
      <path d="M32 32L11.22 44L11.22 20Z" opacity={0.6} />
    </g>
  </svg>
);

export { FanOutArt };
