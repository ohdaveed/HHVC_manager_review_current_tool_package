import re

ref_ch2 = """
### 2.11 References
* [📒 SF.gov and Karl Editor Help Center: Structure](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/structure) [1, 2]
* [📒 SF.gov and Karl Editor Help Center: Relational content](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/structure/relational-content) [3, 4]
* [📒 SF.gov and Karl Editor Help Center: Accessibility guidelines](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility) [5-7]
* [📒 SF.gov and Karl Editor Help Center: Accessible design on SF.gov](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility/accessible-design-on-sf.gov) [8, 9]
* [📒 SF.gov and Karl Editor Help Center: How you keep pages accessible](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/accessibility/how-you-keep-pages-accessible) [10, 11]
* [📒 SF.gov and Karl Editor Help Center: Plain language](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/plain-language) [12, 13]
* [📒 SF.gov and Karl Editor Help Center: Readability](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/write-your-content/readability) [14]
* [📒 SF.gov and Karl Editor Help Center: Why plain language matters](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/plain-language/why-plain-language-matters) [15, 16]
* [📒 SF.gov and Karl Editor Help Center: Write descriptive links](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/sf.gov-style/write-descriptive-links) [17, 18]
* [📒 SF.gov and Karl Editor Help Center: Headings](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/page-structure/headings) [19, 20]
* [📒 SF.gov and Karl Editor Help Center: Avoid PDFs if possible](https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/documents-including-pdfs/pdf-accessibility-basics/avoid-pdfs-if-possible) [21]
* [📘 Plain-Language and Health-Literacy Best Practices for a Public-Health Department](https://drive.google.com/file/d/1dVsqfYRmvhmf9cPOPOn9jFsn58N0LYNE/view) [22, 23]
"""

ref_ch3 = """
<p><strong>References</strong></p>
<ul>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/content-principles">📒 SF.gov and Karl Editor Help Center: Content principles</a> [24]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/before-you-write">📒 SF.gov and Karl Editor Help Center: Audience needs vs department needs</a> [25]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/concepts/one-page-goal">📒 SF.gov and Karl Editor Help Center: One page goal</a> [26, 27]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/sf.gov-concepts-and-structure/content-types">📒 SF.gov and Karl Editor Help Center: Content Types</a> [28, 29]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/topic">📒 SF.gov and Karl Editor Help Center: Topic</a> [30]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/step-by-step/how-a-step-by-step-page-works">📒 SF.gov and Karl Editor Help Center: How a Step by step page works</a> [31]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information/how-an-information-page-works">📒 SF.gov and Karl Editor Help Center: How an Information page works</a> [32]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/resource-collection/how-a-resource-collection-page-works">📒 SF.gov and Karl Editor Help Center: How a Resource Collection page works</a> [33]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/links/connect-your-pages-together">📒 SF.gov and Karl Editor Help Center: Connect your pages together</a> [34]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/information/related-on-information-page">📒 SF.gov and Karl Editor Help Center: Related on Information page</a> [35]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/content-types/building-a-page-by-content-type/transaction/related-on-a-transaction-page">📒 SF.gov and Karl Editor Help Center: Related on a Transaction page</a> [36]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/sf.gov-style/use-sentence-case-for-titles">📒 SF.gov and Karl Editor Help Center: Use sentence case for titles</a> [37, 38]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/using-karl-the-cms/components/urls">📒 SF.gov and Karl Editor Help Center: URLs</a> [39]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/sf.gov-and-karl-foundations/writing-for-sf.gov/page-structure/titles">📒 SF.gov and Karl Editor Help Center: Titles</a> [40, 41]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/before-you-write/decide-if-you-should-publish-the-content">📒 SF.gov and Karl Editor Help Center: Decide if you should publish the content</a> [42]</li>
<li><a href="https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center/writing-on-sf.gov/before-you-write/decide-if-you-should-publish-the-content/when-moving-to-sf.gov-choose-content-to-keep">📒 SF.gov and Karl Editor Help Center: When moving to SF.gov, choose content to keep</a> [43]</li>
</ul>
"""

# 1. Update Chapter 2 Draft
ch2_path = "/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md"
with open(ch2_path, "r", encoding="utf-8") as f:
    ch2_text = f.read()

# Add to end of chapter 2 draft if not already there
if "### 2.11 References" not in ch2_text:
    with open(ch2_path, "a", encoding="utf-8") as f:
        f.write("\n" + ref_ch2)

# 2. Update Master Manual
manual_path = "/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md"
with open(manual_path, "r", encoding="utf-8") as f:
    master = f.read()

# Add Chapter 2 references right before Chapter 3
# Find Chapter 3 start
ch3_start = "<p><strong>Chapter 3: HHVC Information Architecture Standards</strong></p>"
if "### 2.11 References" not in master:
    master = master.replace(ch3_start, ref_ch2 + "\n---\n\n" + ch3_start)

# Add Chapter 3 references right before Chapter 4
ch4_start = "**Chapter 4: Karl Content Type Standards**"
if "<p><strong>References</strong></p>" not in master.split(ch4_start)[0].split(ch3_start)[-1]:
    master = master.replace(ch4_start, ref_ch3 + "\n\n" + ch4_start)

with open(manual_path, "w", encoding="utf-8") as f:
    f.write(master)

print("References added successfully.")
