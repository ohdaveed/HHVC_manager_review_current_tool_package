# Karl CMS Publishing & Tab Workflows

Source: Karl Editor Help Center (GitBook) — https://sfdigitalservices.gitbook.io/karl-sf.gov-editor-help-center

Karl operates on a standard Wagtail 3-tab interface across all content types.

---

## 1. The Three-Tab Model

Every Karl content type uses a `TabbedInterface` with three tabs:
1. **Content Tab:** Page-specific body fields, heroes, streamfield choosers, and contact blocks.
2. **Promote Tab:** SEO and search metadata:
   - `slug` (Required): The URL slug for the page.
   - `seo_title` (Optional): Search engine title override.
   - `search_description` (Optional): Search snippet description.
   - `show_in_menus` (Optional): Checkbox to display page in navigation menus.
   - `tags` (Optional): Taxonomy tags (ClusterTaggableManager).
3. **Settings Tab:** Publication management:
   - Go-live date/time and Expiry date/time.
   - Privacy / access restrictions.
   - Locked / unlocked page state.

---

## 2. Editor Modes & States
- **Live Mode:** The currently published version visible to the public on SF.gov.
- **Page Editor Mode:** Working draft environment where edits can be staged and saved.
- **Preview Mode:** Renders the draft in real-time as it will appear on SF.gov before publishing.
- **Revision History:** Full audit log of all saves and publishes, allowing one-click rollback to any previous version.
