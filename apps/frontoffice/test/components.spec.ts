import { describe, it, expect } from 'vitest';
import ExploreView from '../src/components/ExploreView.vue';
import CreateTokenView from '../src/components/CreateTokenView.vue';
import TradeView from '../src/components/TradeView.vue';
import ProfileView from '../src/components/ProfileView.vue';
import AnalyticsView from '../src/components/AnalyticsView.vue';
import MemestockView from '../src/components/MemestockView.vue';
import Navbar from '../src/components/Navbar.vue';
import ThemeToggle from '../src/components/ThemeToggle.vue';
import SearchDialog from '../src/components/SearchDialog.vue';
import PrivacyDialog from '../src/components/PrivacyDialog.vue';
import WalletModal from '../src/components/WalletModal.vue';
import CookieConsentBanner from '../src/components/CookieConsentBanner.vue';

describe('Frontoffice UI Components Suite', () => {
  it('validates all core view components are properly defined SFC modules', () => {
    const views = [
      { name: 'ExploreView', comp: ExploreView },
      { name: 'CreateTokenView', comp: CreateTokenView },
      { name: 'TradeView', comp: TradeView },
      { name: 'ProfileView', comp: ProfileView },
      { name: 'AnalyticsView', comp: AnalyticsView },
      { name: 'MemestockView', comp: MemestockView },
    ];

    for (const v of views) {
      expect(v.comp).toBeDefined();
      expect(typeof v.comp).toBe('object');
      expect(v.comp.__name || v.comp.name).toBe(v.name);
    }
  });

  it('validates all global layout & dialog components are properly defined SFC modules', () => {
    const dialogs = [
      { name: 'Navbar', comp: Navbar },
      { name: 'ThemeToggle', comp: ThemeToggle },
      { name: 'SearchDialog', comp: SearchDialog },
      { name: 'PrivacyDialog', comp: PrivacyDialog },
      { name: 'WalletModal', comp: WalletModal },
      { name: 'CookieConsentBanner', comp: CookieConsentBanner },
    ];

    for (const d of dialogs) {
      expect(d.comp).toBeDefined();
      expect(typeof d.comp).toBe('object');
      expect(d.comp.__name || d.comp.name).toBe(d.name);
    }
  });
});
