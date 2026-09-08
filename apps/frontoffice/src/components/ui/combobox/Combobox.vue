<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Option {
  label: string;
  value: string;
}

interface Props {
  options: Option[];
  modelValue?: string;
  placeholder?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select option...',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const search = ref('');

const selectedOption = computed(() => props.options.find((opt) => opt.value === props.modelValue));

const filteredOptions = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return props.options;
  return props.options.filter((opt) => opt.label.toLowerCase().includes(q));
});

function select(val: string) {
  emit('update:modelValue', val);
  open.value = false;
  search.value = '';
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :class="
          cn(
            'justify-between font-medium text-xs h-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all',
            props.class,
          )
        "
      >
        <span>{{ selectedOption ? selectedOption.label : props.placeholder }}</span>
        <ChevronDown
          class="ml-2 h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200"
          :class="open ? 'rotate-180' : ''"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      class="w-48 p-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl"
    >
      <div class="p-1 border-b border-zinc-200 dark:border-zinc-800">
        <input
          v-model="search"
          type="text"
          placeholder="Filter..."
          class="w-full bg-transparent px-2 py-1 text-xs placeholder:text-zinc-500 focus:outline-none font-sans"
        />
      </div>
      <div class="max-h-48 overflow-y-auto p-1 space-y-0.5">
        <button
          v-for="opt in filteredOptions"
          :key="opt.value"
          @click="select(opt.value)"
          class="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 transition cursor-pointer text-left"
        >
          <span>{{ opt.label }}</span>
          <Check
            v-if="props.modelValue === opt.value"
            class="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0"
          />
        </button>
        <p v-if="filteredOptions.length === 0" class="py-3 text-center text-xs">No results</p>
      </div>
    </PopoverContent>
  </Popover>
</template>
