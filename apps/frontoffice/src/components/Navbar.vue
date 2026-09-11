<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import {
  Search,
  Compass,
  PlusCircle,
  Activity,
  AlertTriangle,
  Wallet,
  LogOut,
  Copy,
  Check,
  User,
  Menu,
  X,
} from 'lucide-vue-next';
import { useWallet } from '../composables/useWallet';
import { useI18n } from '../lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { Button } from '@/components/ui/button';
import { Jazzicon } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

defineEmits<{
  (e: 'openSearch'): void;
}>();

const { t } = useI18n();
const route = useRoute();
const mobileMenuOpen = ref(false);

function isRouteActive(path: string) {
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

<template>
  <header
    class="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur sticky top-0 z-50 transition-colors shadow-sm dark:shadow-none"
  >
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <!-- Left: Brand & Desktop Nav -->
      <div class="flex items-center gap-6">
        <RouterLink
          to="/launchpad"
          class="flex items-center text-xl font-extrabold tracking-tight text-black dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition"
        >
          <span>proto</span>
        </RouterLink>

        <!-- Desktop Navigation Routes: visible on md and up -->
        <nav class="hidden md:flex items-center gap-1 text-sm font-medium">
          <RouterLink
            to="/launchpad"
            :class="[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/launchpad')
                ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60',
            ]"
          >
            <Compass class="w-3.5 h-3.5" />
            {{ t('explore') }}
          </RouterLink>

          <RouterLink
            to="/launchpad/create"
            :class="[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/launchpad/create')
                ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60',
            ]"
          >
            <PlusCircle class="w-3.5 h-3.5" />
            {{ t('create') }}
          </RouterLink>

          <RouterLink
            to="/memestock"
            :class="[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/memestock')
                ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60',
            ]"
          >
            {{ t('memestock') }}
          </RouterLink>

          <RouterLink
            to="/analytics"
            :class="[
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/analytics')
                ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60',
            ]"
          >
            <Activity class="w-3.5 h-3.5" />
            {{ t('analytics') }}
          </RouterLink>
        </nav>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Search Trigger Button -->
        <Button
          variant="outline"
          size="sm"
          @click="$emit('openSearch')"
          class="h-8 px-2.5 text-xs text-zinc-500 dark:text-zinc-400 gap-1.5 font-normal border-zinc-200 dark:border-zinc-800 hover:text-black dark:hover:text-white"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="hidden sm:inline font-mono">{{
            t('searchPlaceholder') ? 'Search...' : 'Search'
          }}</span>
          <kbd
            class="hidden sm:inline font-mono text-[10px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-1 rounded"
          >
            ⌘K
          </kbd>
        </Button>

        <!-- Language Switcher Component -->
        <LanguageSwitcher />

        <!-- Dark/Light Theme Mode Toggle -->
        <ThemeToggle />

        <!-- Wrong Network Warning Button -->
        <Button
          v-if="isConnected && !isCorrectNetwork"
          variant="destructive"
          size="sm"
          class="h-8 gap-1 text-xs font-semibold animate-pulse"
          @click="switchOrAddNetwork"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('switchToRobinhood') }}</span>
          <span class="sm:hidden">Network</span>
        </Button>

        <!-- Connect Wallet Button -->
        <Button
          v-if="!isConnected"
          size="sm"
          class="h-8 gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black shadow-sm"
          :disabled="isConnecting"
          @click="openWallet"
        >
          <Wallet class="w-3.5 h-3.5" />
          <span>{{ isConnecting ? t('connecting') : t('connectWallet') }}</span>
        </Button>

        <!-- Connected Wallet Dropdown -->
        <div v-else class="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-8 gap-2 text-xs font-mono border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Jazzicon :address="account" :size="16" class="rounded-full" />
                <span class="font-bold text-black dark:text-white">{{ formattedAddress }}</span>
                <span class="hidden sm:inline text-zinc-500 font-normal"
                  >({{ formattedBalance }})</span
                >
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              class="w-60 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <DropdownMenuLabel class="flex items-center gap-2.5 py-2">
                <Jazzicon
                  :address="account"
                  :size="28"
                  class="border border-zinc-300 dark:border-zinc-700"
                />
                <div class="truncate">
                  <span class="block text-xs font-bold text-black dark:text-white">{{
                    t('connectedAccount')
                  }}</span>
                  <span
                    class="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate"
                  >
                    {{ account }}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="border-zinc-200 dark:border-zinc-800" />

              <DropdownMenuItem as-child>
                <RouterLink
                  to="/profile"
                  class="flex items-center gap-2 w-full cursor-pointer text-black dark:text-white"
                >
                  <User class="w-3.5 h-3.5" />
                  <span>{{ t('myProfileAndFees') }}</span>
                </RouterLink>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="copyAddress"
                class="cursor-pointer text-black dark:text-white"
              >
                <Copy v-if="!copied" class="w-3.5 h-3.5" />
                <Check v-else class="w-3.5 h-3.5 text-emerald-500" />
                <span>{{ copied ? t('addressCopied') : t('copyAddress') }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="openWallet"
                class="cursor-pointer text-black dark:text-white"
              >
                <Wallet class="w-3.5 h-3.5" />
                <span>{{ t('switchManageWallet') }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator class="border-zinc-200 dark:border-zinc-800" />

              <DropdownMenuItem
                @click="disconnectWallet"
                class="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300 focus:bg-rose-50 dark:focus:bg-rose-950/40 cursor-pointer"
              >
                <LogOut class="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>{{ t('disconnect') }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Mobile Hamburger Button: visible on small screens -->
        <Button
          variant="ghost"
          size="sm"
          class="md:hidden h-8 w-8 p-0 text-black dark:text-white"
          @click="mobileMenuOpen = !mobileMenuOpen"
          aria-label="Toggle navigation menu"
        >
          <X v-if="mobileMenuOpen" class="w-5 h-5" />
          <Menu v-else class="w-5 h-5" />
        </Button>
      </div>
    </div>

    <!-- Mobile Drawer Menu: displayed when mobileMenuOpen is true -->
    <div
      v-if="mobileMenuOpen"
      class="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1"
    >
      <RouterLink
        to="/launchpad"
        @click="mobileMenuOpen = false"
        :class="[
          'flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition',
          isRouteActive('/launchpad')
            ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white',
        ]"
      >
        <Compass class="w-4 h-4" />
        {{ t('explore') }}
      </RouterLink>

      <RouterLink
        to="/launchpad/create"
        @click="mobileMenuOpen = false"
        :class="[
          'flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition',
          isRouteActive('/launchpad/create')
            ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white',
        ]"
      >
        <PlusCircle class="w-4 h-4" />
        {{ t('create') }}
      </RouterLink>

      <RouterLink
        to="/memestock"
        @click="mobileMenuOpen = false"
        :class="[
          'flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition',
          isRouteActive('/memestock')
            ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white',
        ]"
      >
        {{ t('memestock') }}
      </RouterLink>

      <RouterLink
        to="/analytics"
        @click="mobileMenuOpen = false"
        :class="[
          'flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition',
          isRouteActive('/analytics')
            ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white',
        ]"
      >
        <Activity class="w-4 h-4" />
        {{ t('analytics') }}
      </RouterLink>

      <RouterLink
        to="/profile"
        @click="mobileMenuOpen = false"
        :class="[
          'flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition',
          isRouteActive('/profile')
            ? 'bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white',
        ]"
      >
        <User class="w-4 h-4" />
        {{ t('profile') }}
      </RouterLink>
    </div>
  </header>
</template>
