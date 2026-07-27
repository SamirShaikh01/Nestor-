---
name: Midnight Amethyst
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2eb'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2e3037'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#cebdff'
  on-tertiary: '#381385'
  tertiary-container: '#9b7fed'
  on-tertiary-container: '#31057e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#e8ddff'
  tertiary-fixed-dim: '#cebdff'
  on-tertiary-fixed: '#21005e'
  on-tertiary-fixed-variant: '#4f319c'
  background: '#10131a'
  on-background: '#e1e2eb'
  surface-variant: '#32353c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: 0.01em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.015em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.015em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies a sophisticated, immersive aesthetic tailored for high-end SaaS and technology platforms. It transitions from a cold, high-contrast dark mode to a rich, tonal atmosphere that prioritizes depth and professional elegance.

The design style is a hybrid of **Glassmorphism** and **Corporate Modern**. It utilizes translucent layers, vibrant background blurs, and subtle outer glows to create a sense of digital "lume." The emotional response is one of calm authority and premium quality, moving away from sterile utility toward a warmer, more inviting dark-interface experience.

## Colors
The palette is anchored by a deep charcoal neutral, infused with purple undertones to prevent visual fatigue. 

- **Primary (#8B5CF6):** A vibrant violet used for key actions and brand presence.
- **Secondary (#6366F1):** A deep indigo used for secondary interactions and accents.
- **Surface Strategy:** Surfaces are not pure grey. `surface-container` and `surface-bright` utilize a "Midnight Amethyst" tint, adding warmth and a sense of layered glass over a dark void.
- **Accents:** Use low-opacity washes of the primary color for background glows and state indications.

## Typography
This design system utilizes **Inter** exclusively to maintain a clean, systematic feel. To elevate the aesthetic to a "premium" level, the tracking (letter-spacing) is intentionally widened across all roles.

For large display and headline styles, use a tighter line-height to maintain impact, while body text receives generous leading for superior legibility against the dark background. All labels should be set in medium weight with increased tracking for maximum clarity at small sizes.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a 12-column structure for desktop and a 4-column structure for mobile. 

The spacing rhythm is built on an 8px base unit. To support the sophisticated "airy" feel, prioritize the use of `md` (24px) and `lg` (48px) spacing for internal container padding. Content should feel uncrowded, allowing the background glows and glass effects room to breathe. Use 24px gutters consistently to maintain vertical alignment across complex dashboards.

## Elevation & Depth
Hierarchy is established through **Tonal Layers** and **Glassmorphism**. 

- **Level 1 (Base):** The neutral charcoal background.
- **Level 2 (Cards/Containers):** `surface-container` with a subtle 1px inner border (opacity 10% white) to simulate a glass edge.
- **Level 3 (Overlays/Modals):** `surface-bright` with a backdrop blur of 12px-20px.
- **Active States:** Active or hovered elements should feature an "Amethyst Glow"—a soft outer shadow using the primary violet color (#8B5CF6) with a 15-25% opacity and a 15px-30px blur radius. This creates a luminous effect that makes the UI appear as if it is back-lit.

## Shapes
The shape language is ultra-soft and organic. A consistent 24px radius (`rounded-xl` / Pill-shaped) is applied to all primary containers, cards, and large buttons. This high radius counteracts the technical nature of the Inter typeface, making the interface feel approachable and modern. Smaller components like checkboxes or tags should scale down to 8px or 12px respectively to maintain visual harmony.

## Components

- **Buttons:** Primary buttons use a solid violet gradient (#8B5CF6 to #6366F1) with white text. On hover, apply the "Amethyst Glow" outer shadow. Secondary buttons should be transparent with a 1px violet border and subtle background tint on hover.
- **Inputs:** Fields use `surface-bright` with a subtle inset shadow. The focus state transitions the border to the primary violet and adds a soft 4px glow.
- **Cards:** Use `surface-container` with 24px corner radius. Apply a 1px border at 5% white opacity to define the edges against the dark background.
- **Chips/Tags:** Rounded-full (pill) shapes with low-opacity violet backgrounds and high-contrast violet text.
- **Lists:** Items separated by low-opacity amethyst dividers (5-10% opacity). Hover states should use a subtle horizontal gradient that fades out toward the right edge.
- **Navigation:** Sidebars use a more opaque version of the surface color to provide a structural anchor, while active menu items utilize a vertical "glow bar" on the left edge.