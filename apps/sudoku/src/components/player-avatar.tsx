import Image from "next/image";
import { cn } from "~/lib/utils";
import { initials, playerColor } from "~/lib/players";

export function PlayerAvatar({
  name,
  image,
  size = 24,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      title={name}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Small colour swatch identifying a player on the board. */
export function ColorDot({
  color,
  className,
}: {
  color: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: playerColor(color) }}
    />
  );
}
