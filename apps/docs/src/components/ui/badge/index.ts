import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#E7239F] text-white shadow',
        secondary: 'border-transparent bg-zinc-800 text-zinc-100',
        destructive: 'border-transparent bg-rose-500 text-white shadow',
        outline: 'text-zinc-300 border-zinc-800',
        graduated: 'border-[#E7239F]/30 bg-[#E7239F]/10 text-[#E7239F]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export { default as Badge } from './Badge.vue';
