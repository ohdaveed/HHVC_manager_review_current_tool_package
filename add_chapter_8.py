import re
import os

ch8_path = "/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-8 (1).md"
manual_path = "/home/ohdaveed/HHVC_manager_review_current_tool_package/notebooklm/hhvc-standards-manual.md"

if os.path.exists(ch8_path):
    with open(ch8_path, "r", encoding="utf-8") as f:
        chapter8 = f.read()

    # Clean up headers
    chapter8_cleaned = re.sub(r'^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 8:', '**Chapter 8:', chapter8, flags=re.MULTILINE)

    with open(manual_path, "r", encoding="utf-8") as f:
        master = f.read()

    # Find where Chapter 8 starts in the master
    ch8_match = re.search(r'(<p><strong>Chapter 8:.*?)$', master, re.DOTALL)
    
    if ch8_match:
        master = master.replace(ch8_match.group(1), chapter8_cleaned + "\n")
        with open(manual_path, "w", encoding="utf-8") as f:
            f.write(master)
        print("Master manual updated with Chapter 8 (replaced existing HTML).")
    else:
        # Check if we already appended it or if it's somehow missing
        if "**Chapter 8:" not in master:
            with open(manual_path, "a", encoding="utf-8") as f:
                f.write("\n\n" + chapter8_cleaned + "\n")
            print("Master manual updated with Chapter 8 (appended).")
        else:
            # It's already in markdown format, we can replace it
            md_ch8_match = re.search(r'(\*\*Chapter 8:.*?)$', master, re.DOTALL)
            if md_ch8_match:
                master = master.replace(md_ch8_match.group(1), chapter8_cleaned + "\n")
                with open(manual_path, "w", encoding="utf-8") as f:
                    f.write(master)
                print("Master manual updated with Chapter 8 (replaced existing markdown).")
else:
    print("Chapter 8 file not found in drafts folder.")
