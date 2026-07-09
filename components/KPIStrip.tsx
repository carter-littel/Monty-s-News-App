import { Sparkline } from "@/components/Sparkline";

export type KPITile = {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
  spark?: number[];
  sparkColor?: string;
};

type KPIStripProps = {
  tiles: KPITile[];
};

const DELTA_CLASS: Record<NonNullable<KPITile["deltaDirection"]>, string> = {
  up: "text-emerald-600",
  down: "text-rose-600",
  flat: "text-slate-500",
};

export function KPIStrip({ tiles }: KPIStripProps) {
  if (!tiles.length) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => {
        const direction = tile.deltaDirection ?? "flat";
        return (
          <div
            key={tile.label}
            className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] font-mono text-slate-500">
              {tile.label}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
                {tile.value}
              </div>
              {tile.delta ? (
                <div className={`font-mono text-xs font-semibold ${DELTA_CLASS[direction]}`}>
                  {tile.delta}
                </div>
              ) : null}
            </div>
            {tile.spark && tile.spark.length > 1 ? (
              <div className="h-7">
                <Sparkline
                  data={tile.spark}
                  width={220}
                  height={28}
                  color={tile.sparkColor ?? "#0284c7"}
                  ariaLabel={`${tile.label} trend`}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
