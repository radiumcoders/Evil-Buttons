import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function MinimalButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      className={cn(
        className,
        "relative w-46 h-13 p-0 [--pattern:var(--color-accent)] shadow-[0px_10px_30px_10px_#00000024] dark:shadow-[0px_10px_30px_10px_#ffffff24]",
      )}
    >
      <div className="h-full w-full border-r border-(--pattern) bg-[repeating-linear-gradient(315deg,var(--pattern)_0,var(--pattern)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] opacity-10" />
      <span className="relative z-10">{children}</span>
      <div className="h-full w-full border-l border-(--pattern) bg-[repeating-linear-gradient(315deg,var(--pattern)_0,var(--pattern)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] opacity-10" />
    </Button>
  );
}

export default MinimalButton;
