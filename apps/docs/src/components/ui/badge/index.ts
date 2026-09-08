import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-emerald-500 text-black shadow',
        secondary: 'border-transparent bg-zinc-800 text-zinc-100',
        destructive: 'border-transparent bg-rose-500 text-white shadow',
        outline: 'text-zinc-300 border-zinc-800',
        graduated: 'border-emerald-800 bg-emerald-950 text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export { default as Badge } from './Badge.vue';
