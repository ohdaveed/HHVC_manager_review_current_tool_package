# SFDPH Healthy Housing and Vector Control

## **Chapter 7: Writing, Accessibility, and SEO Standards**

_HHVC Web Governance and Content Standards Manual_

| **Field**                   | **Value**                                                       |
| :-------------------------- | :-------------------------------------------------------------- |
| **Document status**         | Version 3.1 Release Candidate                                   |
| **Version**                 | 3.1                                                             |
| **Date**                    | July 6, 2026                                                    |
| **Status**                  | Approved Working Draft                                          |
| **Primary standard**        | SF.gov and Karl CMS Editor Help Center                          |
| **Project source of truth** | HHVC Web Governance and Content Standards Manual                |
| **Tracking tool**           | Content governance tracker in the SF.gov publication repository |
| **Technical compliance**    | WCAG 2.1 Level AA (ADA Title II Floor)                          |
| **Federal deadline**        | April 26, 2027                                                  |

---

### **7.1 Purpose**

This chapter establishes binding quality standards for writing, plain language, web accessibility, translation readiness, and search engine optimization (SEO) that govern all Healthy Housing and Vector Control (HHVC) web content on SF.gov [278, 279, 412]. Adhering to these standards ensures that our public-facing text is readable, inclusive, discoverable, and legally compliant [279].

All HHVC content must comply with these standards before staging or publication to guarantee complete WCAG 2.1 Level AA conformance ahead of the federal ADA Title II compliance deadline of **April 26, 2027** [339, 410, 412].

---

### **7.2 Plain Language and Reading Level Standards**

SF.gov content must be accessible to all residents, including those with limited English proficiency, cognitive disabilities, dyslexia, low vision, or those reading under high stress [2, 131, 234, 279, 391]. All HHVC content must comply with these strict plain language rules [131, 279]:

#### **7.2.1 Reading Level Targets by Page Type**

Readability grade levels must be calibrated to the specific task and page category [97, 280, 411]. All draft content must be analyzed using Flesch-Kincaid formulas and adhere to the following target ranges [98, 211, 280, 411]:

- **Transaction/Service Pages (Grade 5–6):** Focuses on service-critical, direct public actions (e.g., filing a complaint, reporting a hazard, or starting a payment process) [98, 280, 411].
- **Information/Educational Pages (Grade 6):** General resident-facing biology, prevention advice, and housing guides (e.g., pest prevention tips) [98, 280, 411].
- **Inspection and Process Pages (Grade 6–7):** Overviews of complex multi-agency pathways, inspectable conditions, and next steps [98, 280, 411].
- **Notice of Violation (NOV) & Enforcement Pages (Grade 7):** Instructions for property owners responding to citations, compliance periods, and administrative hearings [98, 280, 411].
- **Code Interpretation Pages (Grade 7–8):** Technical references translating Article 11 statutory baselines and Director's Rules into plain language [98, 280, 411].

#### **7.2.2 Sentence and Paragraph Length Constraints**

- **Sentence Length:** Keep sentences short and direct, averaging **15 to 20 words or fewer** [280, 411]. Focus strictly on **one idea per sentence** [280]. Break long sentences at connectors (such as "and", "but", "or") to create separate statements [123, 126].
- **Paragraph Length:** Restrict paragraphs to **3 sentences or less** to avoid intimidating "walls of text" [37, 39, 43, 236, 411]. Provide a subheading or a visual bulleted list after approximately every 3 paragraphs [43, 236].
- **Bulleted Lists:** Convert any sentence listing more than 3 items into a clean, bulleted list to introduce white space [37, 39, 43, 236].

#### **7.2.3 Grammatical and Vocabulary Constraints**

- **Active Voice:** Write exclusively in the active voice to make the responsible party clear [125, 128, 237, 280]. E.g., write _"DPH inspectors will review your report"_ instead of _"Your report will be reviewed by DPH"_ [280, 283].
- **Direct Address:** Address the user directly using second-person pronouns ("you" and "your") rather than third-person nouns ("applicants", "residents", "property owners") [123, 126, 214, 411].
- **Simple Vocabulary:** Prioritize common, everyday words over administrative or bureaucratic terminology [280, 411].
  - _Use:_ "help" (not "assistance") [280]
  - _Use:_ "need" (not "require" or "mandate") [280]
  - _Use:_ "start" (not "commence") [280]
  - _Use:_ "stop" (not "cease")
- **Contraction Restriction:** Banish the use of contractions (e.g., "don't", "can't", "won't") [411]. Stressed readers, non-native English speakers, and optical screen-readers frequently misread or completely overlook apostrophes, reversing the legal meaning of an instruction [411]. Write out _"do not"_, _"cannot"_, and _"will not"_ verbatim.

---

### **7.3 The "Must" vs. "Shall" Modal Scheme**

To maintain clear legal enforceability and prevent administrative ambiguity, HHVC content must follow a standardized modal verb scheme [202, 219, 411]:

- **"must" (Mandatory Obligation):** Use strictly to denote legally citable requirements, code compliance mandates, or actions a user is forced to take under Article 11 [219, 411].
- **"should" (Recommended Practice):** Use to denote optional best practices, preventive guidelines, or advisory steps that are not legally citable [219, 411].
- **"may" (Permissible Option):** Use to denote optional choices, available pathways, or discretionary actions [219, 411].
- **"will" (Future Agency Action):** Use to describe actions that DPH, inspectors, or City administrative systems commit to performing in the future [219].

#### **7.3.1 Prohibition of the Word "Shall"**

The word **"shall" is strictly prohibited** in all new and revised HHVC web text [219, 411]. "Shall" is an obsolete legalism that is highly prone to inconsistent interpretation [411].

- _Standard:_ Use "must" for all public-facing obligations [219, 411].
- _Exception:_ The literal word "shall" must be restricted strictly to verbatim, italicized quotes of the San Francisco Health Code itself [219, 411].

---

### **7.4 Headings and Text Hierarchy**

Clear headings are essential for scannability [59, 107, 110, 281]. Because online readers scan pages quickly to find specific information, headings must serve as visual anchors [59, 107, 110, 239].

#### **7.4.1 Sequential HTML Hierarchy Rules**

- **No Skipping Levels:** Headings must follow a strict semantic nested hierarchy [281]. Editors must never skip heading levels for visual styling reasons (e.g., placing an H4 directly under an H2 is prohibited) [281].
- **Karl Template Integration:** In the Karl CMS, **H1 (Page Title)** and **H2 (Main Sections)** are pre-templated and built automatically into the layout [107, 108].
- **H3 for Headings:** Main sections within the in-page body text must be configured as **H3** [107, 108, 415].
- **H4 for Subheadings:** Sub-sections within body blocks must be configured as **H4** [107, 108, 415].
- **Sentence Case Only:** All headings must use standard sentence case [108]. Capitalize only the first letter of the heading and any proper nouns [108, 377]. Never use Title Case (capitalizing every word) or ALL CAPS [37, 39, 42, 88].

#### **7.4.2 Headings and Formatting Principles**

- **Keyword-Forward Structure:** Place primary, high-relevance search terms at the very beginning of the heading [204, 218, 281, 416]. (E.g., write _"Rats and mice prevention"_ instead of _"Instructions for preventing rodents"_) [281].
- **No Questions for Public Pages:** Headings on public-facing Transaction and Information pages must be short, action-oriented phrases [107, 108]. **Never use questions as headings** on these pages, as FAQs are slower to read, more difficult for screen readers to index, and create longer pages [107, 108]. (E.g., write _"Prepare for your inspection"_ instead of _"How do I prepare for my inspection?"_) [107, 108].
- _Exception for Dual-Purpose Manuals:_ For long-form regulatory documents, plain-language legal reference guides, or PDF booklets, question-style headings (such as _"What are tenants responsible for?"_) are highly recommended to aid non-expert scanning [203, 212, 217].

---

### **7.5 Descriptive Hyperlinks**

All hyperlinks must be descriptive and make sense when read completely out of context [131, 282, 395]. Assistive technologies often extract and read link lists to help users navigate, making generic links a major accessibility failure [131, 395].

- **No Generic Link Text:** Never use vague or non-descriptive labels such as "click here", "read more", "info", or raw URLs [25, 43, 131, 282, 395, 398].
- **Action-Oriented Context:** The linked text itself must describe the exact destination or resource [131, 282, 396].
  - _Incorrect:_ "To learn about our program, [click here]." [25, 395, 398]
  - _Correct:_ "Learn more by reading our [rodent prevention guide] or [view the Article 11 health code rules]." [282, 396]
- **File Format Stating:** When linking directly to a file download (such as a PDF or DOCX), you must explicitly state the format and file size in brackets within the link [282]. E.g., _"Download the [bed bug complaint log template (PDF, 340 KB)]."_ [282]
- **External Link Integrity:** When linking to a trusted external site (such as the CDC or State agencies), verify that there is no internal SF.gov page containing the same information [26]. Explicitly inform the user if the external link requires authentication, registration, or a user login [250].

---

### **7.6 Accessibility and Universal Design Floor**

Achieving complete conformance with Web Content Accessibility Guidelines (WCAG) 2.1 Level AA requires several non-text and structural safeguards [159, 162, 412]:

#### **7.6.1 Alternative Text (Alt Text) Standards**

- **Alt Text is Required:** Alternative text is mandatory for all uploaded images, diagrams, icons, and maps [16, 283].
- **Scope and Relevancy:** Alt text must capture the context and public-health scope of the image, rather than just a literal description [81].
- **Alt Text Length:** Keep description text concise, aiming for **fewer than 120 characters** to ensure compatibility with screen-reader speech limits [81].
- **No Redundant Phrases:** Never start alt text with "image of" or "graphic of" [17]. Assistive software automatically announces the file as an image to the user [17].
- **Decorative Checkbox:** For purely decorative images (like a vector flower on a health clinic page), check the "decorative image" box in the Karl CMS [18]. This bypasses the alt text requirement and allows screen readers to silently skip the asset [18].
- **Text on Images is Strictly Banned:** Uploading flyers, posters, or infographics with embedded text is strictly prohibited [130, 134, 144]. Screen readers cannot parse embedded pixels, resulting in an immediate WCAG failure and violation of San Francisco's Digital Accessibility and Inclusion Standard (DAIS) [144].

#### **7.6.2 Other Universal Design Controls**

- **No Color-Only Cues:** Never use color as the sole method to convey meaning or urgency [283]. (E.g., do not write _"Required steps are highlighted in red"_). Combine color cues with bold text, descriptive labels, or icons [283].
- **Semantic CMS Bullets:** Always use Karl's native bullet and ordered list components [283]. Typing manual dashes (-), asterisks (*), or custom bullet characters breaks screen-reader list announcements [283].
- **Accessible PDF Policy:** Avoid publishing PDFs whenever possible [14, 130, 134]. If a PDF is required (such as an official ordinance or a multi-page form), the editor must provide an accessible, machine-translatable HTML equivalent directly on the SF.gov page, or guarantee the PDF is fully tagged for screen readers [130, 134, 284].

---

### **7.7 Translation and Cultural Readiness**

Under San Francisco's Language Access Ordinance, the HHVC program must deliver vital public information in the City's primary threshold languages: **Spanish, Chinese, and Filipino**, with **Vietnamese** scheduled for integration [226, 300, 361].

- **Linguistic Clarity first:** Writing at a 5th-to-6th grade reading level dramatically improves translation accuracy [234]. Simple English sentence structure translates faster and experiences fewer semantic errors [234].
- **Banish Idioms and Slang:** Never use local figures of speech, puns, jokes, or cultural idioms (e.g., write _"complete your task quickly"_ instead of _"get it done in a jiffy"_) [108, 284, 345]. These phrases do not translate accurately and create confusion [108, 345].
- **Consistent Terminology:** Maintain strict terminology consistency across all pages [285]. If you use "Notice of Violation", do not swap it for "Citation notice", "Violations letter", or "Warning ticket" on other pages [285]. Translators cannot easily reconcile synonyms, which can lead to legal errors in translated versions [285, 405].
- **Dual-Checked Translations:** Do not assume a translation automatically preserves plain-language reading levels [215]. Vital public-health and service pages must be human-translated and separately reviewed for cultural appropriateness and health literacy [2, 137, 215].

---

### **7.8 Search Engine Optimization (SEO) and Metadata Controls**

Because over 50% of SF.gov visitors land on pages directly from search engines, page titles and meta descriptions must work in unison to be discoverable [310, 342, 346]:

- **Meta Title Rules:** Meta titles must be **60 characters or less** and use standard sentence case [286, 340]. Use pipe formatting with a keyword-forward action name [286, 340]:
  - _Format:_ `[Keyword-Forward Action Name] | San Francisco` [286]
  - _Correct Example:_ `Report rats or mice | San Francisco` [286]
- **Meta Description Rules:** Meta descriptions must be **between 110 and 160 characters** [286]. They must start with a clear, active verb summarizing the page's exact service, putting search terms at the very beginning of the string [77, 79, 286].
  - _Correct Example:_ `Report a rodent or insect problem in your apartment or neighborhood. Learn DPH inspection procedures and landlord responsibilities.` [286]
- **Keyword Integration:** Ensure primary search terms (e.g., "rats", "cockroaches", "inspectors", "DPH", "311") are present in the H3/H4 headings, body text, and alt text to boost search relevancy [286].

---

### **7.9 Validation and Quality Checklists**

Before any page is submitted for final manager review or staged on the live website, the editor must hand-verify compliance using the following metrics:

#### **7.9.1 Readability Scoring**

1.  Paste the draft copy into the Hemingway Editor [235, 375].
2.  Check the overall reading grade level against the targets in Section 7.2.1 [97, 280, 411].
3.  Ensure passive voice sentences have been converted to active voice [125, 128, 237, 280].
4.  Verify that average sentence length is under 15 to 20 words [280, 411].

#### **7.9.2 CDC Clear Communication Index**

For vital public health documents, plain-language rules sheets, and regulatory overviews:

1.  Hand-score the draft against the **CDC Clear Communication Index** [202, 209].
2.  The draft must achieve a score of **90 out of 100 points** or higher before publishing approval [202, 209].
3.  Pretest complex guides with real users from our target audiences (including tenants, property managers, and older adults) to verify actual comprehension [207, 222].

---

### **7.10 References**

- _SF.gov and Karl Editor Help Center: Page structure_ [152, 153, 192, 193]
- _SF.gov and Karl Editor Help Center: Plain language_ [3, 158, 159, 197, 198]
- _SF.gov and Karl Editor Help Center: Accessibility guidelines_ [1, 2]
- _SF.gov and Karl Editor Help Center: Write descriptive links_ [129, 131, 258, 259, 395, 396]
- _SF.gov and Karl Editor Help Center: Headings_ [107, 108, 111, 112]
- _SF.gov and Karl Editor Help Center: Image guidance_ [122, 142, 143]
- _Plain-Language and Health-Literacy Best Practices for a Public-Health Department (Revised 2025)_ [160, 161, 202, 209]
