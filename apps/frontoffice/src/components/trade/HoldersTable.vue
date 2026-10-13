<template>
  <div class="space-y-0">
    <div v-if="loading && holders.length === 0" class="py-16 text-center text-muted-foreground">
      <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
      <span class="text-xs">Loading holders...</span>
    </div>

    <div v-else-if="holders.length === 0" class="py-16 text-center text-muted-foreground">
      <p class="text-xs">No holder data available.</p>
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-border bg-black">
      <Table class="w-full text-left text-xs min-w-[500px] bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground bg-black hover:bg-black">
            <TableHead class="py-2.5 px-3 font-semibold w-10 text-muted-foreground bg-black">
              #
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black">
              Holder
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold w-44 text-muted-foreground bg-black">
              Share
            </TableHead>
            <TableHead class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black">
              Balance
            </TableHead>
            <TableHead
              class="py-2.5 px-3 font-semibold text-right w-8 text-muted-foreground bg-black"
            ></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(holder, idx) in paginatedHolders"
            :key="holder.address"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <TableCell class="py-2.5 px-3 text-muted-foreground font-bold">
              #{{ (currentPage - 1) * pageSize + idx + 1 }}
            </TableCell>
            <TableCell class="py-2.5 px-3 whitespace-nowrap">
              <div class="flex items-center gap-1.5">
                <Jazzicon :address="holder.address" :size="14" />
                <RouterLink
                  :to="'/' + getUserIdentity(holder.address).name"
                  class="text-foreground font-medium hover:underline"
                >
                  {{ getUserIdentity(holder.address).displayName }}
                </RouterLink>
                <button
                  type="button"
                  aria-label="Copy holder address"
                  class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                  @click="copyAddress(holder.address, 'holder-' + idx)"
                >
                  <Check v-if="copiedId === 'holder-' + idx" class="w-3 h-3 text-emerald-400" />
                  <Copy v-else class="w-3 h-3" />
                </button>
                <TraderTagBadge
                  v-if="deployer && holder.address.toLowerCase() === deployer.toLowerCase()"
                  tag="dev"
                  size="sm"
                />
                <TraderTagBadge
                  v-else-if="
                    holder.percent >= 3.0 &&
                    holder.address.toLowerCase() !== lockerAddress.toLowerCase()
                  "
                  tag="whale"
                  size="sm"
                />
                <Badge
                  v-else-if="getHolderBadge(holder.address)"
                  variant="outline"
                  class="text-xs px-1.5 py-0 h-4 border-border text-muted-foreground"
                >
                  {{ getHolderBadge(holder.address) }}
                </Badge>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <span class="text-foreground font-semibold w-12 text-right shrink-0">
                  {{ holder.percent.toFixed(2) }}%
                </span>
                <Progress :model-value="holder.percent" class="h-1.5 w-28" />
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 whitespace-nowrap text-right text-foreground">
              {{ formatTokenNumber(holder.balance) }}
            </TableCell>
            <TableCell class="py-2.5 px-3 whitespace-nowrap text-right">
              <a
                v-if="explorerUrl"
                :href="`${explorerUrl}/address/${holder.address}`"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View holder on explorer"
                class="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
              >
                <ExternalLink class="w-3 h-3" />
              </a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Holders Pagination -->
      <div
        v-if="holders.length > pageSize"
        class="py-3 border-t border-border flex justify-center bg-black"
      >
        <Pagination
          :total="holders.length"
          :items-per-page="pageSize"
          :page="currentPage"
          @update:page="currentPage = $event"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Loader2, Copy, Check, ExternalLink } from 'lucide-vue-next';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { Badge, TraderTagBadge } from '@/components/ui/badge';
import { Jazzicon } from '@/components/ui/avatar';
import { formatTokenNumber } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { TokenHolder } from '@proto/shared-types';

interface Props {
  holders: TokenHolder[];
  loading?: boolean;
  deployer?: string;
  lockerAddress?: string;
  poolAddress?: string;
  explorerUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  deployer: '',
  lockerAddress: '',
  poolAddress: '',
  explorerUrl: '',
});

const currentPage = ref(1);
const pageSize = 10;
const copiedId = ref<string | null>(null);

function copyAddress(address: string, id: string) {
  if (typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(address);
    copiedId.value = id;
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null;
    }, 2000);
  }
}

const paginatedHolders = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return props.holders.slice(start, start + pageSize);
});

watch(
  () => props.holders,
  (list) => {
    const max = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage.value > max) currentPage.value = 1;
  },
);

function getHolderBadge(addr: string): string | null {
  const lower = addr.toLowerCase();
  if (props.lockerAddress && lower === props.lockerAddress.toLowerCase()) return 'LP Locker';
  if (props.deployer && lower === props.deployer.toLowerCase()) return 'Creator';
  if (props.poolAddress && lower === props.poolAddress.toLowerCase()) return 'Pool';
  return null;
}
</script>
