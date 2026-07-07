import re

# 1. Fix Chapter 2 draft
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md", "r", encoding="utf-8") as f:
    chapter2 = f.read()

# We need to remove 2.4 Karl CMS Content Types and renumber the rest.
# The section starts at "### 2.4 Karl CMS Content Types (14 Total)" and ends right before "### 2.5 Gather User Needs"
section_to_remove = re.search(r'(### 2\.4 Karl CMS Content Types \(14 Total\).*?)(?=### 2\.5 Gather User Needs)', chapter2, re.DOTALL)

if section_to_remove:
    chapter2 = chapter2.replace(section_to_remove.group(1), "")
    # Renumber
    chapter2 = chapter2.replace("### 2.5 Gather", "### 2.4 Gather")
    chapter2 = chapter2.replace("### 2.6 Plain", "### 2.5 Plain")
    chapter2 = chapter2.replace("### 2.7 The 5 Essential", "### 2.6 The 5 Essential")
    chapter2 = chapter2.replace("### 2.8 Standardized", "### 2.7 Standardized")
    chapter2 = chapter2.replace("### 2.9 Enforceable", "### 2.8 Enforceable")
    chapter2 = chapter2.replace("### 2.10 Accessibility", "### 2.9 Accessibility")
    chapter2 = chapter2.replace("### 2.11 Content Success", "### 2.10 Content Success")
    
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md", "w", encoding="utf-8") as f:
        f.write(chapter2)

# 2. Read new Chapter 4
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-4.md", "r", encoding="utf-8") as f:
    chapter4 = f.read()
    
# Clean up Chapter 4 headers to just start directly without the overarching title since it's being inserted into the manual.
# It currently starts with:
# # SFDPH Healthy Housing and Vector Control
# 
# ## **Chapter 4: Karl Content Type Standards**
chapter4_cleaned = re.sub(r'^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 4:', '**Chapter 4:', chapter4, flags=re.MULTILINE)

# 3. Update the master manual
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "r", encoding="utf-8") as f:
    master = f.read()

# Fix Chapter 2 in the master manual
master_section_to_remove = re.search(r'(### 2\.4 Karl CMS Content Types \(14 Total\).*?)(?=### 2\.5 Gather User Needs)', master, re.DOTALL)
if master_section_to_remove:
    master = master.replace(master_section_to_remove.group(1), "")
    master = master.replace("### 2.5 Gather", "### 2.4 Gather")
    master = master.replace("### 2.6 Plain", "### 2.5 Plain")
    master = master.replace("### 2.7 The 5 Essential", "### 2.6 The 5 Essential")
    master = master.replace("### 2.8 Standardized", "### 2.7 Standardized")
    master = master.replace("### 2.9 Enforceable", "### 2.8 Enforceable")
    master = master.replace("### 2.10 Accessibility", "### 2.9 Accessibility")
    master = master.replace("### 2.11 Content Success", "### 2.10 Content Success")

# Now replace Chapter 4.
# In the master manual, Chapter 4 currently is in HTML:
# <p><strong>Chapter 4: Karl Content Type Standards</strong></p> ... up to <p><strong>Chapter 5: Required Page Patterns</strong></p>
ch4_match = re.search(r'(<p><strong>Chapter 4: Karl Content Type Standards</strong></p>.*?)(?=<p><strong>Chapter 5: Required Page Patterns</strong></p>)', master, re.DOTALL)

if ch4_match:
    master = master.replace(ch4_match.group(1), chapter4_cleaned + "\n\n")
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated successfully.")
else:
    print("Could not find Chapter 4 boundaries in master manual.")
