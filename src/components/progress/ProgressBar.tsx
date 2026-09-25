export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1 rounded-full bg-border/70 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}
