window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['inspectorLookup'] = {
  slug: 'sf.gov/find-healthy-housing-inspector-by-neighborhood',
  type: 'Transaction',
  title: 'Find your Healthy Housing inspector by neighborhood',
  summary: 'Look up which Healthy Housing and Vector Control inspector covers your neighborhood.',
  audience: [
    'A tenant checking who their assigned inspector is',
    'A property owner or manager coordinating with an assigned inspector',
    'A tenant representative or advocate following up on a case',
    'A resident of an SRO, residential hotel, or shelter',
  ],
  reading: 'Grade 7',
  editorStatus: 'placeholder',
  editorNote:
    "New page reinstating content dropped in the 40->19 page consolidation (previously the retired findInspector key, aliased to scopeInfo — see js/core/page-data.js's HHVC_DELETED_PAGE_ALIASES). Confirmed during design (docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md) that scopeInfo holds no inspector-lookup content; the alias exists only so an old shared link resolves to something. Modeled on findHotelRecords' explainer-plus-lookup-button shape. The lookup tool's actual entry point (URL or internal tool) is unconfirmed — the button below targets the inert \"#\" placeholder until HHVC confirms a real destination; do not invent a URL.",
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: ['The exact lookup tool and destination have not been confirmed yet.'],
  },
  sections: [
    {
      heading: 'What this tool covers',
      karl: 'Best real-schema fit: a things_to_know entry (Title = this heading, Text = the paragraph below).',
      kind: 'body',
      paragraphs: [
        {
          text: 'Healthy Housing and Vector Control assigns inspectors by neighborhood. Use this page to find contact information for the inspector who covers your area.',
          unverified: true,
          unverifiedReason:
            'Whether HHVC organizes inspector assignments strictly by neighborhood, or by some other territory division, has no tier-1 source. Confirm with HHVC before publication.',
        },
      ],
    },
    {
      heading: 'Open the lookup tool',
      karl: 'what_to_do -> Section. Section title: "Open the lookup tool". Section specifics: Text block (this paragraph) + Button link block. Target is the inert "#" placeholder — see editorNote — rather than an invented URL.',
      kind: 'body',
      paragraphs: [
        'Select your neighborhood to see the assigned inspector and their contact information.',
      ],
      button: 'Find your inspector',
      buttonUrl: '#',
      callout: {
        title: 'Lookup destination not yet confirmed',
        text: 'This button is a placeholder until HHVC confirms the real lookup tool and entry point.',
        variant: 'note',
      },
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Look up building records',
          target: 'recordsHub',
        },
        {
          title: 'Find complaints and inspection records',
          target: 'findRecords',
        },
        {
          title: 'Look up residential health code violations',
          target: 'findViolations',
        },
        {
          title: 'Healthy Housing and Vector Control',
          target: 'pestsTopic',
        },
      ],
    },
  ],
  seoTitle: 'Find your Healthy Housing inspector by neighborhood | SF.gov',
  metaDescription:
    'Look up which Healthy Housing and Vector Control inspector covers your San Francisco neighborhood.',
}
