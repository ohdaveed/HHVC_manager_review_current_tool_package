import re

# Read drafts
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-6-v2.md", "r", encoding="utf-8") as f:
    chapter6 = f.read()

with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-7.md", "r", encoding="utf-8") as f:
    chapter7 = f.read()

# Clean up headers
chapter6_cleaned = re.sub(r'^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 6:', '**Chapter 6:', chapter6, flags=re.MULTILINE)
chapter7_cleaned = re.sub(r'^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 7:', '**Chapter 7:', chapter7, flags=re.MULTILINE)

# Read master manual
with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "r", encoding="utf-8") as f:
    master = f.read()

# Find where Chapter 6 starts in the master
ch6_match = re.search(r'(<p><strong>Chapter 6:.*?)(?=<p><strong>Chapter 8:|$)', master, re.DOTALL)

if ch6_match:
    # Replace everything from Chapter 6 up to Chapter 8 (if it exists) with the new Ch 6 and Ch 7
    master = master.replace(ch6_match.group(1), chapter6_cleaned + "\n\n" + chapter7_cleaned + "\n\n")
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated with Chapters 6 and 7.")
else:
    # If not found, maybe just append it if Chapter 5 is at the end? Let's check if Chapter 6 is already there.
    if "<p><strong>Chapter 6:" not in master:
        with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "a", encoding="utf-8") as f:
            f.write("\n\n" + chapter6_cleaned + "\n\n" + chapter7_cleaned)
        print("Master manual updated with Chapters 6 and 7 (appended).")
    else:
        print("Could not find Chapter 6 boundaries.")

