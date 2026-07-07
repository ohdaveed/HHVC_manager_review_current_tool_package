import os
import re
import sys

PAGES_DIR = os.path.join(os.path.dirname(__file__), "pages")

# Define validation rules based on the new HHVC Standards Manual and Master Guidelines
RULES = {
    "legacy_fees": {
        "pattern": r"(?i)\$209|\$418|10%|old fee|invoice date",
        "message": "Legacy fee detected. Must use FY27 rates (e.g., $103, $808, $10/$30 late penalties, 1.5% interest) and 30-day payment deadline.",
    },
    "reinspection_rate": {
        "pattern": r"(?i)\$209(?=\s*/\s*hr|\s*per\s*hour)|\$150(?=\s*/\s*hr|\s*per\s*hour)",
        "message": "Incorrect reinspection rate. Use FY27 rates: inspector $256/hr, technician $234/hr.",
    },
    "dbi_structural_routing": {
        "pattern": r"(?im)^(?![^\n]*(?:DBI|Department of Building Inspection))[^\n]*(?:roof\s*leaks?|plumbing\s*leaks?|broken\s*pipes?)[^\n]*$",
        "message": "Mentions of structural or plumbing issues MUST explicitly route to the Department of Building Inspection (DBI).",
    },
    "obsolete_modals": {
        "pattern": r"\bshall\b",
        "message": "The word 'shall' is prohibited unless it is a verbatim citation of the SF Health Code. Use 'must'.",
    },
    "mold_threshold": {
        "pattern": r"(?i)(any\s*amount\s*of\s*mold|small\s*mold)(?!.*10\s*square)",
        "message": "Mold jurisdiction requires a structural footprint of at least 10 square feet. Do not imply enforcement for minor tenant mold.",
    },
    "accordion_abuse": {
        "pattern": r"(?is)accordion.*?(fee|deadline|penalty|notice of violation|nov|mandatory)",
        "message": "Critical compliance details (fees, deadlines, NOVs) MUST NOT be hidden inside an accordion.",
    },
    "legacy_penalties": {
        "pattern": r"(?i)\$1,000(?=\s*per\s*day|\s*/\s*day)",
        "message": "Legacy penalty of $1,000/day detected. This is outdated.",
    },
    "placeholder_text": {
        "pattern": r"(?i)(lorem\s*ipsum|under\s*construction|coming\s*soon|\[insert.*\])",
        "message": "Placeholder text detected. Pages must be fully functional with no stubs.",
    },
}


def audit_files():
    issues_found = 0
    print("=" * 60)
    print("HHVC PAGE AUDIT REPORT")
    print("=" * 60)

    if not os.path.exists(PAGES_DIR):
        print(f"Error: Directory {PAGES_DIR} not found.")
        return 1

    for filename in os.listdir(PAGES_DIR):
        if not filename.endswith(".js"):
            continue

        filepath = os.path.join(PAGES_DIR, filename)
        with open(filepath, encoding="utf-8") as f:
            content = f.read()

        file_issues = []
        for rule_data in RULES.values():
            matches = re.finditer(rule_data["pattern"], content, re.MULTILINE)
            for match in matches:
                line_no = content[: match.start()].count("\n") + 1
                snippet = (
                    content[max(0, match.start() - 30) : min(len(content), match.end() + 30)]
                    .replace("\n", " ")
                )
                file_issues.append(
                    f"  Line {line_no}: {rule_data['message']}\n    Snippet: \"...{snippet}...\""
                )

        if file_issues:
            print(f"\n[FILE] {filename}")
            for issue in file_issues:
                print(issue)
                issues_found += 1

    print("=" * 60)
    print(f"Audit Complete. Found {issues_found} potential standard violations.")
    print("=" * 60)
    return issues_found


if __name__ == "__main__":
    sys.exit(1 if audit_files() else 0)
