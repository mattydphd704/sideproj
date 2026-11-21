// shadcn/ui NativeSelect: a styled <select> that opens the device's own picker,
// so it always works on phones and inside embedded viewers (global rule GR-4).
import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "../../lib/utils";

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          "border-input flex h-11 w-full appearance-none items-center rounded-md border bg-transparent pr-10 pl-3 text-base shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
          "invalid:text-muted-foreground [&>option]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  );
}

export { NativeSelect };
