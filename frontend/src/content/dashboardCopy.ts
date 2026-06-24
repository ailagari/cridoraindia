/** Phase 1 dashboard warmth strings (English). */

export const dashboardCopy = {
  customer: {
    holdingsScope: {
      personal: 'Personal holdings',
      personalHint: 'Gold you recorded at home',
      all: 'All holdings',
      allHint: 'Personal + jeweller vault',
      vaultContext: 'Jeweller vault',
      switchToAll: 'switch to All holdings to include',
      allIncludesVault: 'Includes gold at verified jewellers on Cridora',
    },
    personalOverview: {
      previewTitle: 'Your personal gold',
      previewEmptyLead: 'Track wedding chains, family heirlooms, and shop purchases — live value from today’s board rate.',
      previewLiveHint: 'Updates with board rate every ~30s',
      trackGold: 'Track gold',
      scanInvoice: 'Scan invoice',
      enterManually: 'Enter manually',
      addFirstPiece: 'Add your first piece',
      viewAll: 'View all',
      addShort: '+ Add',
      scanBill: 'Scan bill',
    },
    greeting: {
      splashTagline: 'Your gold has a home here.',
    },
    empty: {
      personalHoldings: {
        title: 'No personal holdings yet',
        description:
          'The chain from your wedding, gold your mother gave you, pieces you have saved over the years — they all deserve a record. Add your first piece and we will keep track of weight and value for you.',
      },
      personalHoldingsHero: 'Your family gold belongs here — add your first piece when you are ready.',
      vaultHoldings: {
        title: 'No vault holdings yet',
        description:
          'You have been saving gold gram by gram, at the counter or through a scheme. When you buy or deposit with a verified jeweller, it will show up here — counted, and cared for.',
      },
      vaultGrams:
        'No vaulted grams yet. Buy fractional gold or complete a gold deposit with your jeweller — we will keep the record for you.',
      vaultDonutLabel: 'Start your vault record',
      primaryJeweller: {
        title: 'No primary jeweller yet',
        description:
          'Most families have one jeweller they trust for years. Search below and set yours — transfers, savings, and showroom visits will feel simpler.',
      },
      primaryJewellerPanelLead:
        'Your jeweller has known your family for years. Set your primary partner here so Cridora routes new savings and transfers the way you already shop.',
      schemes: {
        title: 'No schemes here yet',
        description:
          'Golden schemes are how many Kerala families save for the next wedding or festival. Set your primary jeweller or buy fractional gold to see partner schemes here.',
      },
      schemesUnavailable: {
        title: 'Investment schemes unavailable',
        description:
          'When your jeweller is on Cridora, their savings schemes can appear here — the same trust, with a clearer record.',
      },
      vaultAddresses: {
        title: 'No vault rows yet',
        description:
          'Send gold to your daughter, receive a transfer from family, or open a vault at your jeweller — each row is a home for grams you care about.',
      },
    },
    success: {
      primaryJewellerSet: 'Your jeweller is on Cridora — you are in good hands.',
      primaryJewellerUpdated:
        'Primary jeweller updated. New transfers and savings will follow this partner — the way you already shop.',
      referralSignupWarm: 'Your regular jeweller invited you — you are in good hands.',
    },
  },
  jeweller: {
    welcome: {
      title: 'Welcome',
      lead: 'Your customers trust you with their gold. Now you can serve them even better — digitally, simply, without changing how you work.',
      dismiss: 'Dismiss welcome',
    },
    storageKey: 'cridora_jeweller_welcome_dismissed',
  },
} as const
