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
      // An inline SVG placeholder, not a photo. This was a hotlinked
      // images.unsplash.com URL, which made the one page carrying an image the
      // one page that needed the network: it broke the tool's "works fully
      // offline" promise, and it made a PNG export of this page depend on a
      // third party being reachable.
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
      src: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20800%20533%22%20width=%22800%22%20height=%22533%22%3E%3Crect%20width=%22800%22%20height=%22533%22%20fill=%22%23dfe8f1%22/%3E%3Cg%20fill=%22%238ca6bf%22%3E%3Crect%20x=%22196%22%20y=%22250%22%20width=%22104%22%20height=%22150%22/%3E%3Crect%20x=%22316%22%20y=%22196%22%20width=%22130%22%20height=%22204%22/%3E%3Crect%20x=%22462%22%20y=%22286%22%20width=%2296%22%20height=%22114%22/%3E%3C/g%3E%3Cg%20fill=%22%23dfe8f1%22%3E%3Crect%20x=%22206%22%20y=%22286%22%20width=%2284%22%20height=%2214%22/%3E%3Crect%20x=%22206%22%20y=%22330%22%20width=%2284%22%20height=%2214%22/%3E%3Crect%20x=%22326%22%20y=%22232%22%20width=%22110%22%20height=%2214%22/%3E%3Crect%20x=%22326%22%20y=%22286%22%20width=%22110%22%20height=%2214%22/%3E%3Crect%20x=%22326%22%20y=%22330%22%20width=%22110%22%20height=%2214%22/%3E%3Crect%20x=%22472%22%20y=%22318%22%20width=%2276%22%20height=%2214%22/%3E%3C/g%3E%3Crect%20x=%22140%22%20y=%22400%22%20width=%22520%22%20height=%226%22%20fill=%22%238ca6bf%22/%3E%3Ctext%20x=%22400%22%20y=%22462%22%20text-anchor=%22middle%22%20font-family=%22Helvetica,Arial,sans-serif%22%20font-size=%2254%22%20font-weight=%22bold%22%20fill=%22%231b3049%22%3ESpotlight%20image%3C/text%3E%3Ctext%20x=%22400%22%20y=%22508%22%20text-anchor=%22middle%22%20font-family=%22Helvetica,Arial,sans-serif%22%20font-size=%2236%22%20fill=%22%2333506e%22%3Eplaceholder%3C/text%3E%3C/svg%3E',
      // Describes what is actually on screen. The old alt text described a
      // photo of an apartment building, which would have told a screen-reader
      // user the mockup showed approved imagery it does not have.
      alt: 'Placeholder for the Agency spotlight photo, which Digital Services will supply',
      width: 800,
      height: 533,
      karl: 'Agency Spotlight 1: image. Placeholder only — Digital Services to supply the real Spotlight image (Agency Spotlight 1 requires one; see the editor note for the Agency fields left empty in this mockup).',
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
