import type { CvPage, DrawOp } from "./layout";
import { PAGE_H, PAGE_W } from "./layout";

export function CvCanvas({
  page,
  className = "",
  fontCss = "",
}: {
  page: CvPage;
  className?: string;
  fontCss?: string;
}) {
  const render = (op: DrawOp, i: number) => {
    if (op.kind === "rect")
      return (
        <rect
          key={i}
          x={op.x}
          y={op.y}
          width={op.w}
          height={op.h}
          fill={op.fill}
          rx={op.radius || 0}
        />
      );
    if (op.kind === "circle")
      return (
        <circle
          key={i}
          cx={op.x}
          cy={op.y}
          r={op.r}
          fill={op.fill}
          stroke={op.stroke}
          strokeWidth={op.width}
        />
      );
    if (op.kind === "text") {
      const node = (
        <text
          x={op.x}
          y={op.y}
          fontFamily="Montserrat"
          fontSize={op.size}
          fontWeight={op.bold ? 700 : 400}
          textAnchor={op.align === "center" ? "middle" : "start"}
          fill={op.fill}
        >
          {op.text}
        </text>
      );
      return op.url ? (
        <a key={i} href={op.url} target="_blank" rel="noopener noreferrer">
          {node}
        </a>
      ) : (
        <g key={i}>{node}</g>
      );
    }
    const node = (
      <>
        {op.round && (
          <defs>
            <clipPath id={`photo-${i}`}>
              <circle cx={op.x + op.w / 2} cy={op.y + op.h / 2} r={op.w / 2} />
            </clipPath>
          </defs>
        )}
        <image
          href={op.src}
          x={op.x}
          y={op.y}
          width={op.w}
          height={op.h}
          preserveAspectRatio={op.round ? "xMidYMid slice" : "xMidYMid meet"}
          clipPath={op.round ? `url(#photo-${i})` : undefined}
        />
      </>
    );
    return op.url ? (
      <a key={i} href={op.url} target="_blank" rel="noopener noreferrer">
        {node}
      </a>
    ) : (
      <g key={i}>{node}</g>
    );
  };
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      width={PAGE_W}
      height={PAGE_H}
      role="img"
      aria-label="Live CV page preview"
    >
      <style>{fontCss}</style>
      {page.ops.map(render)}
    </svg>
  );
}
