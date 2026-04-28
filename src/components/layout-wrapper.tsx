import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Direction = "row" | "column";
type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type Padding = "none" | "sm" | "md" | "lg";
type Align = "start" | "center" | "end" | "stretch";
type Justify = "start" | "center" | "between" | "end";

const gapClassName: Record<Gap, string> = {
  none: "",
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
};

const paddingClassName: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const alignClassName: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyClassName: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  between: "justify-between",
  end: "justify-end",
};

export function LayoutWrapper({
  children,
  direction = "column",
  gap = "md",
  padding = "none",
  align = "stretch",
  justify = "start",
  grow = false,
}: {
  children: ReactNode;
  direction?: Direction;
  gap?: Gap;
  padding?: Padding;
  align?: Align;
  justify?: Justify;
  grow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        gapClassName[gap],
        paddingClassName[padding],
        alignClassName[align],
        justifyClassName[justify],
        grow ? "flex-1" : "",
      )}
    >
      {children}
    </div>
  );
}
