# Brutalist Manager Dashboard Design

## 1. Understanding Summary

- **What is being built:** A full UI overhaul of the manager review workspace (`#reviewWorkspace`) and its sub-components (tabs, dashboard, queue, review inputs).
- **Why it exists:** To make the administrative tool feel like a highly functional, no-nonsense control panel rather than a generic web page.
- **Who it is for:** Managers and reviewers who need high data density, clear status indicators, and fast interactive feedback.
- **Key constraints:** It must integrate cleanly with the existing static site architecture (Vanilla JS/CSS, no frameworks).
- **Explicit non-goals:** We are _not_ changing the underlying data schemas, export functionality, or adding complex animations.

## 2. Assumptions

- **Performance:** The CSS grid and sharp UI changes won't negatively impact rendering speed.
- **Scale:** The layout needs to comfortably hold the current volume of fields without overflowing horizontally.
- **Maintenance:** We will stick to the existing CSS variables (e.g., `var(--sfds-slate-1)`) where possible, overriding only the structural layout variables.

## 3. Decision Log

- **Decided:** Use CSS Grid and `position: sticky` for layout and footer.
- **Alternatives:** Flexbox/Absolute positioning, JS-driven layout.
- **Reason:** Native modern CSS provides the most robust and declarative way to achieve a strict grid and sticky footer with minimal HTML refactoring.

## 4. Final Design

### Part 1: Sticky Action Footer & Brutalist Buttons

**Architecture & Components:**
We will introduce a new container class, `.review-workspace-footer`, which will sit at the bottom of the overview tab.

- It will use `position: sticky; bottom: 0; background: var(--sfds-white);` and have a thick top border (`2px solid var(--sfds-slate-1)`) to separate it from the scrolling content above.
- We will move the decision actions (the "Approve", "Revise", "Blocked" buttons) and the export buttons down into this sticky footer.

**Interactions:**
For the buttons, we will update the `.decision-chip` and `.tool-btn` classes to embody the stark industrial aesthetic:

- **Default state:** 2px solid black borders, hard square corners (`border-radius: 0`), and uppercase monospace text.
- **Hover/Active state:** We will implement the inverted hover effect here. On hover or when selected, the button's background becomes solid black (`var(--sfds-slate-1)`), and the text becomes white, delivering a punchy, mechanical feel.

### Part 2: High-Density Grid Layout & Brutalist Status Tags

**Architecture & Components:**

- **The Grid Layout:** We will apply `display: grid` to the `.review-queue-table` and internal form groupings. We'll set explicitly defined grid tracks and use `border-collapse` (for tables) or `gap: 0` with internal 1px solid borders to create explicit bounding boxes for all data points. This creates a spreadsheet-like rigidity.
- **Brutalist Status Tags:** We will update the `.status-chip` CSS class.
  - Strip away all border radii (`border-radius: 0`).
  - Enforce a thick 2px solid black border (`border: 2px solid var(--sfds-slate-1)`).
  - Use solid, stark background colors (e.g., pure green for Approved, bright warning yellow for Blocked) with high-contrast text, abandoning the previous soft, pastel badge look.
