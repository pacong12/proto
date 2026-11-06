<template>
  <div class="rounded-lg border border-border p-3 space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-0.5">
        <Label for="vesting-enabled" class="text-xs font-semibold cursor-pointer">
          {{ t('vestingToggle') }}
        </Label>
        <p class="text-xs text-muted-foreground">{{ t('vestingHint') }}</p>
      </div>
      <Switch id="vesting-enabled" v-model:checked="enabled" />
    </div>
    <template v-if="enabled">
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1">
          <Label for="vesting-cliff" class="text-xs">{{ t('vestingCliffDays') }}</Label>
          <Input
            id="vesting-cliff"
            v-model="cliffDays"
            type="number"
            min="0"
            step="1"
            class="text-sm"
          />
        </div>
        <div class="space-y-1">
          <Label for="vesting-duration" class="text-xs">{{ t('vestingDurationDays') }}</Label>
          <Input
            id="vesting-duration"
            v-model="durationDays"
            type="number"
            :min="VESTING_MIN_DAYS"
            :max="VESTING_MAX_DAYS"
            step="1"
            class="text-sm"
          />
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ t('vestingSummary', { cliff: String(cliffDays), duration: String(durationDays) }) }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/i18n';
import { VESTING_MAX_DAYS, VESTING_MIN_DAYS } from '@/lib/vesting';

const { t } = useI18n();
const enabled = defineModel<boolean>('enabled', { required: true });
const cliffDays = defineModel<string>('cliffDays', { required: true });
const durationDays = defineModel<string>('durationDays', { required: true });
</script>
