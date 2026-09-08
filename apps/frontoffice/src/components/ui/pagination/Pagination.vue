<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import {
  PaginationRoot,
  type PaginationRootEmits,
  type PaginationRootProps,
  PaginationList,
  PaginationListItem,
  PaginationPrev,
  PaginationNext,
  useForwardPropsEmits,
} from 'radix-vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface Props extends PaginationRootProps {
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();
const emits = defineEmits<PaginationRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PaginationRoot v-bind="forwarded" :class="cn('mx-auto flex w-full justify-center', props.class)">
    <PaginationList v-slot="{ items }" class="flex items-center gap-1">
      <PaginationPrev
        :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')"
      >
        <ChevronLeft class="h-4 w-4" />
      </PaginationPrev>

      <template v-for="(page, index) in items">
        <PaginationListItem
          v-if="page.type === 'page'"
          :key="index"
          :value="page.value"
          :class="
            cn(
              buttonVariants({
                variant: page.value === props.page ? 'default' : 'outline',
                size: 'sm',
              }),
              'h-8 w-8 p-0 text-xs font-mono',
            )
          "
        >
          {{ page.value }}
        </PaginationListItem>
        <span
          v-else
          :key="page.type"
          class="flex h-8 w-8 items-center justify-center text-xs text-zinc-600"
        >
          &#8230;
        </span>
      </template>

      <PaginationNext
        :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 w-8 p-0')"
      >
        <ChevronRight class="h-4 w-4" />
      </PaginationNext>
    </PaginationList>
  </PaginationRoot>
</template>
