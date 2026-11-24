import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
export function Button({
  asChild,
  className = "",
  ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={"button " + className} {...props} />;
}
