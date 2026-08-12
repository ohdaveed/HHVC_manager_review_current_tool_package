window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['sroHotelReport'] = {
  slug: 'sf.gov/report-problem-sro-hotel',
  type: 'Transaction',
  title: 'Report a problem in an SRO or hotel',
  summary:
    'Report a pest, garbage, or housing health problem in a single room occupancy (SRO) hotel or residential hotel.',
  audience: [
    'A resident of an SRO or residential hotel',
    'A shelter resident or advocate',
    'A property owner or operator of a residential hotel or shelter',
    'A tenant representative helping someone understand their next steps',
  ],
  reading: 'Grade 6',
  editorStatus: 'placeholder',
  editorNote:
    'New page filling a gap identified in docs/superpowers/specs/2026-08-11-hhvc-page-gap-additions-design.md: findHotelRecords only looks up existing records for SROs, residential hotels, and shelters ("a separate dataset from the general complaints and inspection lookup") — nothing let a reviewer see the report-side transaction for that same setting. Modeled on rodentsReport/filthReport/insectsReport\'s shape. Whether SRO/hotel reports genuinely route through a separate 311 intake path, or only the records-lookup side is separate, is unconfirmed — flagged unverified below pending SME confirmation, the same open question findHotelRecords itself still carries.',
  whatToKnow: {
    cost: 'Free',
    thingsToKnow: [
      'You can report anonymously — 311 does not require your name, and HHVC does not share your identity with the property owner or operator.',
      'This report covers pest, garbage, and housing health conditions. Records and inspection history for SROs, residential hotels, and shelters use a separate lookup tool.',
    ],
  },
  sections: [
    {
      heading: 'What this covers',
      karl: "Best real-schema fit: a things_to_know entry (Title = this heading, Text = the paragraph below). Scope explainer mirrors findHotelRecords' framing of a separate program dataset for this housing type.",
      kind: 'body',
      paragraphs: [
        {
          text: 'Environmental Health reviews pest, garbage, and housing health reports for residential hotels, SROs, and shelters, including shared kitchens, bathrooms, and garbage areas.',
          unverified: true,
          unverifiedReason:
            'Whether this report routes through the same 311 intake as rodentsReport/filthReport/insectsReport, or a separate SRO/hotel-specific intake, has no tier-1 source. Confirm with HHVC before publication.',
        },
      ],
    },
    {
      heading: 'What to do',
      karl: 'what_to_do StreamField. Each step below = one Section block (section_title + section_specifics), mirroring insectsReport\'s "Start your report" / "Tell us where the problem is" shape.',
      kind: 'body',
      steps: [
        {
          title: 'Start your report',
          text: [
            'Use 311 to report an active problem to the City.',
            'If the problem is urgent, report now.',
          ],
          button: 'Report through 311',
          karl: 'what_to_do -> Section. Section title: "Start your report". Section specifics: Text block (these 2 sentences) + Button link block ("Report through 311"), matching the primary-311-action-first pattern used on rodentsReport/filthReport/insectsReport.',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Only share the details that apply to your situation:'],
          bullets: [
            '**What you saw:** Pests, garbage, or a housing health condition, and which unit or shared area it affects.',
            '**Where it is:** The building address, and whether the problem is in a unit, a shared kitchen or bathroom, or another common area.',
            '**When it started:** How long this has been happening.',
            '**Your contact info:** Leave your name and phone number or email if you want an inspector to reach out to you.',
          ],
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence) + bulleted checklist, mirroring insectsReport\'s equivalent step.',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the Related field: a generic unrestricted "Page" chooser, repeatable.',
      kind: 'placement',
      cards: [
        {
          title: 'Find residential hotel and shelter records',
          target: 'findHotelRecords',
        },
        {
          title: 'Learn what Healthy Housing and Vector Control can inspect',
          target: 'scopeInfo',
        },
        {
          title: 'What happens after you report a housing or pest problem',
          target: 'afterReport',
        },
        {
          title: 'Tenant rights when reporting housing conditions',
          target: 'tenantRights',
        },
      ],
    },
  ],
  seoTitle: 'Report a problem in an SRO or hotel | SF.gov',
  metaDescription:
    'Report a pest, garbage, or housing health problem in a San Francisco SRO, residential hotel, or shelter.',
}
