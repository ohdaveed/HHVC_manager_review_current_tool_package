**Chapter 2: SF.gov and Karl Foundations (Topic-First Model & User Needs)**

| Field | Value |
| --- | --- |
| **Document Status** | Version 3.1 Release Candidate (Hybrid) |
| **Date** | July 6, 2026 |
| **Model Standard** | Topic-First Model (Karl CMS) |
| **Technical Compliance** | WCAG 2.1 Level AA (ADA Title II Floor) |
| **Federal Deadline** | April 26, 2027 |

---

### 2.1 Purpose & Scope
This chapter defines the design, content structure, and user experience standards for all Healthy Housing and Vector Control (HHVC) content published on SF.gov. Before publication, every HHVC page must follow SF.gov and Karl standards. These standards take priority over legacy website structures, departmental preferences, and historical ways of organizing content.

---

### 2.2 The "Services First" Philosophy
SF.gov is a service-centered website designed around the actual needs of people visiting the site. 
*   **Action over Information:** Residents do not visit government websites to browse the history of a department; they visit to fulfill a specific, immediate need. 
*   **The "One Page Goal":** Every page on SF.gov must serve a single, clear goal. Any single page may be the *only* SF.gov page a user ever encounters, so it must meet the user’s goal end-to-end.
*   **Hiding Administrative Complexity:** People should be able to access services without needing to understand City laws, funding sources, or internal department structures.

---

### 2.3 The Topic-First Architecture
To prevent the creation of isolated endpoints and broken navigation paths, all HHVC content must be mapped to the **Topic-First Model**. 
*   **Theme-Based Organization:** Karl CMS groups related transactions, services, and resources by theme (Topics) rather than by department. 
*   **The Primary Parent Hub:** The single, authoritative entry point for all program content is the Topic page: **`sf.gov/topic-pests-and-housing-problems`**.
*   **Automated Relational Assembly:** When any page is tagged with a parent Topic in the CMS, Karl automatically displays those pages under the "More services" section of the Topic page, eliminating the need for manual, duplicative linking.

---


### 2.4 Gather User Needs & The 'Deal Breakers' Rule
Before drafting any page, editors must research who uses the service and identify their critical constraints. Any factor that would prevent a resident from completing a task—such as mandatory fee tiers, the 72-hour landlord-notice rule, or a strict 10-sq-ft mold minimum—is a **'deal breaker'** and must be placed in a prominent callout block at the very beginning of the page.

---

### 2.5 Plain-Language and Online Reading Standards
Studies show that users read only about **20% of the words** on a web page. Online readers are skimmers who read under stress, on mobile screens, or with low-data connections. 
*   **The Inverted Pyramid:** Place the most critical "must-know" information at the very top of the page. Background details belong at the bottom under clear headings.
*   **Reading Level Targets:** Public-facing content must be written in plain language. Drafts must target the following Flesch-Kincaid grade levels:
    *   *Transaction Pages:* Grade 5–6
    *   *Information Pages:* Grade 6
    *   *Inspection/Process Pages:* Grade 6–7
    *   *Notice of Violation (NOV)/Enforcement Pages:* Grade 7
    *   *Code Interpretation Pages:* Grade 7–8
*   **Short Structures:** Use short sentences (averaging under 15-20 words) and short paragraphs (fewer than 3 sentences).
*   **Vocabulary Rules:** Avoid jargon, technical terms, and acronyms. Avoid contractions (e.g., "don't").

---

### 2.6 The 5 Essential Resident Questions
Every public-facing page on SF.gov must systematically answer these five core questions:
1.  **What is this page about?** (Answered by a keyword-forward, active-verb title).
2.  **Who is this page for?** (Answered by a prominent audience block).
3.  **What should I do?** (Answered by a primary action button or bulleted steps).
4.  **What happens next?** (Answered by realistic processing timelines).
5.  **Where can I get more help?** (Answered by direct links to related resources).

---

### 2.7 Standardized Audience-First Framework
To immediately capture the user's attention, every HHVC page must define its audience near the top of the layout.
*   **The Approved Template:** Use the standard, scannable format:
    > **This page can help if you are:**
    > * A tenant or resident...
    > * A property owner or manager...
*   **Prohibited Phrasing:** Never use abstract, bureaucratic labels such as "Eligible Users," "Target Audience," or "Who should use this page?"

---

### 2.8 Enforceable Modal Conventions
To establish clear, legally defensible standards of obligation, all HHVC content must use a consistent modal verb scheme:
*   **must:** Indicates a mandatory legal requirement or binding obligation. *This replaces the obsolete and heavily litigated word "shall".*
*   **must not:** Indicates a strict prohibition.
*   **should:** Indicates a recommended best practice (not legally mandatory).
*   **may:** Indicates a discretionary option or permission.
*   **will:** Indicates a future event or a formal City agency commitment, not a resident obligation.

*Note: The literal word "shall" must be restricted strictly to verbatim citations of the San Francisco Health Code.*

---

### 2.9 Accessibility and Universal Design Floor
All HHVC web content must comply with ADA Title II regulations. It is legally mandated to achieve **WCAG 2.1 Level AA conformance** ahead of the strict **April 26, 2027 compliance deadline**. 
*   **Descriptive Hyperlinks:** Link text must be descriptive and make complete sense when read out of context. Never use generic placeholders like "click here," "read more," or raw URLs. E.g., write `[Download the rodent prevention guide [PDF, 1.2 MB]](url)`.
*   **True Heading Nesting:** Headings must follow a sequential nesting order (H1 for page title, H2 for main sections, H3 for sub-sections). Do not use raw bolding or size overrides to fake a heading.
*   **No Color-Only Cues:** Color must never be used as the sole method to convey meaning or urgency.
*   **Accessible PDF Alternatives:** Genuinely accessible HTML must be provided for all information, forms, and guides. Printable PDFs are allowed only as supplementary downloads.

---

### 2.10 Content Success Criteria
Every HHVC draft must satisfy four strict success criteria before being sent to staging:
1.  **Relevance in 5 Seconds:** The resident must immediately recognize whether the page applies to their specific situation.
2.  **Action Prominence:** The primary action (such as a "Report through 311" button) must be positioned above the fold.
3.  **No Dead Ends:** The user must never reach a page that does not offer a clear, logical onward path to a related service, guide, or contact option.
4.  **Timelines Defined:** The page must outline realistic City response windows and next steps so the user exits with clear expectations.


### 2.11 References
* [📒 SF.gov and Karl Editor Help Center: Structure](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/structure)
* [📒 SF.gov and Karl Editor Help Center: Relational content](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/structure/relational-content)
* [📒 SF.gov and Karl Editor Help Center: Accessibility guidelines](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility)
* [📒 SF.gov and Karl Editor Help Center: Accessible design on SF.gov](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility/accessible-design-on-sf.gov)
* [📒 SF.gov and Karl Editor Help Center: How you keep pages accessible](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility/how-you-keep-pages-accessible)
* [📒 SF.gov and Karl Editor Help Center: Plain language](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/plain-language)
* [📒 SF.gov and Karl Editor Help Center: Readability](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/write-your-content/readability)
* [📒 SF.gov and Karl Editor Help Center: Why plain language matters](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/plain-language/why-plain-language-matters)
* [📒 SF.gov and Karl Editor Help Center: Write descriptive links](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/sf.gov-style/write-descriptive-links)
* [📒 SF.gov and Karl Editor Help Center: Headings](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/page-structure/headings)
* [📒 SF.gov and Karl Editor Help Center: Avoid PDFs if possible](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/documents-including-pdfs/pdf-accessibility-basics/avoid-pdfs-if-possible)
* [📘 Plain-Language and Health-Literacy Best Practices for a Public-Health Department](https://drive.google.com/file/d/1dVsqfYRmvhmf9cPOPOn9jFsn58N0LYNE/view)
