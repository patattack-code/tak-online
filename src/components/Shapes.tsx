import type { Shape } from '../render/iso';

export function Shapes({ shapes }: { shapes: Shape[] }) {
  return (
    <>
      {shapes.map((s, i) => {
        const common = {
          stroke: s.kind === 'text' ? undefined : s.stroke,
          strokeWidth: s.kind === 'text' ? undefined : s.strokeWidth,
          strokeLinejoin: 'round' as const,
          opacity: s.kind === 'text' ? undefined : s.opacity,
        };
        switch (s.kind) {
          case 'polygon':
            return <polygon key={i} points={s.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={s.fill} {...common} />;
          case 'ellipse':
            return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} {...common} />;
          case 'path':
            return <path key={i} d={s.d} fill={s.fill} {...common} />;
          case 'text':
            return (
              <text key={i} x={s.x} y={s.y} fill={s.fill} fontSize={s.size} fontWeight={s.weight ?? 500} textAnchor={s.anchor ?? 'start'} fontFamily="Inter, system-ui, sans-serif">
                {s.text}
              </text>
            );
        }
      })}
    </>
  );
}
