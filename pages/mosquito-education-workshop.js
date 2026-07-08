window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['mosquitoWorkshop'] = {
  slug: 'sf.gov/mosquito-education-workshop',
  type: 'Campaign',
  title: 'Free mosquito education workshop',
  summary:
    'Request a free mosquito science workshop for schools, camps, museums, and science fairs.',
  audience: [
    'A teacher or school administrator planning a classroom or campus science activity',
    'A summer camp director or youth program coordinator',
    'A museum educator or science fair organizer',
    'A parent or community group leader hosting a youth science event in San Francisco',
  ],
  reading: 'Grade 7',
  editorNote:
    'Campaign page mock. Maps conceptually to Karl\'s "Campaign" content type (see docs/wagtail-content-mapping.md) using this mockup\'s existing sections[]/cards[]/bullets[] shape — this tool has no Spotlight/Top facts/Logo/Color theme widgets, so the karl notes below describe the intended real-Karl block for each section rather than a literally rendered equivalent. Campaign page-level fields with no mockup equivalent at all: Primary agency, Logo, Background header image, Color theme, Partner agencies. Workshop form: /forms/mosquito-workshop-request/ (mock). SME placeholder — production form URL, intake backend, capacity, service area, lead time, and standards crosswalk below are illustrative example content for mockup review; confirm actual values with HHVC before publication. In Karl Button: screenreader label “Go to mosquito workshop request form.”',
  editorStatus: 'placeholder',
  sections: [
    {
      heading: 'Bring mosquito science to your students',
      karl: 'Maps to Spotlight 1: Spotlight title = this heading, Spotlight description = the paragraphs below. Spotlight requires a Spotlight image (min 1080×350px) with no mockup equivalent — flag for Digital Services. No button set here; the workshop CTA lives in Spotlight 2 ("Request a workshop" section below) instead.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control offers a free mosquito education workshop for youth audiences in San Francisco.',
        'Our team sets up interactive science stations where students can explore mosquito biology, breeding habitats, and disease prevention through hands-on learning.',
      ],
      callout: {
        karl: 'Spotlight has no callout field — fold this "free program" note into the Spotlight description as a bolded lead-in, or flag for Digital Services if a distinct callout is needed.',
        text: 'This is a free City service for eligible schools, summer camps, museums, and science fairs within San Francisco.',
      },
    },
    {
      heading: 'Who can request a workshop',
      karl: "Maps to an Additional content → Accordion section block: Title = this heading, Accordion sidebar (rich text) = the paragraph below, and each bullet below becomes one Accordion item (Title = audience type, Body = elaboration — this mockup's bullets are single-line, so item bodies would need light rewriting to fit the Title+Body shape).",
      kind: 'body',
      bullets: [
        'Public and private schools',
        'Summer camps and after-school programs',
        'Museums and library science programs',
        'Science fairs and youth STEM events',
      ],
      paragraphs: [
        'Workshops are designed for elementary and middle school audiences. HHVC can help you choose the right station setup for your group size and space.',
      ],
    },
    {
      heading: 'What students experience',
      karl: 'Maps to a second Additional content → Accordion section block: Title = this heading, Accordion sidebar = the paragraph below, each bullet below becomes one Accordion item (station name as Title, elaboration as Body).',
      kind: 'body',
      paragraphs: [
        'Each workshop uses mobile science stations that let students observe mosquitoes up close and learn how small changes at home can prevent breeding.',
      ],
      bullets: [
        'Microscopes to view mosquito specimens and larvae',
        'Live mosquito larvae demonstrations in safe, contained displays',
        'Hands-on activities about standing water, life cycles, and bite prevention',
        'Educational handouts and discussion prompts for teachers and group leaders',
        'Connections to local West Nile virus surveillance and community reporting',
      ],
    },
    {
      heading: 'Aligned with California education standards',
      karl: 'Maps to a third Additional content → Accordion section block: Title = this heading, Accordion sidebar = the two paragraphs below, each bullet becomes one Accordion item.',
      kind: 'body',
      paragraphs: [
        'Workshop activities are designed to support California classroom learning goals in life science, public health, and scientific inquiry.',
        'Stations emphasize observation, evidence-based reasoning, and understanding how organisms interact with their environment—skills reflected in California educational standards for science.',
      ],
      bullets: [
        'Life cycles and habitats of mosquitoes',
        'How environmental conditions affect public health',
        'Using tools such as microscopes to collect and interpret observations',
        'Applying science concepts to real-world prevention choices',
      ],
      callout: {
        karl: 'No callout field on Accordion section or its items — fold this "standards summary available on request" note into the sidebar text or the last Accordion item\'s Body, or flag for Digital Services.',
        text: 'HHVC can provide a standards-alignment summary for teachers upon request. Verify the final standards crosswalk before publication.',
      },
    },
    {
      heading: 'Request a workshop',
      karl: 'Maps to Spotlight 2: Spotlight title = this heading, Spotlight description = the paragraphs below, and the "Request a workshop online" button becomes Spotlight 2\'s nested Button link (Link text = button label, target = buttonUrl). Spotlight also needs a Spotlight image with no mockup equivalent — flag for Digital Services.',
      kind: 'body',
      paragraphs: [
        'Use the online request form to tell us about your organization, audience, dates, and event space. HHVC will follow up about availability. Submitted requests currently route to the Mosquito Control Program for scheduling (illustrative — confirm the actual intake backend with HHVC before publication).',
        'You can also contact the Mosquito Control Program directly if you have questions before submitting the form.',
      ],
      cards: [
        {
          title: 'Request a workshop online',
          text: 'Submit organization details, audience size, preferred dates, and space needs.',
          url: '/forms/mosquito-workshop-request/',
          karl: 'This card duplicates the section-level CTA above; Spotlight has no nested card/list field, so this restatement has no separate home in the real schema — likely mockup-only scaffolding, not a distinct Campaign block.',
        },
      ],
    },
    {
      heading: 'Questions before you apply',
      karl: 'Best real-schema fit: Top facts. Facts title = this heading (or a shorter variant like "Workshop essentials"), and each bullet below becomes one Fact item (Fact title = a short label like "Contact"/"Service area"/"Group size"/"Lead time", Fact text = the full bullet). The phone number could alternatively live in the dedicated Contact us panel\'s Phone block (Owner = "Mosquito Control Program", Phone number = 415-252-3806) instead — Top facts is the closer fit for the other three logistics bullets, so Contact us isn\'t used here to avoid splitting this content across two panels.',
      kind: 'body',
      paragraphs: [
        'Call or email the Mosquito Control Program if you need help deciding whether the workshop is right for your group.',
      ],
      bullets: [
        'Contact the Mosquito Control Program at 415-252-3806',
        'Available to schools, camps, museums, and youth groups located within San Francisco',
        {
          text: 'Fits groups up to about 60 students per session; larger groups can be split into multiple sessions',
          unverified: true,
          unverifiedReason:
            'SME placeholder — capacity is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
        {
          text: 'Request at least 3 weeks before your event date to allow time for scheduling, setup, and equipment transport',
          unverified: true,
          unverifiedReason:
            'SME placeholder — lead time is illustrative example content for mockup review; confirm actual value with HHVC before publication (see page editorNote).',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: "Maps to Campaign's Related field (raw name `related_links`, a repeatable StreamField — confirmed via live admin, 2026-07-06; each entry is a Page block: Link to radio SF.gov page/External URL/None, Page chooser, Link text). Corrected from an earlier assumption that this field was single-item — it isn't. All 4 cards below can map directly to separate related_links entries (Link to = SF.gov page, Page = target, Link text = title).",
      kind: 'placement',
      cards: [
        {
          title: 'Mosquito Control Program',
          text: 'Learn about mosquito surveillance, catch-basin treatment, and program contacts.',
          target: 'mosquitoControl',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Prevent mosquitoes',
          text: 'Classroom-friendly prevention tips to share after the workshop.',
          target: 'mosquitoesPrevent',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Report a dead bird',
          text: 'Teach students how community dead bird reports support West Nile virus tracking.',
          target: 'wnvBirdReport',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
        {
          title: 'Pests and housing problems',
          text: 'Return to the main Topic page for HHVC pest and vector resources.',
          target: 'pestsTopic',
          karl: 'Maps to a related_links entry (Link to = SF.gov page, Page = this target, Link text = this title).',
        },
      ],
    },
  ],
  seoTitle: 'Free mosquito education workshop | SF.gov',
  metaDescription:
    'Request a free HHVC mosquito science workshop with microscopes and live larvae for San Francisco schools.',
}
