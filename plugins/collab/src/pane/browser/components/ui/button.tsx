import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "collab:inline-flex collab:shrink-0 collab:items-center collab:justify-center collab:gap-2 collab:rounded-md collab:text-sm collab:font-medium collab:whitespace-nowrap collab:transition-all collab:outline-none collab:focus-visible:border-ring collab:focus-visible:ring-[3px] collab:focus-visible:ring-ring/50 collab:disabled:pointer-events-none collab:disabled:opacity-50 collab:aria-invalid:border-destructive collab:aria-invalid:ring-destructive/20 collab:dark:aria-invalid:ring-destructive/40 collab:[&_svg]:pointer-events-none collab:[&_svg]:shrink-0 collab:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "collab:bg-primary collab:text-primary-foreground collab:hover:bg-primary/90",
        destructive:
          "collab:bg-destructive collab:text-white collab:hover:bg-destructive/90 collab:focus-visible:ring-destructive/20 collab:dark:bg-destructive/60 collab:dark:focus-visible:ring-destructive/40",
        outline:
          "collab:border collab:bg-background collab:shadow-xs collab:hover:bg-accent collab:hover:text-accent-foreground collab:dark:border-input collab:dark:bg-input/30 collab:dark:hover:bg-input/50",
        secondary:
          "collab:bg-secondary collab:text-secondary-foreground collab:hover:bg-secondary/80",
        ghost:
          "collab:hover:bg-accent collab:hover:text-accent-foreground collab:dark:hover:bg-accent/50",
        link: "collab:text-primary collab:underline-offset-4 collab:hover:underline",
      },
      size: {
        default: "collab:h-9 collab:px-4 collab:py-2 collab:has-[>svg]:px-3",
        xs: "collab:h-6 collab:gap-1 collab:rounded-md collab:px-2 collab:text-xs collab:has-[>svg]:px-1.5 collab:[&_svg:not([class*='size-'])]:size-3",
        sm: "collab:h-8 collab:gap-1.5 collab:rounded-md collab:px-3 collab:has-[>svg]:px-2.5",
        lg: "collab:h-10 collab:rounded-md collab:px-6 collab:has-[>svg]:px-4",
        icon: "collab:size-9",
        "icon-xs": "collab:size-6 collab:rounded-md collab:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "collab:size-8",
        "icon-lg": "collab:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
