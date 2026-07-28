# Design System & Aesthetics

Nestor is designed to be visually striking, taking inspiration from premium SaaS products, glassmorphism, and modern cyber-aesthetic trends. If it doesn't "wow" the user at first glance, it fails its design objective.

## Core Philosophy

1. **Vibrancy & Contrast**: Utilizing a deep dark mode background combined with highly saturated accent colors to guide the user's eye.
2. **Fluidity**: Elements should react to user interaction. We utilize micro-animations via Framer Motion for hover states, list rendering, and modal popups.
3. **Depth & Layers**: Flat design is avoided. We use glowing drop shadows, subtle inset borders, and absolute-positioned blurred background orbs to create physical depth.

## Tailwind Configuration

Nestor utilizes a bespoke Tailwind CSS configuration. Custom tokens ensure consistency across the application.

### Color Palette
- **Backgrounds**: Deep, rich navy and charcoal tones (\`#090E17\`, \`#0c1222\`).
- **Accents**: 
  - Cyan: \`#00f2fe\`
  - Blue: \`#4facfe\`
  - Purple: \`#a18cd1\`
- **Status Colors**: Emerald (Success/Working), Amber (Off/Pending), Danger (Red).

### Typography
- **Primary Font**: Inter (or equivalent clean sans-serif).
- **Styling**: Extensive use of \`tracking-wider\`, \`tracking-widest\`, and uppercase styling for micro-headers and badges to simulate premium technical interfaces. 
- **Weights**: Bold contrast (e.g., \`font-extrabold\` for headers, \`font-medium\` for secondary text).

## Key UI Components

### 1. Cards
Cards are never just flat boxes. They feature:
- Rounded corners (\`rounded-[20px]\`).
- Translucent borders (\`border-white/5\`).
- Glowing shadows tied to the context of the data (e.g., Shift Cards glow with their respective shift color).

### 2. Modals & Sidebars
Utilizing high Z-indexes and backdrop-blurs (\`backdrop-blur-sm\`) to ensure the user's focus is entirely drawn to the active element, fading the background context away seamlessly.

### 3. Responsive Adaptability
- **Desktop**: Expansive, grid-based layouts leveraging the full width of the screen.
- **Mobile**: Dynamic accordions and sticky navigation bars. Sidebars collapse into bottom or top navs, and data tables transform into stacked vertical cards to prevent horizontal scrolling issues.
