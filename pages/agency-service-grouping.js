window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['pestsTopic'] = {
  slug: 'sf.gov/topic-healthy-housing-and-vector-control',
  type: 'Agency',
  title: 'Healthy Housing and Vector Control',
  summary:
    'Report a housing health issue, get help with pests, or find the right next step for your building.',
  audience: [
    'A tenant with a pest or housing health problem',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A property owner or manager trying to prevent pests',
    'A building worker who handles pest or housing health issues',
  ],
  reading: 'Grade 6',
  seoTitle: 'Healthy Housing and Vector Control | SF.gov',
  metaDescription:
    'Report pest, vector, and housing health problems, get tenant help, and find owner resources from Healthy Housing and Vector Control.',
  editorNote:
    'Redesigned from the live Healthy housing and vector control topic preview and the empty "Get help with pests, mold, or trash" topic preview as a task-first HHVC Agency landing page. It uses the latter as the first service section rather than creating a duplicate topic with the same reporting paths. It preserves the live topic’s 311 entry point, core services, inspection-program route, fee path, resource collection, and Articles 1, 2, and 11 references, but organizes them by the visitor’s decision: report, rent, manage a building, then research. Lead safety, water service, noise, asbestos, and structural construction concerns remain outside HHVC / Article 11 scope and point to Citywide services rather than being duplicated here. Agency fields intentionally left empty in this mockup: Logo, Main image, Alert, Highlights, Meeting information, Spotlight 2, Divisions or subcommittees, People, Archive information. Partner agencies to tag in Karl: 311, San Francisco Department of Public Health.',
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
          text: 'Report rats, mice, raccoons, burrows, droppings, or another four-legged pest problem.',
          target: 'rodentsReport',
          karl: 'Services subsection entry -> SF.gov page link to the rodents-report Transaction. The description is mockup context; confirm whether the live Services card displays it.',
        },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          text: 'Report cockroaches, bed bugs, mosquitoes, flies, wasps, mites, or standing water.',
          target: 'insectsReport',
          karl: 'Services subsection entry -> SF.gov page link to the insects-report Transaction. The description is mockup context; confirm whether the live Services card displays it.',
        },
        {
          title: 'Report garbage, mold, trash, or overgrown vegetation',
          text: 'Report garbage, clutter, animal waste, pigeon problems, overgrown plants, or mold from humidity.',
          target: 'filthReport',
          karl: 'Services subsection entry -> SF.gov page link to the consolidated filth-report Transaction. This is the focused report route for the current live topic’s mold and trash scope; the description is mockup context, so confirm whether the live Services card displays it.',
        },
        {
          title: 'Get help with pests in your building',
          text: 'Find guides, forms, videos, and prevention steps for rodents, bed bugs, mosquitoes, and pigeons.',
          target: 'verminResources',
          karl: 'Services subsection entry -> SF.gov page link to the healthy-housing resources Resource Collection. Mirrors the live "Get help with vermin in your building" service, which sf.gov files under Services (General housing issues) rather than Resources — this card was previously the last entry under "Look up records and rules", where a tenant looking for self-help would not think to look. Flag for Digital Services: the card title is task-shaped and does not match the destination page title ("Healthy housing and pest resources"); confirm whether a Services card may set its own label or must inherit the page title.',
        },
        {
          title: 'Learn about Healthy Housing inspection programs',
          text: 'See what Environmental Health may inspect in apartments, residential hotels, and emergency shelters.',
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
          text: 'Learn about tenant protections and where to get help if you are worried about retaliation.',
          target: 'tenantRights',
          karl: 'Resources subsection entry -> SF.gov page link to the tenant-rights Information page.',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how a report is reviewed and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Resources subsection entry -> SF.gov page link to the after-report Information page.',
        },
        {
          title: 'Fix your Healthy Housing and Vector Control violation',
          text: 'Follow a Notice of Violation and understand the next steps for a tenant or owner.',
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
          text: 'See Article 11 responsibilities, fees, pest prevention, and enforcement resources.',
          target: 'ownerHub',
          karl: 'Resources subsection entry -> SF.gov page link to the owner Resource Collection.',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use prevention, monitoring, and resident outreach tools for your building.',
          target: 'ownerGuidance',
          karl: 'Resources subsection entry -> SF.gov page link to the owner-guidance Information page.',
        },
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the annual Healthy Housing fee for an apartment building with 3 or more rental units.',
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
          text: 'Find complaints, inspections, violations, and public records for a building.',
          target: 'recordsHub',
          karl: 'Resources subsection entry -> SF.gov page link to the records Resource Collection.',
        },
        {
          title: 'Health Code Article 11 in plain language',
          text: 'Read the City rules about pests, nuisances, violations, and enforcement.',
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
          text: 'Request Environmental Health records that are not available in the online lookups.',
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
