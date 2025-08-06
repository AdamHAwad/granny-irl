# Granny IRL - UI Rework Proposal

## Design Philosophy
Combining minimalist principles from Splashin with Dead by Daylight's horror aesthetic to create a sleek, trendy interface that matches the game's outdoor tag mechanics.

## Current Issues Analysis
- Basic styling with standard button colors (blue/green)
- Generic spacing and layout
- Lacks horror game atmosphere
- No visual hierarchy or brand identity
- Standard form elements without character

## Proposed Design System

### Color Palette
**Primary Dark Theme:**
- Background: Deep charcoal (#0a0a0b) to match horror aesthetic
- Surface: Dark gray (#1a1a1d) for cards/modals
- Primary accent: Blood red (#c41e3a) for danger/killer elements
- Secondary accent: Eerie green (#2d5a3d) for survivor/safe elements
- Text primary: Off-white (#f5f5f5)
- Text secondary: Light gray (#a0a0a0)
- Warning: Amber (#f59e0b) for skillcheck timing

**Minimalist Accents:**
- Subtle borders: Dark gray (#2a2a2d)
- Hover states: Lighter surface (#252529)
- Success: Muted green (#4ade80)
- Error: Muted red (#ef4444)

### Typography
```css
/* Primary headings - Bold, impactful */
font-family: 'Inter', system-ui, sans-serif;
font-weight: 700;
letter-spacing: -0.025em;

/* Body text - Clean, readable */
font-family: 'Inter', system-ui, sans-serif;
font-weight: 400;
line-height: 1.5;

/* UI elements - Sleek, modern */
font-family: 'Inter', system-ui, sans-serif;
font-weight: 500;
```

### Component Redesigns

#### Landing Page
**Current:** Basic centered layout with standard buttons
**Proposed:**
- Full-screen dark background with subtle noise texture
- Minimalist logo treatment with horror-inspired typography
- Smooth fade-in animations
- Floating glass-morphism cards for actions
- Subtle red glow effects on interactive elements

#### Authentication Flow
**Current:** Standard Google sign-in button
**Proposed:**
- Sleek dark modal with frosted glass effect
- Custom-styled authentication button with smooth hover states
- Minimal form fields with floating labels
- Smooth transitions between states

#### Home Dashboard
**Current:** Basic profile display with standard buttons
**Proposed:**
- Dark dashboard with cards using subtle shadows
- Profile section with elegant avatar treatment
- Status indicators using color-coded glows
- Action buttons with horror-themed iconography
- Smooth microinteractions on hover/tap

#### Room Creation/Join Modals
**Current:** Standard form modals
**Proposed:**
- Dark overlay with blur effect
- Sleek form design with floating labels
- Custom input styling with subtle borders
- Smooth slide-in animations
- Horror-themed illustrations/icons

#### Game Interface
**Current:** Basic map overlay
**Proposed:**
- Dark mode map with custom styling
- Sleek HUD elements with glass-morphism
- Smooth notification system (already implemented)
- Horror-themed skillcheck UI with animations
- Minimalist player status indicators

## Implementation Plan

### Phase 1: Design System Foundation
1. Update Tailwind config with custom color palette
2. Add custom CSS for glass-morphism effects
3. Import Inter font family
4. Create base animation utilities

### Phase 2: Core Components
1. Redesign landing page with new aesthetic
2. Update authentication flow styling
3. Rework home dashboard layout and styling
4. Redesign modal components

### Phase 3: Game Interface Polish
1. Apply dark theme to map interface
2. Enhance notification system styling
3. Update skillcheck UI with animations
4. Polish all interactive elements

### Phase 4: Microinteractions & Polish
1. Add smooth transitions throughout
2. Implement hover/focus states
3. Add subtle loading animations
4. Fine-tune spacing and typography

## Technical Considerations

### Tailwind Configuration
- Extend color palette with custom horror theme
- Add custom animation utilities
- Configure glass-morphism backdrop blur
- Set up custom font family

### CSS Variables
- Use CSS custom properties for theme consistency
- Enable smooth dark/light mode transitions (if needed)
- Maintain accessibility contrast ratios

### Performance
- Optimize animations for 60fps
- Use CSS transforms for smooth interactions
- Minimize layout shifts during transitions
- Implement prefers-reduced-motion support

## Inspiration References

### Splashin App Elements
- Clean, minimal interface design
- Subtle shadows and depth
- Smooth interactions and transitions
- Clear visual hierarchy

### Horror Game Aesthetics
- Dark color schemes with accent colors
- Subtle atmospheric effects
- Clean but dramatic typography
- Strategic use of color for tension

## Expected Outcomes
- Modern, trendy interface that stands out
- Improved user engagement through better aesthetics
- Enhanced game atmosphere and immersion
- Smooth, professional user experience
- Better brand identity and recognition

## Next Steps
Ready to begin implementation starting with Phase 1 foundation work, then systematically updating each component to match the new design system.