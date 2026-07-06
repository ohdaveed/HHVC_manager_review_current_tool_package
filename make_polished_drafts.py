import re

with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md", "r", encoding="utf-8") as f:
    chapter2 = f.read()

new_section = """
### 2.4 Karl CMS Content Types (14 Total)
To establish the full technical boundaries of the CMS, all 14 content types are categorized below by their official platform classifications:

**Service Pages (4 types):**
*   **Topic:** The primary navigation hub and program landing page. Grouping services by theme (like "Pests and housing problems") rather than by department is the core of our Topic-First Model.
*   **Transaction:** Action-oriented pages designed for a single interaction with the City (e.g., reporting a pest or paying a fee).
*   **Step-by-step:** Process-oriented pages showing the relationships between multiple transactions that must be completed over time.
*   **Location:** Dedicated profiles for physical facilities or service sites.

**Outreach Pages (3 types):**
*   **Campaign:** Visually distinct templates used for temporary public outreach and promotional initiatives (such as seasonal mosquito prevention).
*   **News:** For time-sensitive announcements, press releases, or departmental updates.
*   **Event:** For promoting scheduled public meetings, classes, or community events.

**Department Support Pages (7 types):**
*   **Agency:** Homepages for major City departments (e.g., SFDPH as a whole). *Manual Rule: Agency pages are created exclusively by Digital Services and are not an HHVC-owned content type.*
*   **About:** Used to describe the program's background, legal authority, and organizational identity.
*   **Data story:** Used to publish interactive public data narratives incorporating PowerBI dashboard embeds.
*   **Meeting:** Used to post legally required public agendas, schedules, and minutes.
*   **Profile:** For directory profiles of individual staff members or teams.
*   **Report:** Used to publish long-form reference documents. *Manual Rule: In Karl, "Report" is the only content type that natively supports tables.*
*   **Resource Collection:** Used to group and display downloadable handouts, PDF brochures, or external links in an organized library.
"""

# Find where to insert (right before Gather User Needs)
insert_marker = "### 2.4 Gather User Needs & The 'Deal Breakers' Rule"
if insert_marker in chapter2:
    parts = chapter2.split(insert_marker)
    # Re-number the following sections
    remainder = insert_marker + parts[1]
    
    # 2.4 -> 2.5
    remainder = remainder.replace("### 2.4 Gather", "### 2.5 Gather")
    # 2.5 -> 2.6
    remainder = remainder.replace("### 2.5 Plain", "### 2.6 Plain")
    # 2.6 -> 2.7
    remainder = remainder.replace("### 2.6 The 5 Essential", "### 2.7 The 5 Essential")
    # 2.7 -> 2.8
    remainder = remainder.replace("### 2.7 Standardized", "### 2.8 Standardized")
    # 2.8 -> 2.9
    remainder = remainder.replace("### 2.8 Enforceable", "### 2.9 Enforceable")
    # 2.9 -> 2.10
    remainder = remainder.replace("### 2.9 Accessibility", "### 2.10 Accessibility")
    # 2.10 -> 2.11
    remainder = remainder.replace("### 2.10 Content Success", "### 2.11 Content Success")
    
    chapter2_updated = parts[0] + new_section + "\n---\n\n" + remainder
    
    with open("/home/ohdaveed/HHVC_manager_review_current_tool_package/hhvc_chapter_drafts/hhvc-manual-chapter-2.md", "w", encoding="utf-8") as f:
        f.write(chapter2_updated)
        
    print("Updated chapter 2 draft successfully.")
else:
    print("Could not find section 2.4 to replace")

