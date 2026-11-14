# UI Guideline - UGLF Web

**Design Principle:** Impeccable taste, intentional decisions. No AI slop, no generic patterns.

---

## Typography

- **Primary Font:** PLUS JAKARTA SANS
  - Regular: 400
  - Medium: 500
  - Semibold: 600
  - Bold: 700

- **Usage:**
  - Headings (H1-H4): Semibold to Bold
  - Body text: Regular (400)
  - Labels, buttons: Medium to Semibold
  - All text must use PLUS JAKARTA SANS—no fallbacks to system fonts unless unavoidable

---

## Color & Spacing

- **Avoid generic practices:**
  - ❌ Gradients as visual fluff (only use for intentional emphasis)
  - ❌ Symmetric 3-4 card layouts (cards are grouped by hierarchy, not aesthetics)
  - ❌ Arbitrary color bars on card edges (left side accent)
  - ❌ Generic chip components (use only when interaction requires it)

- **Color approach:**
  - Derive color from intent, not decoration
  - Establish contrast hierarchy: primary → secondary → tertiary
  - Test for WCAG AA minimum (4.5:1 text contrast)

- **Gunadarma palette** (source of truth: `frontend/src/index.css` `@theme`; Gunadarma publishes no official hex, values approximate the almamater purple):

  | Token | Hex | Use |
  |---|---|---|
  | `ug-800` | `#3d1468` | Header, page bands, signage blocks |
  | `ug-700` | `#4f1d86` | Secondary buttons, links, `Perlu Verifikasi` stamp, focus ring on light |
  | `ug-100` | `#efe6f8` | Quiet bands, secret-traits panel |
  | `gold` | `#f2b705` | Ticket, the single loud CTA per view, focus ring on purple |
  | `paper` / `sheet` | `#f7f3ea` / `#fffdf8` | Page background / form sheets |
  | `ink` | `#1e1030` | Text, borders, hard offset shadows |
  | `ok` / `danger` | `#1c7c45` / `#b42318` | `Selesai` / `Ditolak` and errors only |

  Gold text is never placed on paper (contrast too low); use `gold-ink` there.

- **Visual language:** loket paperwork, not SaaS. Claim tickets (gold, perforated), rubber stamps for status (`Stamp`), form sheets with a hard ink offset shadow, perforated section edges. Every section of a page uses a different layout structure; no two consecutive sections share the same grid.

- **Spacing:**
  - Use consistent scale (e.g., 4px, 8px, 16px, 24px, 32px)
  - Whitespace is structure, not padding filler

---

## Components

### Buttons
- No gradient backgrounds; solid color with clear contrast
- State: default → hover → active → disabled
- Padding proportional to label size (no over-padding)
- Example: Primary (Semibold, 16px PLUS JAKARTA), Secondary (Regular, subtle background)

### Forms
- Labels above inputs (or left-aligned for dense layouts, never floating)
- Input height: minimum 40px (touch target)
- Error state: red text + error icon (from React Icons)
- Focus state: clear outline or border highlight

### Cards
- **Structure over symmetry:**
  - Group by information hierarchy, not equal height
  - Asymmetric layouts are acceptable if they serve content
  - Padding: consistent gutters (16px or 24px)
- No decorative side borders or accent bars

### Icons
- **Required:** React Icons library only
  - Prefix: `import { IconName } from 'react-icons/...'`
  - Size: 20px (standard), 24px (large), 16px (small)
  - Color: inherit from text or explicit (no random icon colors)
- No custom/unknown icon sets
- No icon usage for pure decoration

### Navigation
- Clear hierarchy: primary → secondary actions
- Active state: bold text or underline (not background color change alone)
- Breadcrumbs for nested contexts

---

## Anti-Patterns (DO NOT USE)

1. **Generic Gradients**
   - ❌ `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
   - Only gradients with clear purpose (e.g., status indicators)

2. **Symmetric Card Grids**
   - ❌ 3 cards equal height, equal width, equal spacing → looks like template filler
   - ✅ Cards sized by content relevance or hierarchical importance

3. **Generic Chip Components**
   - ❌ Chips for tags/labels that are read-only or non-interactive
   - ✅ Chips only for removable filters or selectable options

4. **AI Design Clichés**
   - ❌ Rotating 3D objects, floating particles, multiple color-coded dots
   - ❌ "Friendly" rounded corners everywhere (balance: 4px-8px max for UI)
   - ❌ 20+ shades of the same color in a palette
   - ❌ Glowing effects, drop shadows on everything

5. **Icon Misuse**
   - ❌ Random icons to "make it pretty" (no icon = better than wrong icon)
   - ❌ Icons from multiple libraries (React Icons only)

---

## Implementation Checklist

- [ ] All text: PLUS JAKARTA SANS font loaded and applied
- [ ] No gradient backgrounds used for decoration
- [ ] Card layouts justified by content, not symmetry
- [ ] Icons from React Icons only; 20px/24px/16px sizes
- [ ] Color contrast tested (WCAG AA)
- [ ] No generic chips; chips only when interaction requires
- [ ] Focus states defined for all interactive elements
- [ ] Spacing follows 4px/8px/16px/24px scale

---

## References

- **Font:** PLUS JAKARTA SANS (Google Fonts)
- **Icons:** [React Icons](https://react-icons.github.io/react-icons/)
- **Accessibility:** [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)
