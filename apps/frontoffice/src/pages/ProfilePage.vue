<template>
  <ProfileView :address="address" />
</template>

<script setup lang="ts">
import { ProfileView } from '@/components/profile';

defineProps<{
  address?: string;
}>();
</script>
