import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground font-semibold shadow hover:opacity-90 active:opacity-100',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:opacity-100',
        outline:
          'border border-border bg-card text-foreground shadow-sm hover:bg-muted active:bg-muted/80',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:opacity-90 active:opacity-100',
        ghost: 'text-foreground hover:bg-muted active:bg-muted/80',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base font-bold',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
export { default as Button } from './Button.vue';
