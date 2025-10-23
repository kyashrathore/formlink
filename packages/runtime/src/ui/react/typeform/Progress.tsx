"use client";

export function TypeFormProgress({
  progress,
  current,
  total,
  className,
}: {
  progress: number;
  current: number;
  total: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(progress, 100));
  return (
    <div
      className={[
        "fl-rt-progress absolute top-0 left-0 right-0 z-[1000]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Progress"
    >
      <div className="h-2 bg-muted/30 dark:bg-muted/20">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="absolute top-4 right-4 text-sm text-muted-foreground">
        {current} of {total}
      </div>
    </div>
  );
}
