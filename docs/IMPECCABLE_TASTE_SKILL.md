# Impeccable Taste & Design Skill
## From Emil Kowalski's Design Philosophy

**Core Principle:** Design is not decoration. Every element serves intention. Taste is developed through constraints, not abundance.

---

## The Impeccable Skill

### 1. Constraint-Driven Design
- **Fewer colors → sharper hierarchy.** Start with one primary, one neutral, one accent. Add only when information requires it.
- **Single typeface → intentional scale.** Master 3-4 sizes before adding new fonts.
- **Minimal spacing system → predictable relationships.** 4px, 8px, 16px, 24px. No random 12px, 13px, 18px.
- **Fewer components → deeper refinement.** Build 5 buttons perfectly before designing 50 variations.

### 2. Intentionality Over Trends
- **Ask "why" for every detail.** If the answer is "because it looks modern" → wrong reason.
- **Reject pattern templates.** "3 cards in a row" is a template. "3 cards here because the data is tiers" is design.
- **Avoid the obvious.** Gradients, shadows, rounded corners are the first ideas. The 5th idea is usually better.

### 3. Taste Develops Through Seeing
- **Study exemplars, not trends.** Follow designers who make intentional choices (not Dribbble popularity).
- **Copy nothing. Learn everything.** Analyze *why* a design works before borrowing its form.
- **Defend every decision to a critic.** If you can't explain it in one sentence, it's not thought through.

---

## Design Moves (Taste Skill Checklist)

### When Choosing Color
- ❌ **"What color looks good?"** → Empty question.
- ✅ **"What is the semantic intent?"** (error, success, info, neutral, action)
- ✅ **Then map to a single color family.** All reds for errors. All greens for success.
- **Test adjacency.** If two colors sit next to each other, do they fight or harmonize?

### When Placing Elements
- ❌ **"Centered looks balanced."** → Lazy symmetry.
- ✅ **"Where does the eye go first?"** → Hierarchy determines position.
- ✅ **White space is structure.** Large gaps indicate separate ideas. Small gaps indicate connection.

### When Choosing Typography
- ❌ **"This font is trendy."** → Trend dies, design stays.
- ✅ **"Does this font support the tone?"** (formal, friendly, technical, playful)
- ✅ **Consistent weights.** 2-3 weights maximum. Don't use 300, 400, 500, 600, 700—too many layers.

### When Building Components
- ❌ **"Let's make it customizable."** → Bloat before use.
- ✅ **"What is the core job?"** Button is: label + state. Not: label + icon + dropdown + badge + loading spinner.
- ✅ **Compose from constraints.** A button has 3 sizes: small (16px), default (40px), large (48px). No 44px.

### When Grouping Information
- ❌ **"Let's make them all the same height."** → Visual noise, false equivalence.
- ✅ **"What matters first, second, third?"** → Size and position reflect importance.
- ✅ **Justify the layout.** If a card is taller, there's a reason (more content or higher priority).

---

## Red Flags (AI Slop Indicators)

Reject designs that show these patterns:

1. **Unnecessary Gradients**
   - Gradient on a button: why?
   - Gradient on a background: why?
   - If you can't answer, remove it.

2. **Symmetrical Everything**
   - 3 equal cards, 3 equal heights, 3 equal spacing
   - If all parts are equal, they're not communicating hierarchy

3. **Random Colors on Cards**
   - Teal card, pink card, purple card (no semantic reason)
   - Color bar on the left side (Dribbble template)

4. **Over-Rounded Corners**
   - 20px, 24px corners on a button (juvenile)
   - 100% round on rectangles (unjustified)
   - Standard: 4px, 6px, 8px only

5. **Icon Overuse**
   - Icon for every label (decoration, not information)
   - Icons from 3 different sets (amateur)
   - Icon that doesn't communicate clearly within 1 second

6. **"Friendly" Design Clichés**
   - Floating confetti, rotating shapes, particles
   - Excessive shadows and depth (flat > fake 3D)
   - Glow effects (not 2024)

---

## The Taste Decision Tree

**When starting a design:**

1. **What is the user's job?**
   - Read? Search? Create? Confirm?

2. **What information matters most?**
   - Primary → Secondary → Tertiary

3. **How do we show that hierarchy?**
   - Size, position, color, weight, white space

4. **What is the minimum to accomplish this?**
   - Remove everything else

5. **Does every color, font, spacing, icon have a reason?**
   - If not, remove it

6. **Can I explain this to a designer I respect in one sentence?**
   - If not, go back to step 3

---

## Implementation: Taste Audit

Before shipping any UI:

- [ ] **Colors:** Each color has a semantic purpose (not decorative)
- [ ] **Typography:** Max 2 typefaces, max 3 weights
- [ ] **Spacing:** Every gap aligns to 4px/8px/16px/24px scale
- [ ] **Hierarchy:** Largest element is most important; progression is clear
- [ ] **Icons:** All from React Icons; each icon has a reason; no missing or ambiguous icons
- [ ] **Components:** Each has a clear, single job; no "in case we need" features
- [ ] **Contrast:** All text meets WCAG AA (4.5:1 minimum)
- [ ] **Symmetry:** Not used to mask lazy design
- [ ] **Gradients:** 0 unless design intentionally needs them
- [ ] **Can I defend this?** Every choice explained in one sentence

---

## Quick Reference: What "Impeccable" Means

| Aspect | Impeccable | Slop |
|--------|-----------|------|
| **Color** | Semantic intent, limited palette | Rainbow of "fun" colors |
| **Layout** | Hierarchy-driven | Symmetric template |
| **Icons** | React Icons, one set, purposeful | Mixed sets, decorative |
| **Typography** | 1-2 fonts, 2-3 weights | Font explosion |
| **Spacing** | 4/8/16/24px scale | Random pixel values |
| **Components** | Single, clear job | Swiss Army knife |
| **Gradients** | Intentional (rare) | "Looks modern" |
| **Corners** | 4-8px standard | 20px+ casual |
| **Shadows** | Depth only, minimal | Everywhere |
| **Whitespace** | Structure | Padding filler |

---

## References

- **Bringhurst, Robert.** *The Elements of Typographic Style*
- **Tufte, Edward.** *The Visual Display of Quantitative Information*
- **Albers, Josef.** *Interaction of Color*
- **Kapor, Mitchell.** "Design as a Discipline" (constraints, not abundance)
