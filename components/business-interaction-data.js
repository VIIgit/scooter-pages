/**
 * Business Interaction Patterns — Data & Configuration
 *
 * Static metadata for entities, connections, SVG paths, and patterns.
 * Consumed by business-interaction-story.js (the display component).
 *
 * Usage:
 *   <script src="../components/business-interaction-data.js"></script>
 *   <script src="../components/business-interaction-story.js"></script>
 */
(function () {
  'use strict';

  // ─── Lucide-style inline SVG icons ──────────────────────────────────────────
  const ICONS = {
    building2:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
    globe:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    user:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    handshake:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>',
    chevronDown:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    arrowRight:
      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  };

  // ─── Entity Config ──────────────────────────────────────────────────────────
  const ENTITIES = [
    { id: 'company',  label: 'Our Company',     sublabel: 'The Business',        icon: 'building2', cx: 320, cy:  70, color: '#1d1d1f', bg: '#f0f0f5' , image: '../images/w.png' },
    { id: 'public',   label: 'Public User',     sublabel: 'Unauthenticated',     icon: 'globe',     cx:  80, cy:  78, color: '#007AFF', bg: '#e8f0ff' },
    { id: 'customer', label: 'Customer',         sublabel: 'Authenticated Human', icon: 'user',      cx:  80, cy: 312, color: '#8E5CF6', bg: '#f0ebff' },
    { id: 'partner',  label: 'Business Partner', sublabel: 'Third-Party',         icon: 'handshake', cx: 470, cy: 210, color: '#FF9500', bg: '#fff4e0' },
  ];

  const ENTITY_MAP = {};
  ENTITIES.forEach(function (e) { ENTITY_MAP[e.id] = e; });

  // ─── SVG Paths (viewBox 0 0 620 380) ───────────────────────────────────────
  const CONNECTION_PATHS = {
    'company-public':   'M 289 54 L 111 94',
    'company-customer': 'M 289 87 L 112 294',
    'company-partner':  'M 352 70 L 470 180',
    'partner-customer': 'M 437 221 Q 275 382 113 302',
  };

  // Label anchor points (midpoint of each path)
  const LABEL_ANCHOR = {
    'company-public':   [200, 74],
    'company-customer': [201, 191],
    'company-partner':  [411, 125],
    'partner-customer': [275, 322],
  };

  // ─── All Connections ────────────────────────────────────────────────────────
  const ALL_CONNECTIONS = [
    { id: 'company-public',   from: 'company', to: 'public',   label: 'Public API',   bidir: true  },
    { id: 'company-customer', from: 'company', to: 'customer', label: 'Auth API',     bidir: true  },
    { id: 'company-partner',  from: 'company', to: 'partner',  label: 'Partner API',  bidir: true  },
    { id: 'partner-customer', from: 'partner', to: 'customer', label: 'Consumer App', bidir: false },
  ];

  // ─── Background Zones (viewBox 0 0 620 380) ─────────────────────────────────
  const BACKGROUND_ZONES = [
    { id: 'zone-consumer', x: 18, y: 20, width: 148, height: 340, rx: 20, entity: 'public'  },
    { id: 'zone-partner',  x: 380, y: 60, width: 218, height: 220, rx: 20, entity: 'partner' },
    { id: 'zone-center',  x: 250, y: 130, width: 130, height: 220, rx: 20, entity: 'company' },
  ];

  // ─── Zone Labels ────────────────────────────────────────────────────────────
  const ZONE_LABELS = [
    { id: 'zone-label-consumer', x: 92,  y: 16, label: 'CONSUMER-FACING' },
    { id: 'zone-label-partner',  x: 489, y: 38, label: 'PARTNER-FACING'  },
  ];

  // ─── Patterns ───────────────────────────────────────────────────────────────
  const PATTERNS = [
    {
      id: 'overview',
      label: 'Overview',
      fullLabel: 'All Interaction Patterns',
      color: '#1d1d1f',
      title: 'One company. Many relationships.',
      subtitle: 'The entities are always the same.',
      description:
        'The same company, the same customer, the same business partner — but the relationship between them tells a different story each time. Each Business Interaction Pattern defines who participates, how they authenticate, and what data flows across your APIs.',
      flow: [],
      activeEntities: ['company', 'public', 'customer', 'partner'],
      activeConnections: [],
      tags: ['B2P', 'B2C', 'B2B2C', 'B2B'],
    },
    {
      id: 'b2p',
      label: 'B2P',
      fullLabel: 'Business to Public',
      color: '#007AFF',
      title: 'Open to everyone, everywhere.',
      subtitle: 'Unauthenticated public access — no credentials required.',
      description:
        'Public-facing services require no identity. Your company exposes APIs directly to anonymous users — product catalogs, status pages, public feeds, and open data. Gateway enforces rate limits and protects the backend without requiring a session or token.',
      flow: ['company', 'public'],
      activeEntities: ['company', 'public'],
      activeConnections: ['company-public'],
      tags: ['No Auth', 'Public API', 'Rate Limiting', 'Open Data', 'API Key Optional'],
    },
    {
      id: 'b2c',
      label: 'B2C',
      fullLabel: 'Business to Consumer',
      color: '#8E5CF6',
      title: 'Direct. Personal. Trusted.',
      subtitle: 'Authenticated services delivered directly to your customers.',
      description:
        'Your company directly serves its authenticated customers. The customer logs in, establishes identity, and receives personalised services. The relationship is direct — no intermediary, no delegation. Your customer is always your customer.',
      flow: ['company', 'customer'],
      activeEntities: ['company', 'customer'],
      activeConnections: ['company-customer'],
      tags: ['OAuth 2.0', 'OIDC', 'JWT', 'Customer Data', 'Personalised'],
    },
    {
      id: 'b2b2c',
      label: 'B2B2C',
      fullLabel: 'Business to Business to Consumer',
      color: '#FF9500',
      title: 'Partners unlock your customer value.',
      subtitle: 'Your customer, accessed through a trusted third party.',
      description:
        'A business partner acts as mediator — consuming your APIs to build experiences for your shared customer. The customer remains your customer, but interacts through the partner\'s product. Gateway enforces the trust boundary at every hop, with consent and data control.',
      flow: ['company', 'partner', 'customer'],
      activeEntities: ['company', 'partner', 'customer'],
      activeConnections: ['company-partner', 'partner-customer'],
      tags: ['Partner APIs', 'Delegated Auth', 'PKCE', 'Consent', 'Shared Customer'],
    },
    {
      id: 'b2b',
      label: 'B2B',
      fullLabel: 'Business to Business',
      color: '#34C759',
      title: 'Machine to machine. No customer data.',
      subtitle: 'Direct business integration — system to system.',
      description:
        'Two businesses exchange data and services with no human in the loop. Authentication is service-account based — client credentials, mTLS, or API keys. Gateway manages throttling, SLA enforcement, and security between organisations.',
      flow: ['company', 'partner'],
      activeEntities: ['company', 'partner'],
      activeConnections: ['company-partner'],
      tags: ['Client Credentials', 'mTLS', 'API Keys', 'SLA', 'No PII'],
    },
  ];

  // ─── Export ─────────────────────────────────────────────────────────────────
  window.BusinessInteractionData = {
    ICONS: ICONS,
    ENTITIES: ENTITIES,
    ENTITY_MAP: ENTITY_MAP,
    CONNECTION_PATHS: CONNECTION_PATHS,
    LABEL_ANCHOR: LABEL_ANCHOR,
    ALL_CONNECTIONS: ALL_CONNECTIONS,
    BACKGROUND_ZONES: BACKGROUND_ZONES,
    ZONE_LABELS: ZONE_LABELS,
    PATTERNS: PATTERNS,
  };
})();
