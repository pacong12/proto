import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none select-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-emerald-500 text-black shadow hover:bg-emerald-600',
        secondary: 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800',
        destructive: 'border-transparent bg-rose-500 text-white shadow hover:bg-rose-600',
        outline: 'border-zinc-300 dark:border-zinc-800 bg-transparent',
        graduated:
          'border-emerald-600 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export { default as Badge } from './Badge.vue';
