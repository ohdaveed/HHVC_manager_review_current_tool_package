window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['bedBugsReport'] = {
  slug: 'sf.gov/report-bed-bugs',
  type: 'Transaction',
  title: 'Report bed bugs',
  summary: 'Report an active bed bug problem in San Francisco rental housing.',
  audience: [
    'A tenant affected by bed bugs',
    'A friend, family member, advocate, or helper reporting for a tenant',
    'A person reporting bed bugs in rental housing, an SRO, or a residential hotel',
  ],
  reading: 'Grade 5–6',
  sections: [
    {
      heading: 'What to do',
      karl: 'Karl: what_to_do StreamField. Each step below = one Section block (section_title + section_specifics). Primary 311 action appears first; report details are consolidated in Step 3.',
      kind: 'body',
      steps: [
        {
          title: 'Start your report',
          text: [
            'Use 311 to report an active problem to the City.',
            'If the problem is urgent, report now.',
          ],
          button: 'Report through 311',
          karl: 'what_to_do -> Section. Section title: "Start your report". Section specifics: Text block (these 2 sentences) + Button link block ("Report through 311") + Callout block below. Keep the 311 action first.',
          callout: {
            title: 'Your report is confidential',
            text: 'The City will never share your name or contact information with your landlord or property manager.',
            karl: 'Callout block inside the "Start your report" Section specifics: single rich text field only, no separate title field like this mockup callout has. Fold "Your report is confidential" in as a bolded lead-in within the callout text, or flag for Digital Services if a distinct heading is actually needed.',
          },
        },
        {
          title: 'If you rent, give 72 hours when possible',
          text: ['Tell the property owner or manager about the bed bug problem.'],
          bullets: [
            'If they do not respond or start fixing it within 72 hours, submit your report right away so it can be assigned for review.',
            'Do not wait 72 hours if there is an urgent health or safety concern.',
          ],
          karl: 'what_to_do -> Section. Section title: "If you rent, give 72 hours when possible". Section specifics: one Text block containing the intro sentence plus the bulleted list below (bullets render as a bulleted list inside the same Draftail Text field, same as any other rich text). Conditional 72-hour tenant notice + timeline expectation.',
        },
        {
          title: 'Tell us where the problem is',
          text: ['Include only the details that apply:'],
          bullets: [
            'The address or location',
            'Where bed bugs were seen or where bites happened',
            'Whether the problem is in a unit, room, or shared residential area',
            'How long it has been happening',
            'Whether you told the property owner or manager, if you rent',
            'Any treatment, inspection, or response that has already happened',
            'Your contact information, if you want an inspector to contact you',
          ],
          callout: {
            karl: 'Callout block inside the "Tell us where the problem is" Section specifics: single rich text field, no separate title field — this mockup callout has no title key either, so there is no heading to reconcile. Text: photo guidance plus the reporter-identity disclosure note.',
            text: "Photos are not required. Describe the location and condition clearly. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          },
          karl: 'what_to_do -> Section. Section title: "Tell us where the problem is". Section specifics: Text block (intro sentence + bulleted checklist) + Callout block below. Report details checklist.',
        },
      ],
    },
    {
      heading: 'Get help making your report',
      karl: 'Best real-schema fit: one things_to_know entry (confirmed repeatable, no max). Title: "Get help making your report". Text: the paragraph + bulleted list below (third-party reporting, language access, privacy). Open question for Digital Services: things_to_know renders ABOVE what_to_do on the real form, so this content may need to move earlier on the live page even though it stays here in this mockup draft.',
      kind: 'body',
      paragraphs: [
        'You can make a report even if you are not the tenant. A friend, family member, advocate, or helper can report for someone else.',
      ],
      bullets: [
        'You can ask 311 for help in your language.',
        'You do not have to give your name to make a report.',
        'HHVC does not share the reporter’s identity with the property owner or manager.',
        'You can ask 311 for a service request number so you can follow up later.',
      ],
    },
    {
      heading: 'How your report is processed',
      karl: 'Best real-schema fit: a second things_to_know entry. Title: "How your report is processed". Text: the bulleted list below (after-report expectations, weekday processing note, enforcement statement). Same ordering caveat as the section above — things_to_know sits before what_to_do on the real form.',
      kind: 'body',
      bullets: [
        '**Review time:** It can take a few weekdays for 311 to send your report to Environmental Health and assign an inspector.',
        '**If you gave contact information:** An inspector may reach out to ask questions or schedule a visit.',
        '**If you reported anonymously:** An inspector may still visit the property without notice—especially if there is an urgent safety or health risk.',
        '**If we find a problem:** The City can order the property owner or responsible party to fix the violation.',
      ],
      callout: {
        karl: "Schema gap: things_to_know is Title + Text only — no nested callout block. Fold this tenant-rights text into the entry's Text field (e.g. as a bolded closing line), or flag for Digital Services if a distinct callout is needed here.",
        text: 'Tenants have rights to safe and habitable housing. A property owner or manager cannot retaliate because a tenant reports housing conditions to the City.',
      },
    },
    {
      heading: 'Bed bug rules',
      karl: 'Maps to the same related panel as the "Related pages" section below — Karl\'s related field is one repeatable page-chooser list, not separate named groups. This card is another related "Page" entry pointing to bedBugsInfo (also present in the Related pages section below; dedupe before publishing so bedBugsInfo is not listed twice). The paragraph above ("For detailed bed bug prevention...") has no home in related and would need to become things_to_know text or be dropped.',
      kind: 'placement',
      paragraphs: [
        'For detailed bed bug prevention and control rules, see the bed bug rules and prevention page.',
      ],
      cards: [
        {
          title: 'Bed bug rules and prevention',
          text: "Learn about bed bug rules, treatment preparation, and prevention, including the official Director's Rules reference.",
          target: 'bedBugsInfo',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
      ],
    },
    {
      heading: 'Related pages',
      karl: 'Maps to the related panel: repeatable field "Page *" with a "Choose a page" button. Real-schema gap: related has NO custom title/text per item, only a page reference — the descriptions on these cards have no home unless Digital Services adds one. Confirm before publishing. 4 cards below = 4 related "Page" entries (note: the bedBugsInfo target also appears in the "Bed bug rules" section above — likely a duplicate related entry to reconcile).',
      kind: 'placement',
      cards: [
        {
          title: 'Learn what HHVC can inspect',
          text: 'Check whether Environmental Health may review this type of issue.',
          target: 'scopeInfo',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'What happens after you report',
          text: 'Learn how reports are reviewed, assigned on weekdays, and when an inspector may contact you.',
          target: 'afterReport',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above).',
        },
        {
          title: 'Bed bug rules and prevention',
          text: 'Learn what tenants and property owners should know about bed bug prevention and control.',
          target: 'bedBugsInfo',
          karl: 'related panel entry — page chooser only; this description text is not supported in the real schema (see section-level karl note above); also flagged as a likely duplicate of the "Bed bug rules" section\'s related entry above (same target page).',
        },
        {
          title: 'Tenant rights and reporting',
          text: "Find help if you are worried about retaliation. Reporter identities are only shared with the City Attorney's Office and are not shared in response to public records requests.",
          target: 'tenantRights',
          karl: 'related panel entry — page chooser only; same schema gap as the other cards above (no custom description field in the real related panel).',
        },
      ],
    },
  ],
  seoTitle: 'Report bed bugs | SF.gov',
  metaDescription: 'Report an active bed bug problem in San Francisco rental housing.',
}
