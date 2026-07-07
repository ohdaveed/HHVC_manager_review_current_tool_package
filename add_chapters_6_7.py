import os
import re

base_dir = os.path.dirname(os.path.abspath(__file__))
ch6_path = os.path.join(base_dir, "hhvc_chapter_drafts", "hhvc-manual-chapter-6-v2.md")
ch7_path = os.path.join(base_dir, "hhvc_chapter_drafts", "hhvc-manual-chapter-7.md")
master_path = os.environ.get(
    "HHVC_STANDARDS_MANUAL_PATH",
    os.path.join(base_dir, "hhvc-standards-manual.md"),
)

with open(ch6_path, "r", encoding="utf-8") as f:
    chapter6 = f.read()

with open(ch7_path, "r", encoding="utf-8") as f:
    chapter7 = f.read()

chapter6_cleaned = re.sub(
    r"^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 6:",
    "**Chapter 6:",
    chapter6,
    flags=re.MULTILINE,
)
chapter7_cleaned = re.sub(
    r"^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 7:",
    "**Chapter 7:",
    chapter7,
    flags=re.MULTILINE,
)

master = ""
if os.path.exists(master_path):
    with open(master_path, "r", encoding="utf-8") as f:
        master = f.read()

ch6_match = re.search(
    r"(<p><strong>Chapter 6:.*?)(?=<p><strong>Chapter 8:|$)",
    master,
    re.DOTALL,
)

if ch6_match:
    master = master.replace(
        ch6_match.group(1), chapter6_cleaned + "\n\n" + chapter7_cleaned + "\n\n"
    )
    with open(master_path, "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated with Chapters 6 and 7.")
else:
    if "<p><strong>Chapter 6:" not in master:
        with open(master_path, "a", encoding="utf-8") as f:
            f.write("\n\n" + chapter6_cleaned + "\n\n" + chapter7_cleaned)
        print("Master manual updated with Chapters 6 and 7 (appended).")
    else:
        print("Could not find Chapter 6 boundaries.")
