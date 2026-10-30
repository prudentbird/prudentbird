import { cn } from "~/lib/utils";

function TextSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="text-skeleton"
      className={cn("h-[1lh] w-full", className)}
      {...props}
    >
      <div className="bg-accent animate-pulse rounded-md h-[1em] w-full" />
    </div>
  );
}

export { TextSkeleton };
