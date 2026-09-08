<template>
  <header
    class="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-50 transition-colors shadow-sm dark:shadow-none"
  >
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <!-- Left: Brand + Real Router Links -->
      <div class="flex items-center gap-6">
        <RouterLink
          to="/launchpad"
          class="flex items-center text-xl font-extrabold tracking-tight hover:text-emerald-500 dark:hover:text-emerald-400 transition"
        >
          <span>proto</span>
        </RouterLink>

        <!-- Desktop Navigation Routes using Shadcn Button style -->
        <nav class="hidden lg:flex items-center gap-1 text-sm font-medium">
          <Button
            as-child
            :variant="isRouteActive('/launchpad') ? 'secondary' : 'ghost'"
            size="sm"
            class="h-8 gap-1.5 font-semibold text-xs"
          >
            <RouterLink to="/launchpad">
              <Compass class="w-3.5 h-3.5" />
              Explore
            </RouterLink>
          </Button>

          <Button
            as-child
            :variant="isRouteActive('/launchpad/create') ? 'secondary' : 'ghost'"
            size="sm"
            class="h-8 gap-1.5 font-semibold text-xs"
          >
            <RouterLink to="/launchpad/create">
              <PlusCircle class="w-3.5 h-3.5" />
              Create
            </RouterLink>
          </Button>

          <Button
            as-child
            :variant="isRouteActive('/memestock') ? 'secondary' : 'ghost'"
            size="sm"
            class="h-8 gap-1.5 font-semibold text-xs"
          >
            <RouterLink to="/memestock">
              <TrendingUp class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              Memestock
            </RouterLink>
          </Button>

          <Button
            as-child
            :variant="isRouteActive('/analytics') ? 'secondary' : 'ghost'"
            size="sm"
            class="h-8 gap-1.5 font-semibold text-xs"
          >
            <RouterLink to="/analytics">
              <Activity class="w-3.5 h-3.5" />
              Analytics
            </RouterLink>
          </Button>
        </nav>
      </div>

      <!-- Right Actions: Search + Dark Mode Toggle + Network Alert + Wallet Dropdown with MetaMask Jazzicon -->
      <div class="flex items-center gap-3">
        <!-- Search Trigger Button -->
        <Button
          variant="outline"
          size="sm"
          @click="$emit('openSearch')"
          class="h-8 gap-2 text-xs"
          aria-label="Search tokens"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Search</span>
          <Badge
            variant="secondary"
            class="h-4 px-1 text-[10px] font-mono"
          >
            ⌘K
          </Badge>
        </Button>

        <!-- Shadcn Dark Mode Toggle -->
        <ThemeToggle />

        <!-- Wrong Network Switcher -->
        <Button
          v-if="isConnected && !isCorrectNetwork"
          @click="switchOrAddNetwork(ROBINHOOD_CHAIN)"
          variant="destructive"
          size="sm"
          class="h-8 gap-1.5 text-xs font-semibold"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          Switch Network
        </Button>

        <!-- Unconnected Connect Button -->
        <Button
          v-if="!isConnected"
          @click="openWallet"
          :disabled="isConnecting"
          variant="default"
          size="sm"
          class="h-8 gap-1.5 font-semibold text-xs shadow-sm"
        >
          <Wallet class="w-4 h-4" />
          {{ isConnecting ? 'Connecting...' : 'Connect' }}
        </Button>

        <!-- Connected State: Shadcn Dropdown Menu with MetaMask-Style Jazzicon -->
        <div v-else class="flex items-center gap-2">
          <!-- Balance Badge -->
          <Badge
            variant="outline"
            class="hidden sm:flex items-center gap-1.5 h-8 px-2.5 text-xs font-mono font-normal"
          >
            <Coins class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>{{ formattedBalance }}</span>
          </Badge>

          <!-- Shadcn Dropdown Menu for Profile -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-8 gap-2 px-2 text-xs"
              >
                <!-- Deterministic MetaMask Jazzicon Avatar -->
                <Jazzicon :address="account" :size="20" class="border border-zinc-200 dark:border-zinc-700 shadow-sm" />
                <span class="font-mono text-xs font-medium">{{ formattedAddress }}</span>
                <ChevronDown class="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-60">
              <DropdownMenuLabel class="flex items-center gap-2.5 py-2">
                <Jazzicon :address="account" :size="28" class="border border-zinc-300 dark:border-zinc-700" />
                <div class="truncate">
                  <span class="block text-xs font-bold">Connected Account</span>
                  <span class="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                    {{ account }}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem as-child>
                <RouterLink to="/profile" class="flex items-center gap-2 w-full cursor-pointer">
                  <User class="w-3.5 h-3.5" />
                  <span>My Profile &amp; Fees</span>
                </RouterLink>
              </DropdownMenuItem>

              <DropdownMenuItem @click="copyAddress" class="cursor-pointer">
                <Copy v-if="!copied" class="w-3.5 h-3.5" />
                <Check v-else class="w-3.5 h-3.5 text-emerald-500" />
                <span>{{ copied ? 'Address Copied!' : 'Copy Address' }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem @click="openWallet" class="cursor-pointer">
                <Wallet class="w-3.5 h-3.5" />
                <span>Switch / Manage Wallet</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                @click="disconnectWallet"
                class="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300 focus:bg-rose-50 dark:focus:bg-rose-950/40 cursor-pointer"
              >
                <LogOut class="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>Disconnect</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import {
  Compass,
  PlusCircle,
  TrendingUp,
  Activity,
  User,
  Wallet,
  Coins,
  LogOut,
  AlertTriangle,
  Search,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-vue-next';
import { ROBINHOOD_CHAIN } from '@proto/shared-types';
import { useWallet } from '../composables/useWallet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Jazzicon } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ThemeToggle from '@/components/ThemeToggle.vue';

defineEmits<{
  (e: 'openSearch'): void;
}>();

const route = useRoute();

function isRouteActive(path: string): boolean {
  if (path === '/launchpad') {
    return route.path === '/launchpad' || route.path === '/';
  }
  return route.path.startsWith(path);
}

const {
  account,
  isConnected,
  isConnecting,
  isCorrectNetwork,
  formattedAddress,
  formattedBalance,
  disconnectWallet,
  switchOrAddNetwork,
  openWallet,
} = useWallet();

const copied = ref(false);

function copyAddress() {
  if (account.value) {
    navigator.clipboard.writeText(account.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}
</script>
