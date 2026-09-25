import type { ReactNode } from 'react';
/** Vertical rope connector: thin continuous line with subtle nodes between blocks. */
export default function RoadmapPath({ children }: { children: ReactNode[] }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="relative">
      {items.map((child, i) => (
        <div key={i} className="relative pl-0">
          {i > 0 && (
            <div className="flex justify-start pl-7" aria-hidden>
              <div className="rope w-[2px] h-5 opacity-70" />
            </div>
          )}
          <div className="relative flex gap-0">
            <div className="hidden sm:flex flex-col items-center w-7 shrink-0 pt-5" aria-hidden>
              <span className={`w-2 h-2 rounded-full border ${i === 0 ? 'bg-accent border-accent' : 'bg-surface2 border-muted/50'}`} />
            </div>
            <div className="flex-1 min-w-0">{child}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
