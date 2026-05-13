interface Slice {
  color: string;
  value: number;
  label: string;
}

export default function PieChart({ data, size = 160 }: { data: Slice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-white/5 flex items-center justify-center text-slate-500 text-xs flex-shrink-0"
      >
        Sin datos
      </div>
    );
  }

  const cx = size / 2, cy = size / 2;
  const r = size * 0.42, inner = size * 0.26;
  let angle = -Math.PI / 2;

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      {data.map((d, i) => {
        const sweep = (d.value / total) * Math.PI * 2;
        const start = angle;
        angle += sweep;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(start + sweep), y2 = cy + r * Math.sin(start + sweep);
        const xi1 = cx + inner * Math.cos(start), yi1 = cy + inner * Math.sin(start);
        const xi2 = cx + inner * Math.cos(start + sweep), yi2 = cy + inner * Math.sin(start + sweep);
        const large = sweep > Math.PI ? 1 : 0;
        const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
        return <path key={i} d={path} fill={d.color} />;
      })}
    </svg>
  );
}
