window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['pestsTopic'] = {
  slug: 'sf.gov/topic-healthy-housing-and-vector-control',
  type: 'Agency',
  title: 'Healthy Housing and Vector Control',
  summary:
    'Report a housing health issue, get help with pests, or find the right next step for your building.',
  audience: [
    'This page is for tenants, property owners and managers, and anyone reporting a pest or housing health problem.',
  ],
  reading: 'Grade 6',
  karlGuide: {
    path: 'Content → Section title 1 → Subsection → Links',
    panel: 'Section title 1',
    block: 'Subsection',
    field: 'Title and links',
    rawField: 'services',
    steps: [
      'Open Karl admin → Pages → Add child page → Agency.',
      'Open Content → Section title 1 and keep the required services_title value.',
      'Add a Subsection, enter this section heading as Title, then add each card as SF.gov page or External link.',
    ],
    evidence: 'E1',
    status: 'confirmed',
  },
  seoTitle: 'Healthy Housing and Vector Control | SF.gov',
  metaDescription:
    'Report pest, vector, and housing health problems, get tenant help, and find owner resources from Healthy Housing and Vector Control.',
  editorNote:
    'Redesigned from the live Healthy housing and vector control topic preview and the empty "Get help with pests, mold, or trash" topic preview as a task-first HHVC Agency landing page. It uses the latter as the first service section rather than creating a duplicate topic with the same reporting paths. It preserves the live topic’s 311 entry point, core services, inspection-program route, fee path, resource collection, and Articles 1, 2, and 11 references, but organizes them by the visitor’s decision: report, rent, manage a building, then research. Lead safety, water service, noise, asbestos, and structural construction concerns remain outside HHVC / Article 11 scope and point to Citywide services rather than being duplicated here. CARD TITLES AND TEXT ON THIS PAGE ARE NOT AUTHORED — they are inherited. A Karl Services/Resources subsection entry is only "add an SF.gov page or External link": there is no label field and no description field, so each card renders the destination page\'s own Title and Description (confirmed in the Karl editor docs, and against the live Environmental Health Agency page, whose card text is verbatim each destination\'s summary). Every `title`/`text` pair below is therefore a COPY of the destination page, kept here so the mockup renders something, and editing one changes nothing in Karl. Keep them in sync with their destination pages; to change what a card says, change that page. External-link cards are the exception worth re-checking, since they have no SF.gov page to inherit from. Agency fields intentionally left empty in this mockup: Logo, Main image, Alert, Highlights, Quick links, Call to action, Meeting information, Spotlight 1, Spotlight 2, Divisions or subcommittees, People, Public records, Topics, Archive information. That list was previously missing Quick links, Call to action, Public records and Topics, which are real Agency fields — it is now checked against the field inventory in the Karl docs ("How an Agency page works"). Two of those empties are worth revisiting rather than defaulting: Agency allows up to 2 Spotlights and both are unused, and Highlights takes exactly 2 or 3 entries, each REQUIRING an image of at least 350x200 plus a screenreader label — which on this tool means more inline WebP data URIs, so it is a real cost rather than a free win. Partner agencies to tag in Karl: 311, San Francisco Department of Public Health.',
  sections: [
    {
      heading: 'Get help with pests, mold, or trash',
      component: 'services',
      karl: 'Agency -> Services. Use one Services subsection titled "Get help with pests, mold, or trash"; each card becomes an SF.gov page link or the Citywide 311 link. This supplies the otherwise empty live topic preview as the Agency page’s first service section, preserving its intended direct 311 route while letting visitors who know the condition choose a focused reporting path.',
      kind: 'body',
      paragraphs: [
        'Report a pest, mold, trash, or housing health issue through 311. If you know the type of condition, choose a focused reporting path below.',
      ],
      cards: [
        {
          title: 'Get help with pests, mold, or trash through 311',
          text: 'Start a City service request when you are not sure which Healthy Housing and Vector Control report fits.',
          url: 'https://www.sf.gov/topics--311-online-services',
          karl: 'Services subsection entry -> external link to the live topic preview’s "contact 311" destination. This is the general entry point for the "Get help with pests, mold, or trash" topic; the three focused report pages below remain available for people who know the condition.',
        },
        {
          title: 'Report rats, mice, and other four-legged problems',
          target: 'rodentsReport',
          karl: 'Services subsection entry -> SF.gov page link to the rodents-report Transaction. The description is a copy of the destination page Description, which is what Karl renders here; see the page-level note.',
        },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          target: 'insectsReport',
          karl: 'Services subsection entry -> SF.gov page link to the insects-report Transaction. The description is a copy of the destination page Description, which is what Karl renders here; see the page-level note.',
        },
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          target: 'filthReport',
          karl: 'Services subsection entry -> SF.gov page link to the consolidated filth-report Transaction. This is the focused report route for the current live topic’s mold and trash scope; the description is a copy of the destination page Description, which is what Karl renders here.',
        },
        {
          title: 'Report a problem in an SRO or hotel',
          target: 'sroHotelReport',
          karl: "Services subsection entry -> SF.gov page link to the SRO/hotel-report Transaction, added 2026-08-11 to fill the gap findHotelRecords' lookup-only scope left. The description is a copy of the destination page Description, which is what Karl renders here; see the page-level note.",
        },
        {
          title: 'Healthy housing and pest resources',
          target: 'verminResources',
          karl: 'Services subsection entry -> SF.gov page link to the healthy-housing resources Resource Collection. Mirrors the live "Get help with vermin in your building" service, which sf.gov files under Services (General housing issues) rather than Resources — this card was previously the last entry under "Look up records and rules", where a tenant looking for self-help would not think to look. It briefly carried the task-shaped title "Get help with pests in your building"; that was reverted because a Karl subsection entry is only a page or external-link picker with NO label or description field, so the card renders the DESTINATION page\'s title and Description. Title and text here are therefore copied from `verminResources` verbatim and must be kept in sync with it — changing them here changes nothing in Karl. Getting a task-shaped label means retitling the destination page.',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
          karl: 'Services subsection entry -> SF.gov page link to the inspection-scope Information page. This integrates the live topic’s "Healthy housing inspection programs" service and is also the safe route for a visitor who cannot identify their condition.',
        },
      ],
    },
    {
      heading: 'If you rent',
      component: 'resources',
      karl: 'Agency -> Resources. Use one Resources subsection titled "If you rent"; each card becomes an SF.gov page link. It puts tenant protections and reporting expectations where a renter can find them without scanning owner-only services.',
      kind: 'body',
      paragraphs: [
        'You can ask the City for help with housing health problems. Learn how to report, what may happen next, and where to get tenant support.',
      ],
      cards: [
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
          karl: 'Resources subsection entry -> SF.gov page link to the tenant-rights Information page.',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
          karl: 'Resources subsection entry -> SF.gov page link to the after-report Information page.',
        },
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          target: 'noticeOfViolation',
          karl: 'Resources subsection entry -> SF.gov page link to the notice-of-violation Transaction.',
        },
      ],
    },
    {
      heading: 'If you own or manage a building',
      component: 'resources',
      karl: 'Agency -> Resources. Use a second Resources subsection titled "If you own or manage a building"; each card becomes an SF.gov page link. This makes owner compliance a distinct path instead of mixing it with a tenant’s urgent reporting choices.',
      kind: 'body',
      paragraphs: [
        'Use these resources to prevent pest problems, meet Article 11 responsibilities, and respond to a notice or fee.',
      ],
      cards: [
        {
          title: 'Property owner responsibilities',
          target: 'ownerHub',
          karl: 'Resources subsection entry -> SF.gov page link to the owner Resource Collection.',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
          karl: 'Resources subsection entry -> SF.gov page link to the owner-guidance Information page.',
        },
        {
          title: 'Pay your annual Healthy Housing fee for apartment buildings',
          target: 'payFee',
          karl: 'Resources subsection entry -> SF.gov page link to the fee-payment Transaction.',
        },
      ],
    },
    {
      heading: 'Look up records and rules',
      component: 'resources',
      karl: 'Agency -> Resources. Use a third Resources subsection titled "Look up records and rules"; each card becomes an SF.gov page link or an external municipal-code link. Reference tasks follow action tasks so they do not obscure reporting choices. The three Health Code articles preserve the live topic’s code references while keeping Article 11’s plain-language guide first.',
      kind: 'body',
      cards: [
        {
          title: 'Look up building records',
          target: 'recordsHub',
          karl: 'Resources subsection entry -> SF.gov page link to the records Resource Collection.',
        },
        {
          title: 'Health Code Article 11 in plain language',
          target: 'article11Guide',
          karl: 'Resources subsection entry -> SF.gov page link to the Article 11 Report page.',
        },
        {
          title: 'Health Code Article 1: Animals',
          text: 'Read the City rules about keeping and feeding animals.',
          url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-12',
          karl: 'Resources subsection entry -> external municipal-code link from the live topic preview. Article 1 is relevant to animal-related public-health nuisances; do not summarize legal requirements here.',
        },
        {
          title: 'Health Code Article 2: Communicable diseases',
          text: 'Read the City rules on communicable-disease prevention and rodent control.',
          url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_health/0-0-0-59718',
          karl: 'Resources subsection entry -> external municipal-code link from the live topic preview. Article 2 includes the rodent-control provision HHVC may enforce through Article 11; do not summarize legal requirements here.',
        },
        {
          title: 'Make a public records request',
          target: 'publicRecords',
          karl: 'Resources subsection entry -> SF.gov page link to the public-records Transaction.',
        },
      ],
    },
    {
      heading: 'Need another City housing service?',
      component: 'resources',
      karl: 'Agency -> Resources. Use a final Resources subsection for out-of-scope referrals. These are a few external links rather than a parallel directory, so the HHVC page remains limited to Article 11 while still giving a visitor a clear next destination. Keep it that way: each addition here is a scope claim in reverse, and a section that grows past a handful stops reading as "not us, try here" and starts reading as a second, worse copy of the Citywide topic.',
      kind: 'body',
      paragraphs: [
        'Lead safety, water service, noise, asbestos, and structural construction concerns may be handled by another City program.',
      ],
      cards: [
        {
          title: 'Healthy housing conditions',
          text: 'Find City services for lead safety and other healthy housing concerns outside HHVC.',
          url: 'https://www.sf.gov/topics--healthy-housing-conditions',
          karl: 'Resources subsection entry -> External link to the Citywide Healthy housing conditions topic. This route keeps lead and other non-Article-11 services out of the HHVC content model.',
        },
        {
          title: 'Report a health nuisance or hazard',
          text: 'Use the Citywide 311 service for lead, water, sewage, food, pesticide, or business hygiene concerns.',
          url: 'https://www.sf.gov/report-health-nuisance-or-hazards',
          karl: 'Resources subsection entry -> External link to the Citywide Environmental Health reporting service. This integrates the broad 311 intake without duplicating its non-HHVC services in the Article 11 page model.',
        },
        {
          title: 'Report a residential building concern',
          text: 'Report problems with a building or living conditions in a residential building or single room occupancy (SRO) hotel.',
          url: 'https://www.sf.gov/report-residential-building-concern',
          karl: 'Resources subsection entry -> External link to the Citywide residential-building reporting service. This is the FIRST service on the live "Healthy housing conditions" topic and the only one covering SRO habitability, but it spans structural and habitability problems well beyond Article 11, so it is a referral rather than an HHVC reporting path. It belongs here rather than in the Services section for that reason: a visitor whose problem is the building itself needs the door, and the HHVC page should not appear to own it.',
        },
      ],
    },
    {
      heading: 'About Healthy Housing and Vector Control',
      component: 'body',
      karl: 'Agency -> About field. Keep this short: the landing page should route tasks, not repeat a program overview.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control is part of Environmental Health at the San Francisco Department of Public Health. We address pests, vectors, garbage, filth, animal waste, overgrown vegetation, and mold from humidity or condensation under Health Code Article 11.',
      ],
    },
  ],
}
