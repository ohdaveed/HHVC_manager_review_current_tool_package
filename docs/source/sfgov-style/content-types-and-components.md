# Karl content types and components

Captured 2026-07-30 from the SF.gov and Karl Editor Help Center. See
`README.md` for provenance.

This is the *editor-facing* view: what a content type is for and which
components exist. For the *field-level* view of what each Karl form actually
contains, see `docs/wagtail-content-mapping.md` (verified against the live Karl
add-page forms) and `karl-content-type-field-reference.md` in this directory's
parent. The three are complementary and were captured from different sources.

---

## Content types

Source: `using-karl-the-cms/content-types/understanding-content-types` and
`.../choosing-a-content-type`

A content type "dictates the design and content elements of the page." Each one
answers a particular user need, which is what keeps SF.gov structurally
consistent. The Help Center groups them into four families.

### Services — help someone get something done

| Type | User need | Choose it when | Avoid it when |
| --- | --- | --- | --- |
| **Transaction** | Entry point into an actionable service or application | The content is directly actionable — "Application", "Form", "Send", "Email", "Mail" | It is informational *about* something → use Information |
| **Information** | Non-actionable reference material | "Definition", "About", "Learn", "Understanding" | The user must take an action with the City → use Transaction |
| **Step by step** | Understand a multi-step process over time | Numbered sequences, multiple actions, multiple buttons. **Limit to 15 steps** | Detail belongs on separate pages — this is an overview |
| **Location** | Find where to access a service | City-controlled or City-partner facilities: "address", "hours", "directions" | It is not a City-controlled place |

### Outreach — tell the public about an initiative

| Type | User need | Choose it when | Avoid it when |
| --- | --- | --- | --- |
| **News** | Press releases and announcements | Ephemeral: "Press release", "Announcement" | The information is ongoing → use Campaign |
| **Event** | A public gathering with details | There is a date, time, and location | It is a public body's meeting → use Meeting |
| **Campaign** | An awareness initiative or programme | "Outreach", "Initiative", catchy names and slogans | — pair with News for the launch |

### Department support — tell the public what a department does

| Type | User need | Notes |
| --- | --- | --- |
| **About** | Department mission and values | One per department; link detailed Information pages from it |
| **Agency** | The department's official landing page | **Digital Services must create this** |
| **Meeting** | Meeting records and agendas | Commissions, committees, task forces, boards only |
| **Profile** | Biographical information | Staff or public figures |
| **Data story** | Data with explanatory context | Needs PowerBI embeds or DataSF collaboration |
| **Report** | A comprehensive document | Annual reports, policies, long documents. Includes an auto-generated table of contents |
| **Resource Collection** | Browse a curated list | Best for PDFs, links, or a mix |

### Sitewide

| Type | User need |
| --- | --- |
| **Topic** | A thematic collection of content that crosses departments |

Also present in Karl's page-type chooser but not in the editor-facing grouping:
**Document Collection Search** and **Form**.

> The overview page says "11 content types" while listing more than that across
> its own groups; the live Karl chooser recorded in
> `docs/wagtail-content-mapping.md` lists 17. Treat the count as unreliable and
> the individual entries as authoritative.

### How this maps to the HHVC mockup

`pages/*.js` uses six of these: `Agency`, `Transaction`, `Information`,
`Resource Collection`, `Campaign`, and `Report`. **Step by step** is unused and
is the most likely gap — several HHVC Transaction pages carry `steps[]` arrays
that run long enough to be their own overview page. Worth raising when the AI
assist sitemap task starts proposing structures.

---

## Components

Source: `using-karl-the-cms/components` and its 39 sub-pages

A page is assembled from components. Karl divides them by whether they are
shared:

- **Reusable** — stored once in the SF.gov database and added to any number of
  pages; editing one updates every page that uses it. Addresses, media (images,
  PDFs, documents, spreadsheets), profiles, resource tiles.
- **Non-reusable** — belong to the single page they sit on. Titles,
  descriptions, buttons, callouts, spotlights.

### Catalogue

| Component | Purpose |
| --- | --- |
| Accordions | Collapsible supporting detail |
| Address | Reusable location block |
| Alert | Time-sensitive notice at the top of a page |
| Body (main body text and title) | The primary rich-text region |
| Button | The page's primary action |
| Callout | Highlighted aside within body copy |
| Contact section | How to reach the department |
| Cost | Fee information (Transaction pages) |
| Data | Embedded dashboards and datasets |
| Description | The page's meta description |
| Heading | Section and subsection headings |
| Highlights | Featured items on an Agency page |
| Images | With alt text, cropping specs, header images, logos |
| Links | Inline and standalone links |
| Partner agency | Co-owning department |
| People section | Staff or leadership listing |
| Primary agency | The owning department — on **all** content types since 2025 |
| Redirect this page to | Forwarding rule |
| Related | Cross-links to related pages |
| Resources | Files and external references |
| Spotlight | Featured callout with image and action |
| Tables | Tabular data (native to Report pages) |
| Title | The page title |
| Topics | Thematic tagging |
| URLs | Page address and short-URL guidance |
| Videos | Embeds, with transcript guidance |

### Component rules worth encoding

Already scored by `js/plain-language.js`:

- **Button** — "Buttons can only be 25 characters long. Shorter button text is
  more effective!" Also: "We recommend no more than one button on a page";
  additional actions become text links. Button text should start with a verb
  (`Apply now`, `Order…`, `Find…`, `Download PDF`, `Get started`).
- **Images / alt text** — required; keep under 120 characters; never open with
  "image of"; text inside images is banned outright.
- **Links** — link text must say where it goes; never "here". Prefer a site's
  homepage over a deep link to a PDF, "where you can", because homepage links
  are more stable.

Not yet encoded, and candidates for the AI assist validator rather than the
scorer:

- **Links as endorsement** — "When you link to an external website, it is an
  endorsement." Check the destination is trustworthy, works on mobile, and has
  an acceptable privacy policy. If a link needs a login, registration, or
  authentication, say so upfront.
- **Link maintenance** — audit links every couple of months.
- **One button per page** — the HHVC mockup frequently has a section button plus
  step buttons, which may be a legitimate divergence for Transaction pages or
  may be worth flagging. Needs a human decision before it becomes a rule.
