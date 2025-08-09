# Mobile UI Compaction – Outstanding Issue

Status: Open

We attempted several iterations to reduce vertical spacing and improve safe-area handling for iPhone (Dynamic Island/camera cutout), but the result on real hardware still appears too tall and the `GAME ACTIVE` header can crowd the top.

What has been tried (already merged):
- Added global safe-area padding: `padding-top: env(safe-area-inset-top)` on `body`
- Added page-level padding: `paddingTop: calc(env(safe-area-inset-top) + 8px)` on game page `<main>`
- Created mobile-only compaction utilities (font sizes, paddings, margins)
- Applied compact styling to game header, timer blocks, cards, and buttons
- Reworked Target Nearby overlay to non-blocking background prompt at bottom-right

Remaining problems observed on iPhone:
- Header still feels too close to the camera/Dynamic Island
- Overall stack still reads as too vertically spaced on small screens

Proposed next steps:
1. Add device-specific safe-area offsets (e.g., iPhone 15/16) via CSS env fallbacks or UA checks
2. Convert top header to a fixed bar with explicit height and shadow; push content with a CSS variable
3. Reduce heading/timer line-heights further and collapse section gaps to `mb-2` on `<640px`
4. Audit every `p-6`/`p-4` in the game page and map cards; endpoint goal ~p-2 on phones
5. Add an in-app toggle to switch between "Compact" and "Ultra Compact" to validate UX on-device

Acceptance criteria:
- No overlap with the Dynamic Island/camera at any time
- Above-the-fold shows header, timer, and role chip without scrolling
- Map section begins higher on the screen by ~60–100px vs current

Notes:
- Real-device testing is required; simulator may not reflect exact safe-area metrics
- Consider a CSS-only solution first; avoid per-device UA branches if possible
