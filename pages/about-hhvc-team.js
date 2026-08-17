window.HHVC_PAGES = window.HHVC_PAGES || {}
window.HHVC_PAGES['aboutHhvcTeam'] = {
  slug: 'sf.gov/topic-healthy-housing-and-vector-control--about',
  type: 'About us',
  title: 'Healthy Housing and Vector Control',
  summary:
    'Who we are, what we do, and how the Healthy Housing and Vector Control team is organized.',
  audience: [
    'This page is for anyone who wants to know more about the Healthy Housing and Vector Control program and the people who run it.',
  ],
  reading: 'Grade 6',
  karlGuide: {
    path: 'Content → Information → Custom section',
    panel: 'Information',
    block: 'Custom section',
    field: 'Custom section text',
    rawField: 'about_info',
    steps: [
      'Open Karl admin → Pages → Add child page → About us.',
      'Open Content → Information and add a Custom section.',
      'Enter the visible section heading as Custom section title and the visible copy as Custom section text.',
    ],
    evidence: 'E1',
    status: 'confirmed',
  },
  editorStatus: 'placeholder',
  editorNote:
    'New About-us-type page mock. Karl\'s "About us" content type (Title, Primary agency, Information, Resources — live-admin-confirmed field list, docs/wagtail-content-mapping.md) has no real, currently-live HHVC equivalent to model content on: HHVC is a program inside the Environmental Health branch, not its own department, and Environmental Health itself has no About-us page. Structure is verified live against sf.gov/departments--controllers-office--about (visible "About {name}" H1, no visible eyebrow or summary, plain Information sections, a Resources block with named sub-groups) — but unlike the Topic-page pass, this page\'s OWN content (team composition, program framing) is illustrative mockup content for review, not reused real copy. Job titles (Environmental Health Inspector / Environmental Health Technician) are real, already confirmed elsewhere in this mockup (pages/pay-healthy-housing-fee.js\'s reinspection-fee rates cite the same two titles). Team size and specific numbers are deliberately not invented here — only scope and role descriptions, which are safer to state without a source. Karl fields with no mockup equivalent: Primary agency (same gap as every other page type in this mockup).',
  sections: [
    {
      heading: 'Who we are',
      karl: 'Maps to one entry in the repeatable Information stream (Title = this heading, rich text = the paragraph). Confirmed live as the first Information block on sf.gov/departments--controllers-office--about ("Who we are").',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control is the Environmental Health team that inspects housing conditions and responds to pest and vector reports in San Francisco. Our staff include Environmental Health Inspectors and Environmental Health Technicians who investigate complaints, conduct inspections, and work with tenants and property owners to fix violations under Health Code Article 11.',
      ],
    },
    {
      heading: 'What we do',
      karl: 'Maps to a second Information entry (Title = this heading, rich text = the intro sentence plus the bulleted list). Confirmed live as the pattern the reference page itself uses for its own "What we do" block.',
      kind: 'body',
      paragraphs: ['Our work covers:'],
      bullets: [
        'Investigating reports of rats, mice, insects, garbage, and other housing health conditions',
        'Inspecting apartments, hotels, and emergency shelters under Health Code Article 11',
        'Following up on Notices of Violation until conditions are corrected',
        'Answering questions from tenants and property owners about healthy housing requirements',
        'Offering free integrated pest management education for community groups and schools',
      ],
    },
    {
      heading: 'How the team is organized',
      karl: 'Maps to a third Information entry. Substitutes for the reference page\'s "Our divisions" block (a list of named organizational divisions) — HHVC is a single program rather than a department with divisions, so this describes roles instead, which is the honest equivalent for a program this size.',
      kind: 'body',
      paragraphs: [
        'Healthy Housing and Vector Control is part of the Environmental Health branch of the San Francisco Department of Public Health.',
      ],
      bullets: [
        '**Environmental Health Inspectors** investigate reports, conduct inspections, and issue Notices of Violation.',
        '**Environmental Health Technicians** support inspections and reinspections.',
        '**Program staff** answer questions, schedule education sessions, and process annual fee payments.',
      ],
    },
    {
      heading: 'Program information',
      karl: 'Maps to Resources (Title = "Resources", one Resource sub-group here titled this heading, Links = each card below — same repeatable Title+Links shape confirmed on Topic and reused via renderResourcesRegion()/renderServiceGroup(). Card titles/descriptions are inherited from each destination page, same rule as every other Services/Resources subsection in this mockup.',
      kind: 'body',
      component: 'resources',
      cards: [
        { title: 'Learn what Healthy Housing and Vector Control can inspect', target: 'scopeInfo' },
        { title: 'Health Code Article 11 in plain language', target: 'article11Guide' },
        {
          title: 'Integrated pest management for property owners and managers',
          target: 'ownerGuidance',
        },
        { title: 'Mosquito Control Program', target: 'mosquitoControl' },
      ],
    },
  ],
  seoTitle: 'About Healthy Housing and Vector Control | SF.gov',
  metaDescription:
    'Learn who the Healthy Housing and Vector Control team is, what they do, and how the program is organized.',
}
