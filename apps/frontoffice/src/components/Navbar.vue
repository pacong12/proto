<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useColorMode } from '@vueuse/core';
import {
  Search,
  AlertTriangle,
  Wallet,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  User,
  Menu,
  X,
  Sun,
  Moon,
  Globe,
} from 'lucide-vue-next';
import { useWallet } from '../composables/useWallet';
import { useI18n } from '../lib/i18n';
import { SUPPORTED_CHAINS } from '@proto/shared-types';
import { Button } from '@/components/ui/button';
import { Jazzicon } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';

defineEmits<{
  (e: 'openSearch'): void;
}>();

const { t, locale, locales, setLocale, currentLocaleOption } = useI18n();
const route = useRoute();
const mobileMenuOpen = ref(false);

const mode = useColorMode({
  emitAuto: true,
  modes: {
    dark: 'dark',
    light: 'light',
  },
  storageKey: 'proto-color-theme',
});

const isDark = computed(() => mode.value === 'dark');

function toggleTheme() {
  mode.value = isDark.value ? 'light' : 'dark';
}

watch(
  () => route.path,
  () => {
    mobileMenuOpen.value = false;
  },
);

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
  activeNetwork,
  formattedAddress,
  formattedBalance,
  disconnectWallet,
  switchOrAddNetwork,
  openWallet,
} = useWallet();

function handleChainSelect(val: unknown) {
  const chainId = Number(val);
  const target = SUPPORTED_CHAINS[chainId];
  if (target) {
    switchOrAddNetwork(target);
  }
}

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
    class="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-50 transition-colors shadow-xs"
  >
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <!-- Left: Brand & Desktop Nav -->
      <div class="flex items-center gap-6">
        <RouterLink
          to="/launchpad"
          class="flex items-center text-xl font-extrabold tracking-tight text-foreground hover:opacity-80 transition"
        >
          <span>proto</span>
        </RouterLink>

        <!-- Desktop Navigation Routes: visible on lg and up -->
        <nav class="hidden lg:flex items-center gap-1 text-sm font-medium">
          <RouterLink
            to="/launchpad"
            :class="[
              'inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/launchpad')
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            ]"
          >
            {{ t('explore') }}
          </RouterLink>

          <RouterLink
            to="/launchpad/create"
            :class="[
              'inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/launchpad/create')
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            ]"
          >
            {{ t('create') }}
          </RouterLink>

          <RouterLink
            to="/memestock"
            :class="[
              'inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/memestock')
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            ]"
          >
            {{ t('memestock') }}
          </RouterLink>

          <RouterLink
            to="/analytics"
            :class="[
              'inline-flex items-center h-8 px-3 rounded-md text-xs font-semibold transition-colors',
              isRouteActive('/analytics')
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            ]"
          >
            {{ t('analytics') }}
          </RouterLink>
        </nav>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <!-- Search Trigger Button -->
        <Button
          variant="outline"
          size="sm"
          @click="$emit('openSearch')"
          class="h-9 w-9 p-0 sm:w-auto sm:px-3 text-xs text-muted-foreground gap-2 font-normal border-border bg-card hover:bg-muted hover:text-foreground rounded-xl shrink-0"
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search class="w-3.5 h-3.5" />
          <span class="hidden sm:inline font-mono">{{
            t('searchPlaceholder') ? 'Search...' : 'Search'
          }}</span>
          <kbd
            class="hidden sm:inline font-mono text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded-md"
          >
            ⌘K
          </kbd>
        </Button>

        <!-- Network Switcher with Shadcn Select (Multi-Chain: Robinhood & Arc) -->
        <Select
          :model-value="String(activeNetwork.chainId)"
          @update:model-value="handleChainSelect"
        >
          <SelectTrigger
            class="h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 w-auto text-xs font-mono border-border bg-card hover:bg-muted cursor-pointer text-foreground rounded-xl shrink-0"
          >
            <div class="flex items-center gap-1.5 sm:gap-2">
              <img
                :src="activeNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
                :alt="activeNetwork.name"
                class="w-4 h-4 rounded-xs object-contain shrink-0"
              />
              <span class="font-semibold text-foreground hidden sm:inline">
                {{ activeNetwork.name }}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent
            align="end"
            class="w-64 bg-card border border-border p-2 shadow-2xl rounded-2xl"
          >
            <SelectLabel
              class="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-1.5"
            >
              Select Network
            </SelectLabel>
            <SelectSeparator class="my-1 border-border" />
            <SelectItem
              v-for="net in Object.values(SUPPORTED_CHAINS)"
              :key="net.chainId"
              :value="String(net.chainId)"
              class="cursor-pointer text-xs font-mono py-2.5 px-3 hover:bg-muted rounded-xl transition my-0.5"
            >
              <div class="flex items-center gap-3">
                <img
                  :src="net.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
                  :alt="net.name"
                  class="w-5 h-5 rounded-md object-contain shrink-0"
                />
                <span class="font-bold text-foreground leading-tight">
                  {{ net.name }}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <!-- Wrong Network Warning Button -->
        <Button
          v-if="isConnected && !isCorrectNetwork"
          variant="destructive"
          size="sm"
          class="h-8 gap-1 text-xs font-semibold animate-pulse"
          @click="switchOrAddNetwork()"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Switch Network</span>
          <span class="sm:hidden">Network</span>
        </Button>

        <!-- Connect Wallet Button -->
        <div v-if="!isConnected" class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <Button
            size="sm"
            class="h-9 px-2.5 sm:px-4 gap-1.5 text-xs font-semibold rounded-xl cursor-pointer shrink-0"
            :disabled="isConnecting"
            @click="openWallet"
          >
            <Wallet class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{
              isConnecting ? t('connecting') : t('connectWallet')
            }}</span>
            <span class="sm:hidden">{{ isConnecting ? '...' : 'Connect' }}</span>
          </Button>
        </div>

        <!-- Connected Wallet / Profile Dropdown Menu -->
        <div v-else class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 text-xs font-mono border-border bg-card hover:bg-muted cursor-pointer rounded-xl shrink-0"
              >
                <Jazzicon :address="account" :size="16" class="rounded-full shrink-0" />
                <span
                  class="font-bold text-foreground text-[11px] sm:text-xs hidden min-[480px]:inline"
                  >{{ formattedAddress }}</span
                >
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              class="w-72 p-2 bg-card border border-border shadow-2xl rounded-2xl space-y-1"
            >
              <DropdownMenuLabel class="flex items-center gap-3 p-3 rounded-xl bg-muted/50 mb-1">
                <Jazzicon
                  :address="account"
                  :size="36"
                  class="rounded-full border border-border shrink-0"
                />
                <div class="truncate min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-xs font-bold text-foreground font-mono truncate">
                      {{ formattedAddress }}
                    </span>
                    <span class="text-[11px] font-mono font-bold text-primary shrink-0">
                      {{ formattedBalance }}
                    </span>
                  </div>
                  <span
                    class="block text-[10px] font-mono text-muted-foreground truncate mt-0.5"
                    :title="account || ''"
                  >
                    {{ account }}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="my-1.5 border-border" />

              <DropdownMenuItem as-child>
                <RouterLink
                  to="/profile"
                  class="flex items-center gap-2.5 w-full cursor-pointer text-foreground px-3 py-2.5 text-xs rounded-xl hover:bg-muted transition"
                >
                  <User class="w-4 h-4" />
                  <span>{{ t('myProfileAndFees') }}</span>
                </RouterLink>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="copyAddress"
                class="cursor-pointer text-foreground px-3 py-2.5 text-xs rounded-xl hover:bg-muted transition flex items-center gap-2.5"
              >
                <Copy v-if="!copied" class="w-4 h-4" />
                <Check v-else class="w-4 h-4 text-primary" />
                <span>{{ copied ? t('addressCopied') : t('copyAddress') }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="openWallet"
                class="cursor-pointer text-foreground px-3 py-2.5 text-xs rounded-xl hover:bg-muted transition flex items-center gap-2.5"
              >
                <Wallet class="w-4 h-4" />
                <span>{{ t('switchManageWallet') }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator class="my-1.5 border-border" />

              <!-- Theme Toggle in Profile Menu -->
              <DropdownMenuItem
                class="flex items-center justify-between px-3 py-2.5 text-xs rounded-xl cursor-pointer hover:bg-muted transition"
                @click="toggleTheme"
              >
                <div class="flex items-center gap-2.5">
                  <Sun v-if="isDark" class="w-4 h-4 text-amber-500" />
                  <Moon v-else class="w-4 h-4 text-primary" />
                  <span>{{ isDark ? 'Light Theme' : 'Dark Theme' }}</span>
                </div>
                <span class="text-[10px] font-mono text-muted-foreground capitalize">{{
                  mode
                }}</span>
              </DropdownMenuItem>

              <!-- Language Submenu using DropdownMenuPortal (Scroll-Free 2-Column Grid) -->
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  class="flex items-center justify-between px-3 py-2.5 text-xs rounded-xl cursor-pointer hover:bg-muted transition"
                >
                  <div class="flex items-center gap-2.5">
                    <Globe class="w-4 h-4 text-muted-foreground" />
                    <span>Language</span>
                  </div>
                  <span class="text-[10px] text-primary font-bold uppercase font-mono mr-1">{{
                    currentLocaleOption.code
                  }}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent
                    class="w-84 p-2.5 grid grid-cols-2 gap-1.5 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-visible"
                  >
                    <DropdownMenuItem
                      v-for="item in locales"
                      :key="item.code"
                      class="flex items-center justify-between px-3 py-2 text-xs rounded-xl cursor-pointer hover:bg-muted transition"
                      :class="{
                        'font-bold text-primary bg-primary/10': item.code === locale,
                      }"
                      @click="setLocale(item.code)"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <span class="text-sm leading-none">{{ item.flag }}</span>
                        <span class="truncate">{{ item.nativeName }}</span>
                      </div>
                      <Check
                        v-if="item.code === locale"
                        class="w-3.5 h-3.5 text-primary shrink-0 ml-1"
                      />
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator class="my-1.5 border-border" />

              <DropdownMenuItem
                @click="disconnectWallet"
                class="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer px-3 py-2.5 text-xs rounded-xl transition flex items-center gap-2.5 hover:bg-destructive/10"
              >
                <LogOut class="w-4 h-4 text-destructive" />
                <span>{{ t('disconnect') }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Mobile Hamburger Button: visible on screens below lg -->
        <Button
          variant="ghost"
          size="sm"
          class="lg:hidden h-9 w-9 p-0 text-foreground hover:bg-muted shrink-0 cursor-pointer"
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
      class="lg:hidden border-t border-border bg-background/98 backdrop-blur-md px-4 py-4 space-y-3 shadow-xl"
    >
      <!-- Navigation Links -->
      <div class="space-y-1">
        <RouterLink
          to="/launchpad"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/launchpad')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          {{ t('explore') }}
        </RouterLink>

        <RouterLink
          to="/launchpad/create"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/launchpad/create')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          {{ t('create') }}
        </RouterLink>

        <RouterLink
          to="/memestock"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/memestock')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          {{ t('memestock') }}
        </RouterLink>

        <RouterLink
          to="/analytics"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/analytics')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          {{ t('analytics') }}
        </RouterLink>

        <RouterLink
          to="/profile"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/profile')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          <User class="w-4 h-4" />
          {{ t('profile') }}
        </RouterLink>
      </div>

      <div class="border-t border-border pt-3 space-y-3">
        <!-- Connected Account Card in Mobile Drawer -->
        <div v-if="isConnected" class="p-3 rounded-2xl border border-border bg-card space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <Jazzicon :address="account" :size="28" class="rounded-full shrink-0" />
              <div class="truncate">
                <span class="text-xs font-mono font-bold text-foreground block truncate">{{
                  formattedAddress
                }}</span>
                <span class="text-[11px] font-mono text-primary font-semibold">{{
                  formattedBalance
                }}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-border cursor-pointer shrink-0"
              @click="
                disconnectWallet();
                mobileMenuOpen = false;
              "
            >
              <LogOut class="w-3.5 h-3.5 mr-1" />
              Disconnect
            </Button>
          </div>
        </div>

        <!-- Disconnected Full Connect Button in Mobile Drawer -->
        <Button
          v-else
          class="w-full h-10 gap-2 text-xs font-bold rounded-xl cursor-pointer"
          :disabled="isConnecting"
          @click="
            openWallet();
            mobileMenuOpen = false;
          "
        >
          <Wallet class="w-4 h-4" />
          <span>{{ isConnecting ? t('connecting') : t('connectWallet') }}</span>
        </Button>

        <!-- Theme & Language Row in Mobile Drawer -->
        <!-- Theme & Language Section in Mobile Drawer -->
        <div class="space-y-2.5 pt-1">
          <!-- Theme Card -->
          <div
            class="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card"
          >
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sun v-if="isDark" class="w-4 h-4 text-foreground" />
              <Moon v-else class="w-4 h-4 text-foreground" />
              <span>{{ isDark ? 'Dark Theme' : 'Light Theme' }}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-7 px-2.5 text-xs font-semibold rounded-lg cursor-pointer border-border"
              @click="toggleTheme"
            >
              {{ isDark ? 'Switch Light' : 'Switch Dark' }}
            </Button>
          </div>

          <!-- Language Horizontal Scroll Bar -->
          <div class="space-y-1.5">
            <div
              class="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-0.5"
            >
              <Globe class="w-3.5 h-3.5" />
              <span>Language</span>
            </div>
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full min-w-0">
              <button
                v-for="l in locales"
                :key="l.code"
                type="button"
                @click="setLocale(l.code)"
                class="h-8 px-2.5 text-xs font-semibold rounded-xl border transition cursor-pointer flex items-center gap-1.5 shrink-0"
                :class="
                  locale === l.code
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs font-bold'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                "
              >
                <span>{{ l.flag }}</span>
                <span class="text-[11px]">{{ l.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
