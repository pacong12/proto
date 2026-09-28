<script lang="ts" setup>
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner';

const props = withDefaults(defineProps<ToasterProps>(), {
  position: 'bottom-right',
  richColors: true,
  closeButton: true,
});
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :toast-options="{
      classes: {
        toast:
          'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl font-sans',
        description: 'group-[.toast]:text-muted-foreground text-xs',
        actionButton:
          'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-semibold group-[.toast]:text-xs group-[.toast]:px-2.5 group-[.toast]:py-1.5 transition-opacity hover:opacity-90 cursor-pointer',
        cancelButton:
          'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs',
      },
    }"
  />
</template>
