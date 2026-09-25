import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none select-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow hover:opacity-90',
        secondary: 'border-border bg-muted text-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:opacity-90',
        outline: 'border-border bg-transparent text-foreground',
        graduated: 'border-primary/40 bg-primary/10 text-primary font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export { default as Badge } from './Badge.vue';
