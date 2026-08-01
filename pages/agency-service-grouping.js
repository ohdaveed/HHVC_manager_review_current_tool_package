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
      // The Unsplash photo this page always showed, vendored locally instead of
      // hotlinked. It was `images.unsplash.com/photo-1560518883-...`, which made
      // the one page carrying an image the one page that needed the network: it
      // broke the tool's "works fully offline" promise, and it made a PNG export
      // of this page depend on a third party being reachable.
      //
      // WebP at q78 rather than the original JPEG — visually indistinguishable
      // side by side, but 17 KB instead of 49 KB, which matters because this
      // string ships inside the bundle. Kept at the source 800x533: the spotlight
      // renders it around 370 CSS px, and js/mockup-image-export.js captures at
      // 2x, so roughly 740 device pixels are genuinely used.
      //
      // A data: URI rather than a file under public/ because the image has to
      // survive `vite build --mode singlefile`, whose whole point is one
      // self-contained HTML file that gets emailed around and double-clicked.
      // A relative path would 404 there — trading a network dependency for a
      // broken image in the export people actually pass around. Note that
      // data: is a scheme safeUrl() rewrites to '#', and correctly so: that
      // guard is for navigation targets, where a data: URL is a phishing
      // vector. This is an <img src>, which renders bytes rather than
      // navigating, so the rule does not apply here — the same distinction
      // that keeps safeUrl() off the sync URL on the Tool status tab.
      //
      // Two different checks, easy to confuse: findUnsafeUrls() is the SCHEME
      // guard and does not look at image.src at all; findExternalAssetUrls()
      // is the HOST guard, does look at it, and allows data: for the reason
      // above. If the scheme guard is ever extended to cover images, it has to
      // allow data:image/ rather than this having to change.
      src: 'data:image/webp;base64,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',
      // Describes what the photograph actually shows. The previous alt text
      // said "Residential apartment building exterior in San Francisco", which
      // this image has never been — it is a model house and keys on a desk. A
      // screen-reader user was being told about a building that is not there.
      // See the karl note: the subject is also a poor fit for the page.
      alt: 'A small model house and a set of keys resting on a wooden desk',
      width: 800,
      height: 533,
      karl: 'Agency Spotlight 1: image. FLAG FOR DIGITAL SERVICES — this is placeholder stock imagery, and the subject is wrong for the page: a model house with keys reads as home buying, while this page is for tenants reporting pest, vector, and housing health problems under Article 11. Needs a real photo chosen for that audience before publication.',
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
