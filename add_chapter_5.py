import re

with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-5.md", "r", encoding="utf-8") as f:
    chapter5 = f.read()

# Clean up header
chapter5_cleaned = re.sub(r'^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 5:', '**Chapter 5:', chapter5, flags=re.MULTILINE)

with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "r", encoding="utf-8") as f:
    master = f.read()

# Find Chapter 5 and Chapter 6
ch5_match = re.search(r'(<p><strong>Chapter 5: Required Page Patterns</strong></p>.*?)(?=<p><strong>Chapter 6:)', master, re.DOTALL)

if ch5_match:
    master = master.replace(ch5_match.group(1), chapter5_cleaned + "\n\n")
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md", "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated with Chapter 5.")
else:
    # If Chapter 6 is missing or different format, let's try just end of file
    print("Could not find Chapter 5 to 6 boundaries. Let me check the file contents.")
    
