import os
import re

base_dir = os.path.dirname(os.path.abspath(__file__))
ch5_path = os.path.join(base_dir, "hhvc_chapter_drafts", "hhvc-manual-chapter-5.md")
master_path = os.path.join(base_dir, "notebooklm", "hhvc-standards-manual.md")

with open(ch5_path, "r", encoding="utf-8") as f:
    chapter5 = f.read()

chapter5_cleaned = re.sub(
    r"^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 5:",
    "**Chapter 5:",
    chapter5,
    flags=re.MULTILINE,
)

if not os.path.exists(master_path):
    print(f"Master manual not found at {master_path}. Skipping merge.")
    raise SystemExit(1)

with open(master_path, "r", encoding="utf-8") as f:
    master = f.read()

ch5_match = re.search(
    r"(<p><strong>Chapter 5: Required Page Patterns</strong></p>.*?)(?=<p><strong>Chapter 6:)",
    master,
    re.DOTALL,
)

if ch5_match:
    master = master.replace(ch5_match.group(1), chapter5_cleaned + "\n\n")
    with open(master_path, "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated with Chapter 5.")
else:
    print("Could not find Chapter 5 to 6 boundaries. Let me check the file contents.")
