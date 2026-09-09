<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'accept'): void;
}>();

const open = defineModel<boolean>('open', { default: false });
const agreed = ref(false);

function handleAccept() {
  if (!agreed.value) return;
  open.value = false;
  emit('accept');
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-2 text-emerald-400 mb-1">
          <ShieldCheck class="w-5 h-5" />
          <DialogTitle>{{ t('privacyAgreementTitle') }}</DialogTitle>
        </div>
        <DialogDescription>
          {{ t('privacyAgreementDesc') }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="space-y-3 py-2 text-xs text-zinc-400 max-h-48 overflow-y-auto pr-2 border-y border-zinc-800"
      >
        <p>
          1. <strong class="text-zinc-200">Non-Custodial:</strong> Proto Labs does not custody user
          assets, private keys, or control liquidity after deployment.
        </p>
        <p>
          2. <strong class="text-zinc-200">Irreversible Transactions:</strong> All swaps and token
          launches submitted through your connected Web3 wallet execute directly on the blockchain.
        </p>
        <p>
          3. <strong class="text-zinc-200">Market Volatility:</strong> Fixed-supply memecoins and
          newly deployed tokens may experience extreme volatility or total capital loss.
        </p>
        <p>
          4. <strong class="text-zinc-200">Privacy:</strong> We do not sell personal data. Public
          onchain wallet addresses and transactions are recorded on the public ledger.
        </p>
      </div>

      <div class="flex items-center space-x-2 pt-2">
        <input
          id="privacy-terms"
          v-model="agreed"
          type="checkbox"
          class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
        />
        <Label
          for="privacy-terms"
          class="text-xs font-normal text-zinc-300 normal-case cursor-pointer"
        >
          <a
            href="/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            class="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
            @click.stop
          >
            {{ t('termsOfService') }}
          </a>
          &amp;
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            class="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
            @click.stop
          >
            {{ t('privacyPolicy') }}
          </a>
        </Label>
      </div>

      <DialogFooter class="pt-2">
        <Button :disabled="!agreed" @click="handleAccept" class="w-full">
          {{ t('acceptAndContinue') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
