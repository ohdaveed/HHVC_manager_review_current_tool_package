import re

# Read the newly updated Chapter 2 draft
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md", "r", encoding="utf-8") as f:
    chapter2 = f.read()

# Read the consolidated manual
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "r", encoding="utf-8") as f:
    content = f.read()

# The manual contains Chapter 2 from "**Chapter 2: SF.gov and Karl Foundations (Topic-First Model & User Needs)**"
# down to just before "**Chapter 3: HHVC Information Architecture Standards**" (or the end of the file/chapter 3 if formatted that way).
# The current version in hhvc-standards-manual.md was literally what we just pasted in the previous step.
# Wait, the previous step pasted both Chapter 1 and Chapter 2.
# Let's just find the start of Chapter 2 and the start of Chapter 3, and replace everything in between.

pattern = re.compile(r'(\*\*Chapter 2: SF\.gov and Karl Foundations.*?\n)(?:---)?\s*<p><strong>Chapter 3: HHVC Information Architecture Standards', re.DOTALL)
# Wait, we wrote the new Chapter 1 and 2 in Markdown, but the rest of the file is still in HTML.
# So Chapter 3 starts with `<p><strong>Chapter 3: HHVC Information Architecture Standards</strong></p>`

prefix_match = re.search(r'^(.*?)\*\*Chapter 2: SF\.gov and Karl Foundations \(Topic-First Model & User Needs\)\*\*', content, re.DOTALL)
suffix_match = re.search(r'(<p><strong>Chapter 3: HHVC Information Architecture Standards</strong></p>.*)$', content, re.DOTALL)

if prefix_match and suffix_match:
    prefix = prefix_match.group(1)
    suffix = suffix_match.group(1)
    
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "w", encoding="utf-8") as f:
        f.write(prefix + chapter2 + "\n\n" + suffix)
    print("Successfully synchronized the master manual with the new Chapter 2.")
else:
    print("Could not find boundaries to synchronize the master manual.")
