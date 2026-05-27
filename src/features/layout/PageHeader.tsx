import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-[34px] md:leading-[1.15]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
