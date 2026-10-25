// A 12U home server rack seen from the front, with the left rail highlighted the way Tandrix marks
// a part on a photo. Drawn in tokens so it follows the theme.

const U = 20; // one rack unit
const top = 24;
const left = 40;
const width = 200;

function Holes({ x }: { x: number }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, u) =>
        [5, 10, 15].map((dy) => (
          <rect
            key={`${u}-${dy}`}
            x={x - 2}
            y={top + u * U + dy - 1.5}
            width={4}
            height={3}
            rx={0.8}
          />
        )),
      )}
    </g>
  );
}

export function RackIllustration() {
  const inner = { x: left + 18, w: width - 36 };
  return (
    <svg
      viewBox="0 0 280 300"
      role="img"
      aria-label="A home server rack. Tandrix highlights the left rail where the next server goes."
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {/* Frame */}
      <rect
        x={left}
        y={top - 8}
        width={width}
        height={12 * U + 16}
        rx={6}
        fill="var(--background-100)"
        stroke="var(--gray-600)"
        strokeWidth={1.5}
      />
      {/* Rails */}
      <rect x={left + 6} y={top} width={10} height={12 * U} fill="var(--gray-200)" />
      <rect x={left + width - 16} y={top} width={10} height={12 * U} fill="var(--gray-200)" />
      <g fill="var(--gray-600)">
        <Holes x={left + 11} />
        <Holes x={left + width - 11} />
      </g>

      {/* 1U patch panel */}
      <g>
        <rect
          x={inner.x}
          y={top + 1}
          width={inner.w}
          height={U - 2}
          rx={2}
          fill="var(--gray-100)"
          stroke="var(--gray-500)"
        />
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x={inner.x + 10 + i * 12}
            y={top + 6}
            width={8}
            height={7}
            rx={1}
            fill="var(--gray-700)"
          />
        ))}
      </g>
      {/* 1U switch, with its link lights */}
      <g>
        <rect
          x={inner.x}
          y={top + U + 1}
          width={inner.w}
          height={U - 2}
          rx={2}
          fill="var(--gray-100)"
          stroke="var(--gray-500)"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={inner.x + 10 + i * 14}
            y={top + U + 6}
            width={10}
            height={8}
            rx={1}
            fill="var(--gray-700)"
          />
        ))}
        <circle cx={inner.x + inner.w - 12} cy={top + U + 10} r={2.5} fill="var(--green-700)" />
      </g>
      {/* 2U server with drive bays */}
      <g>
        <rect
          x={inner.x}
          y={top + 2 * U + 1}
          width={inner.w}
          height={2 * U - 2}
          rx={2}
          fill="var(--gray-100)"
          stroke="var(--gray-500)"
        />
        {Array.from({ length: 4 }, (_, i) => (
          <rect
            key={i}
            x={inner.x + 8 + i * 30}
            y={top + 2 * U + 7}
            width={26}
            height={2 * U - 14}
            rx={2}
            fill="var(--background-100)"
            stroke="var(--gray-500)"
          />
        ))}
      </g>

      {/* The empty space for the next server, with the rail to fit marked */}
      <rect
        x={inner.x}
        y={top + 4 * U + 1}
        width={inner.w}
        height={2 * U - 2}
        rx={2}
        fill="none"
        stroke="var(--gray-400)"
        strokeDasharray="4 4"
      />
      <g fill="none" strokeLinejoin="round">
        <rect
          x={left + 2}
          y={top + 4 * U - 4}
          width={18}
          height={2 * U + 8}
          rx={4}
          stroke="var(--highlight-keyline)"
          strokeWidth={8}
          opacity={0.55}
        />
        <rect
          x={left + 2}
          y={top + 4 * U - 4}
          width={18}
          height={2 * U + 8}
          rx={4}
          stroke="var(--highlight-halo)"
          strokeWidth={5}
        />
        <rect
          x={left + 2}
          y={top + 4 * U - 4}
          width={18}
          height={2 * U + 8}
          rx={4}
          stroke="var(--highlight)"
          strokeWidth={2.5}
          fill="var(--highlight-tint)"
        />
      </g>

      {/* Blank panels below */}
      {[6, 8, 10].map((u) => (
        <rect
          key={u}
          x={inner.x}
          y={top + u * U + 1}
          width={inner.w}
          height={2 * U - 2}
          rx={2}
          fill="var(--background-200)"
          stroke="var(--gray-400)"
        />
      ))}
    </svg>
  );
}
