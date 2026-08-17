window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['healthyHousingTopic'] = {
  slug: 'sf.gov/topics--healthy-housing-conditions',
  type: 'Topic',
  title: 'Healthy housing conditions',
  summary:
    'We help keep San Francisco housing healthy by protecting residents from vermin and other hazards.',
  audience: [
    'This page is for tenants, property owners and managers, and anyone researching healthy-housing services in San Francisco.',
  ],
  reading: 'Grade 6',
  karlGuide: {
    path: 'Content → Child topics → Content → Section content',
    panel: 'Child topics',
    block: 'Content',
    field: 'Section content',
    rawField: 'content_fields',
    steps: [
      'Open Karl admin → Pages → Add child page → Topic.',
      'Open Content → Child topics and choose Content for authored sections.',
      'Use Section content for Text, Resources, Spotlight, or Button link blocks as appropriate.',
    ],
    evidence: 'E1',
    status: 'confirmed',
  },
  editorNote:
    "New Topic-type page mock, verified against the real, currently-live sf.gov/topics--healthy-housing-conditions — a Topic page that sits exactly where HHVC's own program belongs in SF.gov's real information architecture, one level above where this mockup's Agency page (pestsTopic) sits. Field mapping confirmed against docs/wagtail-content-mapping.md's \"Verified against the real Karl 'Topic' add-page form\" section (2026-07-05) plus this live re-check (2026-08-12). Every card below targets a page this mockup already has — no invented pages. The live page's own 'Lead poisoning issues'/asbestos content has no equivalent anywhere in this mockup and sits outside HHVC's established Article 11 scope (CLAUDE.md's banned-terms list), so it is not reproduced; the second Services sub-group below (\"Look up records\") substitutes this mockup's own real lookup Transaction pages in its place. Mockup fields with no equivalent here, matching every other page type's own documented gaps: Primary agency, Set top-level?, Child topics, Timeline (no other Topic pages exist in this mockup to nest under or list as children).",
  sections: [
    {
      heading: 'Report a housing health issue',
      karl: "Maps to Topic's repeatable Spotlight block (Spotlight title = this heading, Spotlight description = the paragraph below, nested Button link = the button). Confirmed live: the real page's own Spotlight here links out to sf.gov/report-health-nuisance-or-hazards (a general citywide report path this mockup has no equivalent of); this mockup instead targets its own closest real analog, the rats/mice report Transaction.",
      kind: 'body',
      component: 'spotlight',
      paragraphs: [
        'Contact 311 to report healthy housing issues at homes, businesses, or other buildings.',
      ],
      button: 'Start a report',
      buttonTarget: 'rodentsReport',
    },
    {
      heading: 'General housing issues',
      karl: "Maps to one repeatable Services block (Title = this heading, Links = each card below). Confirmed live as the first of the real page's two Services sub-groups. Card titles/descriptions are inherited from each destination page (same rule as every other Services/Resources subsection in this mockup) — no text field is set here.",
      kind: 'body',
      component: 'services',
      cards: [
        { title: 'Report rats, mice, and other four-legged problems', target: 'rodentsReport' },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          target: 'insectsReport',
        },
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
        },
        {
          title: 'Pay your annual Healthy Housing fee for apartment buildings',
          target: 'payFee',
        },
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
        },
      ],
    },
    {
      heading: 'Look up records',
      karl: 'Maps to a second repeatable Services block. Substitutes for the real page\'s "Lead poisoning issues" sub-group, which has no equivalent content in this mockup (see page editorNote) — this mockup\'s own real lookup Transaction pages fill the second sub-group instead, keeping the same two-group Services shape confirmed live.',
      kind: 'body',
      component: 'services',
      cards: [
        { title: 'Find complaints and inspection records', target: 'findRecords' },
        {
          title: 'Look up residential health code violations',
          target: 'findViolations',
        },
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
        },
        { title: 'Make a public records request', target: 'publicRecords' },
      ],
    },
    {
      heading: 'Guidance and resources',
      karl: "Maps to Topic's repeatable Resources block (identical Title + Links shape to Services, per the Karl docs). The real page splits this into 3 sub-groups (general information, lead resources, health codes); this mockup collapses to one sub-group since it has no lead-specific content.",
      kind: 'body',
      component: 'resources',
      cards: [
        { title: 'Learn what Healthy Housing and Vector Control can inspect', target: 'scopeInfo' },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
        },
        { title: 'Healthy housing and pest resources', target: 'verminResources' },
        { title: 'What happens after you report a housing or pest problem', target: 'afterReport' },
        { title: 'Tenant rights when reporting housing conditions', target: 'tenantRights' },
        { title: 'Health Code Article 11 in plain language', target: 'article11Guide' },
        { title: 'Mosquito Control Program', target: 'mosquitoControl' },
      ],
    },
    {
      heading: 'Related',
      karl: "Maps to Related (raw name related_links, a repeatable StreamField — same field confirmed on Transaction/Campaign). Links to this mockup's 2 Campaign-type educational programs, a realistic editorial choice from a Topic page and confirmed Related support for Topic per the Karl Help Center docs.",
      kind: 'placement',
      component: 'related',
      cards: [
        { title: 'Free mosquito education workshop', target: 'mosquitoWorkshop' },
        { title: 'Free IPM education workshop', target: 'ipmEducation' },
      ],
    },
  ],
  // Karl's Partner agencies field — the exact pairing confirmed live on the
  // real sf.gov/topics--healthy-housing-conditions page itself.
  partnerAgencies: [
    {
      title: 'Department of Public Health',
      url: 'https://www.sf.gov/departments--department-public-health',
    },
    {
      title: 'Environmental Health',
      url: 'https://www.sf.gov/departments--department-public-health--environmental-health',
    },
  ],
  seoTitle: 'Healthy housing conditions | SF.gov',
  metaDescription:
    'Report housing health issues, find services and resources, and learn how San Francisco protects healthy housing conditions.',
}
