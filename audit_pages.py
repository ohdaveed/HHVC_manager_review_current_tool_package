import os
import re

PAGES_DIR = "/home/ohdaveed/HHVC_manager_review_current_tool_package/pages"

# Define validation rules based on the new HHVC Standards Manual and Master Guidelines
RULES = {
    "legacy_fees": {
        "pattern": r"(?i)\$209|\$418|10%|old fee|invoice date",
        "message": "Legacy fee detected. Must use FY27 rates (e.g., $103, $206, $10/$30 late penalties, 1.5% interest) and 30-day payment deadline."
    },
    "reinspection_rate": {
        "pattern": r"(?i)\$209(?=\s*/\s*hr|\s*per\s*hour)|\$150",
        "message": "Incorrect reinspection rate. Must be exactly $256/hour."
    },
    "dbi_structural_routing": {
        "pattern": r"(?i)(roof\s*leak|plumbing\s*leak|structural|broken\s*pipe)(?!.*DBI|.*Department of Building Inspection)",
        "message": "Mentions of structural or plumbing issues MUST explicitly route to the Department of Building Inspection (DBI)."
    },
    "obsolete_modals": {
        "pattern": r"\bshall\b",
        "message": "The word 'shall' is prohibited unless it is a verbatim citation of the SF Health Code. Use 'must'."
    },
    "mold_threshold": {
        "pattern": r"(?i)any\s*amount\s*of\s*mold|small\s*mold",
        "message": "Mold jurisdiction requires a structural footprint of at least 10 square feet. Do not imply enforcement for minor tenant mold."
    },
    "accordion_abuse": {
        # Looks for critical keywords near 'accordion' components
        "pattern": r"(?i)accordion.*?(fee|deadline|penalty|notice of violation|nov|mandatory)",
        "message": "Critical compliance details (fees, deadlines, NOVs) MUST NOT be hidden inside an accordion."
    },
    "legacy_penalties": {
        "pattern": r"(?i)\$1,000(?=\s*per\s*day|\s*/\s*day)",
        "message": "Legacy penalty of $1,000/day detected. This is outdated."
    },
    "placeholder_text": {
        "pattern": r"(?i)(lorem\s*ipsum|under\s*construction|coming\s*soon|\[insert.*\])",
        "message": "Placeholder text detected. Pages must be fully functional with no stubs."
    }
}

def audit_files():
    issues_found = 0
    print("=" * 60)
    print("HHVC PAGE AUDIT REPORT")
    print("=" * 60)
    
    if not os.path.exists(PAGES_DIR):
        print(f"Error: Directory {PAGES_DIR} not found.")
        return

    for filename in os.listdir(PAGES_DIR):
        if not filename.endswith(".js"):
            continue
            
        filepath = os.path.join(PAGES_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        file_issues = []
        for rule_name, rule_data in RULES.items():
            matches = re.finditer(rule_data["pattern"], content)
            for match in matches:
                # Get line number
                line_no = content[:match.start()].count('\n') + 1
                snippet = content[max(0, match.start() - 30):min(len(content), match.end() + 30)].replace('\n', ' ')
                file_issues.append(f"  Line {line_no}: {rule_data['message']}\n    Snippet: \"...{snippet}...\"")
                
        if file_issues:
            print(f"\n[FILE] {filename}")
            for issue in file_issues:
                print(issue)
                issues_found += 1
                
    print("=" * 60)
    print(f"Audit Complete. Found {issues_found} potential standard violations.")
    print("=" * 60)

if __name__ == "__main__":
    audit_files()
