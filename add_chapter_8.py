import os
import re

base_dir = os.path.dirname(os.path.abspath(__file__))
ch8_path = os.path.join(base_dir, "hhvc_chapter_drafts", "hhvc-manual-chapter-8.md")
manual_path = os.environ.get(
    "HHVC_STANDARDS_MANUAL_PATH",
    os.path.join(base_dir, "hhvc-standards-manual.md"),
)

if not os.path.exists(ch8_path):
    print(f"Chapter 8 file not found at {ch8_path}.")
    raise SystemExit(1)

with open(ch8_path, "r", encoding="utf-8") as f:
    chapter8 = f.read()

chapter8_cleaned = re.sub(
    r"^# SFDPH Healthy Housing and Vector Control\s*\n\s*## \*\*Chapter 8:",
    "**Chapter 8:",
    chapter8,
    flags=re.MULTILINE,
)

master = ""
if os.path.exists(manual_path):
    with open(manual_path, "r", encoding="utf-8") as f:
        master = f.read()

ch8_match = re.search(r"(<p><strong>Chapter 8:.*?)$", master, re.DOTALL)

if ch8_match:
    master = master.replace(ch8_match.group(1), chapter8_cleaned + "\n")
    with open(manual_path, "w", encoding="utf-8") as f:
        f.write(master)
    print("Master manual updated with Chapter 8 (replaced existing HTML).")
else:
    if "**Chapter 8:" not in master:
        with open(manual_path, "a", encoding="utf-8") as f:
            f.write("\n\n" + chapter8_cleaned + "\n")
        print("Master manual updated with Chapter 8 (appended).")
    else:
        md_ch8_match = re.search(r"(\*\*Chapter 8:.*?)$", master, re.DOTALL)
        if md_ch8_match:
            master = master.replace(md_ch8_match.group(1), chapter8_cleaned + "\n")
            with open(manual_path, "w", encoding="utf-8") as f:
                f.write(master)
            print("Master manual updated with Chapter 8 (replaced existing markdown).")
