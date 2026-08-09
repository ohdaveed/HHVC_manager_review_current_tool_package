window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['ipmEducation'] = {
  slug: 'sf.gov/integrated-pest-management-education',
  type: 'Campaign',
  title: 'Free IPM education workshop',
  summary:
    'Request a free integrated pest management (IPM) education session for tenant groups, resident councils, and community organizations in San Francisco.',
  audience: [
    'A tenant, renter, or resident who wants to learn low-toxicity ways to prevent pests at home',
    'A tenant association, resident council, or building group organizing a learning session',
    'A community center, senior center, or nonprofit serving San Francisco residents',
    'A neighborhood association or community group leader hosting a resident education event',
  ],
  reading: 'Grade 6',
  editorNote:
    'Campaign page mock, modeled directly on mosquito-education-workshop.js\'s structure and karl-annotation style (see docs/wagtail-content-mapping.md, "Verified against the real Karl Campaign add-page form"). Deliberately distinct from the existing Information-type ownerGuidance page ("Integrated pest management for property owners and managers"): that page is compliance guidance for owners/managers/staff citing Director\'s Rules obligations; this page is a free educational program for tenants, resident groups, and community organizations, with no compliance-obligation framing. This mockup has no Spotlight/Top facts/Logo/Color theme widgets, so the karl notes below describe the intended real-Karl block for each section rather than a literally rendered equivalent. Campaign page-level fields with no mockup equivalent at all: Primary agency, Logo, Background header image, Color theme, Partner agencies. Unlike mosquitoWorkshop, this program has no dedicated request form in forms/ — the CTA below routes through 311 (https://www.sf311.org/) as an illustrative placeholder; confirm the actual intake channel (311, a direct program line, email, or a future dedicated form) with HHVC before publication. Session capacity and lead-time figures are illustrative example content for mockup review; confirm actual values with HHVC before publication.',
  editorStatus: 'placeholder',
  topicTag: 'Agency: Healthy Housing and Vector Control',
  contact: {
    phone: ['311 (call or text)'],
    email: ['ehb@sfdph.org'],
    other: ['Environmental Health — Healthy Housing and Vector Control'],
  },
  sections: [
    {
      heading: 'Learn how to prevent pests without heavy pesticide use',
      karl: 'Maps to Spotlight 1: Spotlight title = this heading, Spotlight description = the paragraphs below. Spotlight requires a Spotlight image (min 1080×350px) with no mockup equivalent — flag for Digital Services. No button set here; the request CTA lives in Spotlight 2 ("Request a session" section below) instead.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control offers free integrated pest management (IPM) education sessions for tenants, resident groups, and community organizations in San Francisco.',
        'IPM is a prevention-first approach. Instead of relying on heavy pesticide use, it focuses on sealing entry points, removing food and water sources, and catching problems early.',
      ],
      callout: {
        karl: 'Spotlight has no callout field — fold this "free program" note into the Spotlight description as a bolded lead-in, or flag for Digital Services if a distinct callout is needed.',
        text: 'This is a free City service for eligible tenant groups, resident councils, and community organizations within San Francisco.',
      },
    },
    {
      heading: 'Who can request a session',
      karl: "Maps to an Additional content → Accordion section block: Title = this heading, Accordion sidebar (rich text) = the paragraph below, and each bullet below becomes one Accordion item (Title = group type, Body = elaboration — this mockup's bullets are single-line, so item bodies would need light rewriting to fit the Title+Body shape).",
      kind: 'body',
      bullets: [
        'Tenant associations and resident councils',
        'Community centers, senior centers, and nonprofits',
        'Neighborhood associations and community groups',
        'Building resident meetings organized by tenants, not by property management',
      ],
      paragraphs: [
        'Sessions are designed for adult residents and community members. HHVC can help you choose the right format for your group size and space.',
      ],
    },
    {
      heading: "What you'll learn",
      karl: 'Maps to a second Additional content → Accordion section block: Title = this heading, Accordion sidebar = the paragraph below, each bullet below becomes one Accordion item (topic name as Title, elaboration as Body).',
      kind: 'body',
      paragraphs: [
        'Sessions cover practical, low-cost steps residents can take themselves, and when to ask a landlord or the City for help.',
      ],
      bullets: [
        'How to seal small gaps and cracks that let pests inside',
        'Safe food and garbage storage that does not attract rodents or insects',
        'Early signs of rats, mice, cockroaches, and bed bugs',
        'When to notify your landlord and when to report a problem to the City',
        'Least-toxic tools you can use yourself, and which pesticides to avoid indoors',
      ],
    },
    {
      heading: 'Grounded in San Francisco health code and UC IPM guidance',
      karl: 'Maps to a third Additional content → Accordion section block: Title = this heading, Accordion sidebar = the paragraph below, each bullet becomes one Accordion item.',
      kind: 'body',
      paragraphs: [
        'Session content follows the same integrated pest management guidance HHVC recommends to property owners and managers under Article 11 of the San Francisco Health Code.',
      ],
      bullets: [
        'University of California Statewide IPM Program (UC IPM) prevention practices',
        'Article 11 tenant protections against unsafe or unsanitary conditions',
        'When a property owner is responsible for fixing a pest problem',
      ],
      callout: {
        karl: "No callout field on Accordion section or its items — fold this cross-reference into the sidebar text or the last Accordion item's Body, or flag for Digital Services.",
        text: 'See [Integrated pest management for property owners and managers](ownerGuidance) for the compliance-focused version of this guidance.',
      },
    },
    {
      heading: 'Request a session',
      karl: 'Maps to Spotlight 2: Spotlight title = this heading, Spotlight description = the paragraphs below, and the "Request a session through 311" card becomes Spotlight 2\'s nested Button link (Link text = card title, target = card url). Spotlight also needs a Spotlight image with no mockup equivalent — flag for Digital Services.',
      kind: 'body',
      paragraphs: [
        {
          text: 'Contact 311 to request a free IPM education session for your tenant group, resident council, or community organization. Tell them your group type, size, preferred dates, and meeting location.',
          unverified: true,
          unverifiedReason:
            'SME placeholder — intake channel is illustrative example content for mockup review. Unlike the mosquito education workshop, this program has no dedicated online request form in this mockup; confirm the actual intake process (311, a direct program line, email, or a future dedicated form) with HHVC before publication.',
        },
        'You can also reach the Healthy Housing and Vector Control program directly with questions before requesting a session.',
      ],
      cards: [
        {
          title: 'Request a session through 311',
          text: 'Tell 311 your group type, size, preferred dates, and meeting location.',
          url: 'https://www.sf311.org/',
          karl: "This card is Spotlight 2's nested Button link; Spotlight has no separate card/list field, so this is the CTA itself, not a restatement of a section-level button.",
          unverified: true,
          unverifiedReason:
            'SME placeholder — routing session requests through 311 is illustrative; confirm the actual intake channel with HHVC before publication.',
        },
      ],
    },
    {
      heading: 'Questions before you request',
      karl: 'Best real-schema fit: Top facts. Facts title = this heading (or a shorter variant like "Session essentials"), and each bullet below becomes one Fact item (Fact title = a short label like "Contact"/"Service area"/"Group size"/"Lead time", Fact text = the full bullet).',
      kind: 'body',
      paragraphs: [
        'Contact Healthy Housing and Vector Control if you need help deciding whether a session is right for your group.',
      ],
      bullets: [
        'Contact Healthy Housing and Vector Control by calling or texting 311, or by email at ehb@sfdph.org',
        'Available to tenant groups, resident councils, and community organizations located within San Francisco',
        {
          text: 'Fits groups up to about 40 residents per session; larger groups can be split into multiple sessions',
          unverified: true,
          unverifiedReason:
            'SME placeholder — capacity is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
        {
          text: 'Request at least 2 weeks before your event date to allow time for scheduling and materials preparation',
          unverified: true,
          unverifiedReason:
            'SME placeholder — lead time is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: "Maps to Campaign's Related field (raw name `related_links`, a repeatable StreamField — confirmed via live admin, 2026-07-06; each entry is a Page block: Link to radio SF.gov page/External URL/None, Page chooser, Link text). All 4 cards below map directly to separate related_links entries (Link to = SF.gov page, Page = target, Link text = title).",
      kind: 'placement',
      component: 'related',
      cards: [
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Free mosquito education workshop',
          target: 'mosquitoWorkshop',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Report rats, mice, and other four-legged problems',
          target: 'rodentsReport',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Healthy Housing and Vector Control',
          target: 'pestsTopic',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
      ],
    },
  ],
  seoTitle: 'Free IPM education workshop | SF.gov',
  metaDescription:
    'Request a free integrated pest management (IPM) education session for tenant groups and community organizations in San Francisco.',
}
