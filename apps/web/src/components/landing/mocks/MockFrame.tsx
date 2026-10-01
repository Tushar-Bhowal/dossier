import { cn } from "@/lib/utils";

export function MockFrame({
  title,
  label,
  right,
  children,
  className,
}: {
  title: string;
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0c] text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-4">
        <span className="flex items-center gap-2 text-[13px] text-white/65">
          <span className="size-1.5 rounded-full bg-primary" />
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}
