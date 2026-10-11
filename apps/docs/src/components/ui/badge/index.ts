import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-background shadow-xs',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow-xs',
        outline: 'text-foreground border-border bg-background',
        graduated: 'border-border bg-muted text-foreground',
        bullish: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        bearish: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export { default as Badge } from './Badge.vue';
