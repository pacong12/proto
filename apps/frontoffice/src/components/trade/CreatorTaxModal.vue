<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Creator Tax Settings</DialogTitle>
        <DialogDescription>
          Configure trading taxes on ${{ currentToken.symbol }}. Changes require a 24-hour timelock
          before taking effect (max 10%).
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 text-xs">
        <div class="space-y-1.5">
          <Label for="update-buy-tax">Buy Tax (%)</Label>
          <Input
            id="update-buy-tax"
            :model-value="editBuyTax"
            type="number"
            min="0"
            max="10"
            step="0.1"
            placeholder="1"
            @update:model-value="$emit('update:editBuyTax', String($event))"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="update-sell-tax">Sell Tax (%)</Label>
          <Input
            id="update-sell-tax"
            :model-value="editSellTax"
            type="number"
            min="0"
            max="10"
            step="0.1"
            placeholder="1"
            @update:model-value="$emit('update:editSellTax', String($event))"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="update-tax-recipient">Tax Recipient Wallet</Label>
          <Input
            id="update-tax-recipient"
            :model-value="editTaxRecipient"
            type="text"
            :placeholder="account || '0x...'"
            @update:model-value="$emit('update:editTaxRecipient', String($event))"
          />
        </div>
      </div>

      <!-- Deployer: manage pending timelock proposal -->
      <div class="pt-2 border-t border-border">
        <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Pending proposal
        </p>
        <TaxTimelockPanel
          :token-address="currentToken.address"
          :pending="pendingTax"
          :has-pending="hasPendingTax"
          :is-ready="taxIsReady"
          :seconds-until-ready="taxSecondsUntilReady"
          :action-loading="taxActionLoading"
          :error="taxError"
          @accept="$emit('acceptTax')"
          @cancel="$emit('cancelTax')"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button :disabled="updatingTax" @click="$emit('updateTax')">
          <Loader2 v-if="updatingTax" class="w-4 h-4 mr-2 animate-spin" />
          Save Onchain Tax
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
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
import TaxTimelockPanel from '../tax/TaxTimelockPanel.vue';
import type { LaunchedTokenEntity } from '@proto/shared-types';

interface Props {
  open: boolean;
  currentToken: LaunchedTokenEntity;
  editBuyTax: string;
  editSellTax: string;
  editTaxRecipient: string;
  account?: string;
  pendingTax: any;
  hasPendingTax: boolean;
  taxIsReady: boolean;
  taxSecondsUntilReady: number;
  taxActionLoading: boolean;
  taxError: string | null;
  updatingTax: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'update:editBuyTax', val: string): void;
  (e: 'update:editSellTax', val: string): void;
  (e: 'update:editTaxRecipient', val: string): void;
  (e: 'acceptTax'): void;
  (e: 'cancelTax'): void;
  (e: 'updateTax'): void;
}>();
</script>
