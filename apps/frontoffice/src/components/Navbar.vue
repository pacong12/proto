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
import { getChainIcon, getChainShortName } from '@/lib/utils';
import { SUPPORTED_CHAINS } from '@goton/shared-types';
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
import { getUserIdentity } from '@/lib/username';

defineEmits<{
  (e: 'openSearch'): void;
}>();

const { t, locale, locales, setLocale, currentLocaleOption } = useI18n();
const route = useRoute();
const mobileMenuOpen = ref(false);

const mode = useColorMode({
  emitAuto: false,
  initialValue: 'dark',
  modes: {
    dark: 'dark',
    light: 'light',
  },
  storageKey: 'proto-color-theme',
});

const isDark = computed(() => mode.value === 'dark');

function toggleTheme() {
  mode.value = mode.value === 'dark' ? 'light' : 'dark';
}

watch(
  () => route.path,
  () => {
    mobileMenuOpen.value = false;
  },
);

const userProfileUrl = computed(() => {
  if (account.value) {
    return `/${getUserIdentity(account.value).name}`;
  }
  return '/launchpad';
});

function isRouteActive(path: string) {
  if (path === '/launchpad') {
    return route.path === '/launchpad' || route.path === '/' || route.path === '/explore';
  }
  if (path === '/profile') {
    const userPath = account.value ? `/${getUserIdentity(account.value).name}` : '';
    return (
      route.path.startsWith('/profile') ||
      route.path.startsWith('/u') ||
      (Boolean(userPath) && route.path === userPath)
    );
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
          class="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-foreground hover:opacity-85 transition group"
        >
          <div
            class="w-7 h-7 shrink-0 flex items-center justify-center select-none pointer-events-none"
          >
            <img
              src="/logo-pink.svg"
              alt="goton"
              draggable="false"
              oncontextmenu="return false;"
              class="w-6.5 h-6.5 object-contain transition-transform group-hover:scale-105 select-none pointer-events-none"
            />
          </div>
          <span class="tracking-tight">goton</span>
        </RouterLink>

        <!-- Desktop Navigation Routes: visible on lg and up -->
        <nav class="hidden lg:flex items-center gap-1.5 text-sm font-medium">
          <RouterLink
            to="/launchpad"
            :class="[
              'inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-medium transition-colors',
              isRouteActive('/launchpad')
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ]"
          >
            {{ t('explore') }}
          </RouterLink>

          <RouterLink
            to="/launchpad/create"
            :class="[
              'inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-medium transition-colors',
              isRouteActive('/launchpad/create')
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ]"
          >
            {{ t('create') }}
          </RouterLink>

          <RouterLink
            to="/memestock"
            :class="[
              'inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-medium transition-colors',
              isRouteActive('/memestock')
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ]"
          >
            {{ t('memestock') }}
          </RouterLink>

          <RouterLink
            to="/feed"
            :class="[
              'inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-medium transition-colors',
              isRouteActive('/feed')
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ]"
          >
            {{ t('feed') }}
          </RouterLink>

          <RouterLink
            to="/analytics"
            :class="[
              'inline-flex items-center h-9 px-3.5 rounded-xl text-sm font-medium transition-colors',
              isRouteActive('/analytics')
                ? 'bg-foreground text-background font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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
          class="h-9 w-9 p-0 md:w-auto md:px-3 lg:w-9 lg:px-0 xl:w-auto xl:px-3 text-xs text-muted-foreground gap-2 font-normal border-border bg-card hover:bg-muted hover:text-foreground rounded-xl shrink-0"
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search class="w-3.5 h-3.5" />
          <!-- Labels show at md and xl only; below md and at lg (nav links visible) the bar would overflow. -->
          <span class="hidden md:inline lg:hidden xl:inline">{{
            t('searchPlaceholder') ? 'Search...' : 'Search'
          }}</span>
          <kbd
            class="hidden md:inline lg:hidden xl:inline text-xs bg-muted border border-border px-1.5 py-0.5 rounded-md"
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
            :aria-label="`${t('network')}: ${activeNetwork.name}`"
            class="h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 w-auto text-xs border-border bg-card hover:bg-muted cursor-pointer text-foreground rounded-xl shrink-0"
          >
            <div class="flex items-center gap-1.5 sm:gap-2">
              <img
                :src="getChainIcon(activeNetwork)"
                :alt="activeNetwork.name"
                class="w-4 h-4 rounded-xs object-contain shrink-0"
              />
              <span class="font-semibold text-foreground hidden md:inline lg:hidden xl:inline">
                {{ activeNetwork.name }}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent
            align="end"
            class="w-64 bg-card border border-border p-2 shadow-2xl rounded-2xl"
          >
            <SelectLabel
              class="text-xs uppercase tracking-wider text-muted-foreground px-3 py-1.5 font-semibold"
            >
              Select Network
            </SelectLabel>
            <SelectSeparator class="my-1 border-border" />
            <SelectItem
              v-for="net in Object.values(SUPPORTED_CHAINS)"
              :key="net.chainId"
              :value="String(net.chainId)"
              class="cursor-pointer text-xs py-2.5 px-3 hover:bg-muted rounded-xl transition my-0.5"
            >
              <div class="flex items-center gap-3">
                <img
                  :src="getChainIcon(net)"
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

        <!-- Theme Switcher: header from sm up; on phones the drawer has the theme control. -->
        <Button
          variant="outline"
          size="sm"
          class="hidden sm:inline-flex h-9 w-9 p-0 border-border bg-card hover:bg-muted text-foreground rounded-xl cursor-pointer shrink-0"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="w-4 h-4 text-amber-400" />
          <Moon v-else class="w-4 h-4 text-foreground" />
        </Button>
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
                class="h-9 px-3 gap-2 text-sm font-semibold border-border bg-card hover:bg-muted cursor-pointer rounded-xl shrink-0"
              >
                <Jazzicon :address="account" :size="18" class="rounded-full shrink-0" />
                <span
                  class="font-bold text-foreground text-sm hidden min-[480px]:inline truncate max-w-[150px]"
                  >{{ getUserIdentity(account).name }}</span
                >
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              class="w-80 p-2.5 bg-card border border-border shadow-2xl rounded-2xl space-y-1.5"
            >
              <DropdownMenuLabel
                class="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/60 mb-1"
              >
                <Jazzicon
                  :address="account"
                  :size="40"
                  class="rounded-full border border-border shrink-0"
                />
                <div class="truncate min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="text-sm font-bold text-foreground truncate">
                      {{ getUserIdentity(account).displayName }}
                    </span>
                    <span class="text-sm font-bold text-primary shrink-0">
                      {{ formattedBalance }}
                    </span>
                  </div>
                  <span
                    class="block text-xs font-medium text-muted-foreground truncate mt-0.5"
                    :title="account || ''"
                  >
                    {{ account }}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="my-1.5 border-border" />

              <DropdownMenuItem as-child>
                <RouterLink
                  :to="userProfileUrl"
                  class="flex items-center gap-3 w-full cursor-pointer text-foreground px-3.5 py-3 text-sm font-medium rounded-xl hover:bg-muted transition"
                >
                  <User class="w-4.5 h-4.5" />
                  <span>{{ t('myProfileAndFees') }}</span>
                </RouterLink>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="copyAddress"
                class="cursor-pointer text-foreground px-3.5 py-3 text-sm font-medium rounded-xl hover:bg-muted transition flex items-center gap-3"
              >
                <Copy v-if="!copied" class="w-4.5 h-4.5" />
                <Check v-else class="w-4.5 h-4.5 text-primary" />
                <span>{{ copied ? t('addressCopied') : t('copyAddress') }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="openWallet"
                class="cursor-pointer text-foreground px-3.5 py-3 text-sm font-medium rounded-xl hover:bg-muted transition flex items-center gap-3"
              >
                <Wallet class="w-4.5 h-4.5" />
                <span>{{ t('switchManageWallet') }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator class="my-1.5 border-border" />

              <!-- Theme Toggle in Profile Menu -->
              <DropdownMenuItem
                class="flex items-center justify-between px-3.5 py-3 text-sm font-medium rounded-xl cursor-pointer hover:bg-muted transition"
                @click="toggleTheme"
              >
                <div class="flex items-center gap-3">
                  <Sun v-if="isDark" class="w-4.5 h-4.5 text-amber-500" />
                  <Moon v-else class="w-4.5 h-4.5 text-primary" />
                  <span>{{ isDark ? 'Light Theme' : 'Dark Theme' }}</span>
                </div>
                <span class="text-sm text-muted-foreground capitalize font-semibold">{{
                  mode
                }}</span>
              </DropdownMenuItem>
              <!-- Language Submenu using DropdownMenuPortal (Scroll-Free 2-Column Grid) -->
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  class="flex items-center justify-between px-3.5 py-3 text-sm font-medium rounded-xl cursor-pointer hover:bg-muted transition"
                >
                  <div class="flex items-center gap-3">
                    <Globe class="w-4.5 h-4.5 text-muted-foreground" />
                    <span>Language</span>
                  </div>
                  <span class="text-sm text-primary font-bold uppercase mr-1">{{
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
                      class="flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-xl cursor-pointer hover:bg-muted transition"
                      :class="{
                        'font-bold text-primary bg-primary/10': item.code === locale,
                      }"
                      @click="setLocale(item.code)"
                    >
                      <div class="flex items-center gap-2.5 truncate">
                        <span class="text-base leading-none">{{ item.flag }}</span>
                        <span class="truncate">{{ item.nativeName }}</span>
                      </div>
                      <Check
                        v-if="item.code === locale"
                        class="w-4 h-4 text-primary shrink-0 ml-1"
                      />
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator class="my-1.5 border-border" />

              <DropdownMenuItem
                @click="disconnectWallet"
                class="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer px-3.5 py-3 text-sm font-semibold rounded-xl transition flex items-center gap-3 hover:bg-destructive/10"
              >
                <LogOut class="w-4.5 h-4.5 text-destructive" />
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
          to="/feed"
          @click="mobileMenuOpen = false"
          :class="[
            'flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition',
            isRouteActive('/feed')
              ? 'bg-muted text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          ]"
        >
          {{ t('feed') }}
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
          :to="userProfileUrl"
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
                <span class="text-xs font-bold text-foreground block truncate">{{
                  getUserIdentity(account).displayName
                }}</span>
                <span class="text-xs text-primary font-semibold">{{ formattedBalance }}</span>
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

        <!-- Theme & Language Section in Mobile Drawer -->
        <div class="space-y-2.5 pt-1">
          <!-- Network Switcher Card in Mobile Drawer -->
          <div
            class="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card"
          >
            <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
              <img
                :src="getChainIcon(activeNetwork)"
                :alt="activeNetwork.name"
                class="w-4 h-4 rounded-xs object-contain shrink-0"
              />
              <span>{{ activeNetwork.name }}</span>
            </div>
            <div class="flex items-center gap-1">
              <Button
                v-for="net in Object.values(SUPPORTED_CHAINS)"
                :key="net.chainId"
                size="sm"
                variant="outline"
                class="h-7 px-2.5 text-xs font-bold cursor-pointer border-border"
                :class="
                  activeNetwork.chainId === net.chainId
                    ? 'bg-primary text-primary-foreground border-primary'
                    : ''
                "
                @click="handleChainSelect(net.chainId)"
              >
                {{ getChainShortName(net) }}
              </Button>
            </div>
          </div>

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
              class="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground px-0.5 font-semibold"
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
                <span class="text-xs">{{ l.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
