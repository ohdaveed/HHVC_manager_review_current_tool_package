# HHVC Manager Review Mockup Tool — Topic Page Update

This package is the manager-review version of the current HHVC/SF.gov mockup tool.

## Primary change

**Pests and housing problems** is now a **Topic page**, not an Agency page section.

The Topic page opens first and uses four scannable clusters:

1. Report a problem
2. Prevent pests and housing health problems
3. Know what HHVC can inspect
4. Tenant rights and help

## Open

Open `index.html` in a browser. If browser security blocks local scripts, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## File structure

```text
HHVC_manager_review_current_tool_package/
├─ index.html
├─ css/styles.css
├─ js/page-data.js
├─ js/app.js
├─ pages/*.js
├─ data/page_inventory.json
├─ data/page_inventory.csv
├─ diagrams/hhvc-current-tool-sitemap.svg
└─ review/
   ├─ manager_review_packet.md
   ├─ manager_decision_log.csv
   └─ page_approval_checklist.csv
```

## Editing rules

- Edit public page content in `pages/*.js`.
- Edit render behavior in `js/app.js`.
- Edit styles in `css/styles.css`.
- Use review exports for manager decisions only.
- Do not use review exports as automatic publication approval.

## Pages included

- Pests and housing problems — Topic page
- Report rats or mice — Transaction
- Report cockroaches — Transaction
- Report bed bugs — Transaction
- Bed bug rules and prevention — Information
- Report mosquitoes in your home or backyard — Transaction
- Report overgrown vegetation or garbage — Transaction
- Report mold from humidity or condensation — Transaction
- Learn what Healthy Housing and Vector Control can inspect — Information
- Integrated pest management for property managers — Information
- What happens after you report a housing or pest problem — Information
- Tenant rights when reporting housing conditions — Information
- Keep rats and mice out of your home — Information
- Prevent cockroaches — Information
- Prevent mosquitoes — Information

## Automation note

Best workflow: export manager-review CSV files into a watched Drive folder, then use Make.com to update only matching review rows in the master workbook by `page_key` or `url_slug`.
