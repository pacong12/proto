<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="w-[calc(100vw-2rem)] sm:max-w-md bg-card border-border text-foreground transition-all duration-200"
    >
      <DialogHeader>
        <div class="flex items-center gap-2 text-foreground mb-1">
          <ShieldAlert class="w-5 h-5 text-amber-500" />
          <DialogTitle>Community Takeover (CTO)</DialogTitle>
        </div>
        <DialogDescription class="text-xs text-muted-foreground">
          Permanently transfer all trading tax and launchpad fee accruals for this token to a new
          community multisig or developer wallet.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 font-sans">
        <div class="space-y-1.5 font-mono">
          <Label for="token-addr" class="text-xs font-medium">Target Token Address</Label>
          <Input
            id="token-addr"
            :model-value="tokenAddress"
            readonly
            disabled
            class="font-mono text-xs text-muted-foreground"
          />
        </div>

        <div class="space-y-1.5 font-mono">
          <Label for="new-recipient" class="text-xs font-medium">New Community Recipient</Label>
          <Input
            id="new-recipient"
            v-model="newRecipientAddress"
            placeholder="0x..."
            class="font-mono text-xs"
          />
        </div>

        <!-- Inline CTO Error -->
        <div
          v-if="error"
          class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 flex items-start gap-1.5 font-mono"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ error }}</span>
        </div>
      </div>

      <DialogFooter class="gap-2 font-mono">
        <Button
          variant="outline"
          size="sm"
          class="cursor-pointer"
          @click="emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          :disabled="loading || !isAddressValid(newRecipientAddress)"
          class="cursor-pointer"
          @click="handleConfirm"
        >
          <Loader2 v-if="loading" class="w-3.5 h-3.5 mr-1 animate-spin" />
          Confirm CTO Redirect
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-vue-next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps<{
  open: boolean;
  tokenAddress: string;
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'confirm', newAddress: string): void;
}>();

const newRecipientAddress = ref('');

function isAddressValid(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function handleConfirm() {
  if (isAddressValid(newRecipientAddress.value)) {
    emit('confirm', newRecipientAddress.value.trim());
  }
}
</script>
