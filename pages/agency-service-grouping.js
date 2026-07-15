window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['pestsTopic'] = {
  slug: 'sf.gov/agency-healthy-housing-and-vector-control',
  type: 'Agency',
  title: 'Healthy Housing and Vector Control',
  summary:
    'We inspect and respond to pest, vector, and housing health problems under Health Code Article 11.',
  audience: [
    'A tenant with a pest or housing health problem',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A property owner or manager trying to prevent pests',
    'A building worker who handles pest or housing health issues',
  ],
  reading: 'Grade 6',
  seoTitle: 'Healthy Housing and Vector Control',
  metaDescription:
    'Report pest, vector, and housing health problems, and learn what Healthy Housing and Vector Control inspects.',
  editorNote:
    'Agency page for the Healthy Housing and Vector Control program. Digital Services approved creating this Agency page (manager confirmation, 2026-07-10). The page key stays pestsTopic for mockup-invariant stability even though the content type is now Agency. Article 11 / HHVC scope only. Agency fields intentionally left empty in this mockup: Logo, Main image, Alert, Highlights, Meeting information, Spotlight 2, Divisions or subcommittees, People, Archive information. Partner agencies to tag in Karl: 311, San Francisco Department of Public Health.',
  spotlight: {
    title: 'Report a housing health problem',
    paragraphs: [
      'Use 311 to report pests, vectors, garbage, filth, and other Article 11 conditions in San Francisco. You can ask 311 for help in your language.',
    ],
    image: {
      src: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&h=533&q=80',
      alt: 'Residential apartment building exterior in San Francisco',
      width: 800,
      height: 533,
      karl: 'Agency Spotlight 1: image',
    },
    button: 'Report through 311',
    buttonUrl: 'https://www.sf311.org/',
    karl: 'Agency Spotlight 1 (renders between Section title 1 and Section title 2 on the real Agency form). The button doubles as the page Call to action — Karl\'s About-level "Call to action" field is folded in here so the page keeps a single strong action. Links to 311 directly (not one of the three consolidated report Transactions) because the copy and CTA cover all Article 11 conditions generically, and the report hub that used to route a neutral CTA no longer exists after this consolidation.',
  },
  contact: {
    phone: ['311 (call or text)', '415-252-3805'],
    email: ['ehb@sfdph.org'],
    other: ['Environmental Health — Healthy Housing and Vector Control'],
  },
  sections: [
    {
      heading: 'Report a problem now',
      component: 'intro',
      karl: 'Agency Quick links field — one link entry per card below. Quick links render near the top of the real Agency page to promote the most common tasks; card `text` descriptions have no home in the real Quick links field and are mockup preview aids.',
      kind: 'placement',
      cards: [
        {
          title: 'Report rats, mice, and other four-legged problems',
          text: 'Rats, mice, raccoons, and other four-legged pests.',
          target: 'rodentsReport',
          karl: 'Quick links entry — an "SF.gov page" link only.',
        },
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          text: 'Garbage, clutter, animal waste, pigeon droppings, overgrown plants, and mold from humidity.',
          target: 'filthReport',
          karl: 'Quick links entry — an "SF.gov page" link only.',
        },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          text: 'Cockroaches, bed bugs, mosquitoes, flies, wasps, and mites.',
          target: 'insectsReport',
          karl: 'Quick links entry — an "SF.gov page" link only.',
        },
      ],
    },
    {
      heading: 'What we do',
      component: 'intro',
      karl: 'Best real-schema fit: the Agency Description field carries the one-line summary; this fuller lead maps to a Text block inside the first Content-style body area Digital Services enables on the Agency page. Keep it short — the Agency page is a landing page, not an About page.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control is an Environmental Health program in the Department of Public Health. We inspect homes and buildings for pests, vectors, bed bugs, garbage, filth, animal waste, overgrown plants, and mold from humidity or condensation under Health Code Article 11.',
        'Start with one of the report pages above. It may take us a few weekdays to respond, and each report page includes simple steps you can take in the meantime.',
      ],
    },
    {
      heading: 'Report and pay',
      component: 'services',
      karl: 'Agency Section title 1 (default heading "Services"; this subsection title is a Services subsection). Links = one "SF.gov page" entry per card below. Card `text` descriptions have no home in the real Services links and are mockup preview aids.',
      kind: 'body',
      paragraphs: ['Use these services if you are dealing with a pest or housing health problem.'],
      cards: [
        {
          title: 'Report rats, mice, and other four-legged problems',
          text: 'Report rat, mouse, raccoon, or other four-legged pest activity.',
          target: 'rodentsReport',
          karl: 'Services subsection entry — an "SF.gov page" link to a Transaction page.',
        },
        {
          title: 'Report garbage, filth, and overgrown vegetation',
          text: 'Report garbage, clutter, animal waste, pigeon problems, or overgrown plants.',
          target: 'filthReport',
          karl: 'Services subsection entry — an "SF.gov page" link to a Transaction page.',
        },
        {
          title: 'Report cockroaches, mosquitoes, and other insects',
          text: 'Report cockroaches, bed bugs, mosquitoes, flies, wasps, or mites.',
          target: 'insectsReport',
          karl: 'Services subsection entry — an "SF.gov page" link to a Transaction page.',
        },
        {
          title: 'Pay your Healthy Housing fee',
          text: 'Pay the annual Healthy Housing fee for apartment buildings with 3 or more rental units.',
          target: 'payFee',
          karl: 'Services subsection entry — an "SF.gov page" link to a Transaction page.',
        },
        {
          title: 'Find complaints and inspection records',
          text: 'Look up complaints, inspections, and violations for a building.',
          target: 'findRecords',
          karl: 'Services subsection entry — an "SF.gov page" link to a Transaction page.',
        },
      ],
    },
    {
      heading: 'Get help and know your rights',
      component: 'resources',
      karl: 'Agency Section title 2 (default heading "Resources"), subsection 1. Links = one "SF.gov page" entry per card below. Card `text` descriptions are mockup preview aids.',
      kind: 'body',
      paragraphs: ['Use these pages to understand the process and your protections.'],
      cards: [
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          text: 'Check if Environmental Health may review your pest or housing health problem.',
          target: 'scopeInfo',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          text: 'Learn about tenant protections and where to get help.',
          target: 'tenantRights',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
        {
          title: 'Health Code Article 11 in plain language',
          text: 'Read nuisance rules with plain-language translations for mold, rodents, wasps, and more.',
          target: 'article11Guide',
          karl: 'Resources subsection entry — an "SF.gov page" link to a Report page.',
        },
        {
          title: 'Look up building records',
          text: 'Find complaints, violations, and public records for a building.',
          target: 'recordsHub',
          karl: 'Resources subsection entry — an "SF.gov page" link to a Resource Collection page.',
        },
        {
          title: 'Make a public records request',
          text: 'Request Environmental Health records not available in the online lookups.',
          target: 'publicRecords',
          karl: 'Resources subsection entry — an "SF.gov page" link to a Transaction page. Doubles as the Agency Public records field, which points at the records-request path.',
        },
      ],
    },
    {
      heading: 'For property owners and managers',
      component: 'resources',
      karl: 'Agency Section title 2, subsection 2. Links = one "SF.gov page" entry per card below.',
      kind: 'body',
      paragraphs: ['Use these pages if you own or manage a residential building.'],
      cards: [
        {
          title: 'Property owner responsibilities',
          text: 'See fees, violation response, and pest prevention obligations under Article 11.',
          target: 'ownerHub',
          karl: 'Resources subsection entry — an "SF.gov page" link to a Resource Collection page.',
        },
        {
          title: 'Integrated pest management for property owners and managers',
          text: 'Use prevention, monitoring, and resident outreach. UC IPM is the primary source for templates and checklists.',
          target: 'ownerGuidance',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
        {
          title: 'How to respond to a notice of violation',
          text: 'Learn what tenants and owners each need to do when HHVC issues a notice of violation.',
          target: 'noticeOfViolation',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
      ],
    },
    {
      heading: 'Mosquito and vector programs',
      component: 'resources',
      karl: 'Agency Section title 2, subsection 3. Links = one "SF.gov page" entry per card below.',
      kind: 'body',
      cards: [
        {
          title: 'Mosquito Control Program',
          text: 'Learn about mosquito surveillance, catch-basin treatment, and West Nile virus resources.',
          target: 'mosquitoControl',
          karl: 'Resources subsection entry — an "SF.gov page" link to an Information page.',
        },
        {
          title: 'Free mosquito education workshop',
          text: 'Request a free hands-on workshop for schools, camps, museums, and science fairs.',
          target: 'mosquitoWorkshop',
          karl: 'Resources subsection entry — an "SF.gov page" link to a Campaign page.',
        },
      ],
    },
    {
      heading: 'Learn about pests from trusted sources',
      component: 'resources',
      karl: 'Agency Section title 2, subsection 4 — External link entries (Resources subsections accept external links as well as SF.gov pages). These third-party references replace the retired City-maintained species and prevention pages: link to reputable sources instead of duplicating their content (manager directive).',
      kind: 'body',
      paragraphs: [
        'These trusted partners keep detailed pest guidance up to date so we do not have to duplicate it.',
      ],
      cards: [
        {
          title: 'UC IPM pest notes',
          text: 'University of California guides for rats, mice, cockroaches, bed bugs, mosquitoes, pigeons, raccoons, and more.',
          url: 'https://ipm.ucanr.edu/home-and-landscape/',
          karl: 'Resources subsection entry — External link.',
        },
        {
          title: 'CDC: Rodents',
          text: 'Federal guidance on preventing and cleaning up after rodent infestations.',
          url: 'https://www.cdc.gov/rodents/prevention/index.html',
          karl: 'Resources subsection entry — External link.',
        },
        {
          title: 'CDC: Mosquitoes',
          text: 'Federal guidance on preventing mosquito bites and breeding.',
          url: 'https://www.cdc.gov/mosquitoes/prevention/index.html',
          karl: 'Resources subsection entry — External link.',
        },
        {
          title: 'NEHA: Vector control resources',
          text: 'National Environmental Health Association vector control resources.',
          url: 'https://www.neha.org/vector-control',
          karl: 'Resources subsection entry — External link.',
        },
        {
          title: 'EPA: Mold cleanup in your home',
          text: 'Federal guidance on cleaning up mold and controlling moisture — mold from humidity or condensation is also reportable through 311.',
          url: 'https://www.epa.gov/mold',
          karl: 'Resources subsection entry — External link. Carries the mold-from-humidity pointer from the retired standalone mold pages.',
        },
      ],
    },
    {
      heading: 'About Healthy Housing and Vector Control',
      component: 'body',
      karl: 'Agency About field. The "Learn more about us" button that Karl auto-adds when an About page is tagged is intentionally not mocked — no separate About page exists for this program yet.',
      kind: 'body',
      paragraphs: [
        'Our inspectors respond to reports from residents, then work with property owners and managers until violations are fixed. We focus on the conditions Health Code Article 11 covers: rodent and insect infestations, garbage and filth, animal waste, overgrown vegetation, and mold from humidity or condensation.',
        'This page and everything it links to stay within the HHVC and Article 11 scope.',
      ],
    },
  ],
}
