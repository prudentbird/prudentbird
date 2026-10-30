import type { ReactNode } from "react";

export function SectionHeader({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <h2 id={id} className="text-3xl font-medium tracking-tight sm:text-4xl">
        {title}
      </h2>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
