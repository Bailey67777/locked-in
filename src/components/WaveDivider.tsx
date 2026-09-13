import { cn } from "@/lib/cn";

/** A soft wave edge, used to separate the header from the content. */
export default function WaveDivider({ className, fill = "#fbf7f0" }: { className?: string; fill?: string }) {
  return (
    <svg
      className={cn("block h-8 w-full md:h-10", className)}
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 40 C 180 80, 360 80, 540 40 S 900 0, 1080 40 S 1350 80, 1440 40 L1440 80 L0 80 Z"
        fill={fill}
      />
    </svg>
  );
}
