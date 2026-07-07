# HHVC Web Governance and Content Standards Manual

## Chapter 2: SF.gov and Karl Foundations (Topic-First Model)

| Field                    | Value                                  |
| ------------------------ | -------------------------------------- |
| **Document Status**      | Version 3.1 Release Candidate          |
| **Date**                 | July 6, 2026                           |
| **Model Standard**       | Topic-First Model (Karl CMS)           |
| **Technical Compliance** | WCAG 2.1 Level AA (ADA Title II Floor) |
| **Federal Deadline**     | April 26, 2027                         |

---

### 2.1 Purpose & Scope

This chapter defines the design, content structure, and user experience standards for all Healthy Housing and Vector Control (HHVC) content published on SF.gov [337, 362]. Before publication, every HHVC page must follow SF.gov and Karl standards [362]. These standards take priority over legacy website structures, departmental preferences, and historical ways of organizing content [362].

The purpose of these standards is to help residents complete tasks quickly, understand what action to take, and access services without needing to understand government structure [359, 362].

---

### 2.2 The "Services First" Philosophy

SF.gov is a service-centered website designed around the actual needs of people visiting the site [315, 319, 579].

- **Action over Information:** Residents do not visit government websites to browse or learn about the history of a department; they visit to fulfill a specific, immediate need in their everyday lives [252, 254, 579].
- **The "One Page Goal":** Every page on SF.gov must serve a single, clear goal [262, 265]. Because approximately 94% of users bypass department landing pages and arrive directly from Google search queries, any single page may be the _only_ SF.gov page a user ever encounters [263, 266]. Each page must meet the user’s goal end-to-end [262, 265].
- **Hiding Administrative Complexity:** We believe people should be able to access services without needing to understand City laws, funding sources, internal department structures, or administrative program boundaries [256, 257, 259, 260].

---

### 2.3 The Topic-First Architecture

To prevent the creation of isolated endpoints and broken navigation paths, all HHVC content must be mapped to the **Topic-First Model** [115, 116].

- **Theme-Based Organization:** Karl CMS groups related transactions, services, and resources by theme (Topics) rather than by department, ensuring users can find what they need without knowing which agency manages a program [603].
- **The Primary Parent Hub:** The single, authoritative entry point for all program content is the Topic page: **`sf.gov/topic-pests-and-housing-problems`** [111, 378, 603].
- **Automated Relational Assembly:** When any Transaction, Step-by-step, or Information page is tagged with a parent Topic in the back-end of the CMS, Karl automatically displays those pages under the "More services" section of the Topic page [597]. This eliminates the need for manual, duplicative linking [61, 65].

---

### 2.4 Plain-Language and Online Reading Standards

Studies show that users read only about **20% of the words** on a web page [323, 645]. Online readers are skimmers who read under stress, on mobile screens, or with low-data connections [1, 315, 319, 645].

- **The Inverted Pyramid:** Place the most critical "must-know" information—such as how to report or immediate deadlines—at the very top of the page [241, 243, 285, 306]. Background details or technical explanations belong at the bottom under clear headings [242, 244, 647].
- **Reading Level Targets:** Public-facing content must be written in simple, clear, and plain language [23, 119]. All drafts must target the following Flesch-Kincaid grade levels [120, 293]:
  - _Transaction Pages:_ Grade 5–6
  - _Information Pages:_ Grade 6
  - _Inspection/Process Pages:_ Grade 6–7
  - _Notice of Violation (NOV)/Enforcement Pages:_ Grade 7
  - _Code Interpretation Pages:_ Grade 7–8
- **Short Structures:** Use short sentences (averaging under 15 to 20 words) and short paragraphs (fewer than 3 sentences) [235, 237, 285, 306, 407].
- **Vocabulary Rules:** Avoid jargon, technical terms, and acronyms [235, 237]. Avoid contractions (e.g., "don't"), as screen-reader users and skimmers frequently misread or miss them entirely [235, 237].

---

### 2.5 Standardized Audience-First Framework

To immediately capture the user's attention and confirm page relevance, every HHVC page must define its audience near the top of the layout [353].

- **The Approved Template:** Use the standard, scannable format:
  > **This page can help if you are:**
  >
  > - A tenant or resident... [119, 272]
  > - A property owner or manager... [119, 272]
- **Prohibited Phrasing:** Never use abstract, bureaucratic labels such as "Eligible Users," "Target Audience," or "Who should use this page?" [119]

---

### 2.6 Enforceable Modal Conventions

To establish clear, legally defensible, and scannable standards of obligation, all HHVC content must use a consistent modal verb scheme [292]:

- **must:** Indicates a mandatory legal requirement or binding obligation [292]. _This replaces the obsolete and heavily litigated word "shall" across all plain-language guides [290, 292, 297]._
- **must not:** Indicates a strict prohibition [292].
- **should:** Indicates a recommended best practice (not legally mandatory) [292].
- **may:** Indicates a discretionary option or permission [292].
- **will:** Indicates a future event or a formal City agency commitment, not a resident obligation [292].

_Note: The literal word "shall" must be restricted strictly to verbatim citations of the San Francisco Health Code [292, 311]._

---

### 2.7 Accessibility and Universal Design Floor

All HHVC web content must comply with the federal Americans with Disabilities Act (ADA) Title II regulations [339, 410]. It is legally mandated to achieve **WCAG 2.1 Level AA conformance** ahead of the strict **April 26, 2027 compliance deadline** [339, 410].

- **Descriptive Hyperlinks:** Link text must be descriptive and make complete sense when read out of context [409]. Never use generic placeholders like "click here," "read more," or raw URLs [8, 409]. E.g., write `[Download the rodent prevention guide [PDF, 1.2 MB]](url)` [409].
- **True Heading Nesting:** Headings must follow a sequential nesting order (H1 for page title, H2 for main sections, H3 for sub-sections) [27, 230, 232, 408]. Do not use raw bolding or size overrides to fake a heading [26, 281, 298]. Never use questions as headings, as they slow down skimming readers [228, 230, 232].
- **No Color-Only Cues:** Color must never be used as the sole method to convey meaning or urgency [281, 298, 411].
- **Accessible PDF Alternatives:** Genuinely accessible HTML must be provided for all information, forms, and guides [284, 305]. Printable PDFs are allowed only as supplementary downloads, not the primary content format [284, 287, 305, 309].

---

### 2.8 Content Success Criteria

Every HHVC draft must satisfy four strict success criteria before being sent to staging [123, 353]:

1. **Relevance in 5 Seconds:** The resident must immediately recognize whether the page applies to their specific situation upon landing [371].
2. **Action Prominence:** The primary action (such as the "Report through 311" button) must be positioned above the fold and discoverable within 5 seconds [371].
3. **No Dead Ends:** The user must never reach a page that does not offer a clear, logical onward path to a related service, prevention guide, or contact option [352, 381].
4. **Timelines Defined:** The page must outline realistic City response windows and next steps (e.g., what inspectors look for) so the user exits the transaction with clear expectations [351, 372].
