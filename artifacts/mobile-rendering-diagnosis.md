# Mobile rendering diagnosis

Tested 20 October 2026 against https://gcci.live/zenith/ and the updated local development server. Tests used desktop Chrome with iPhone 13 viewport/touch emulation; this is not an actual iPhone Safari trace.

## Confirmed live issues

- React error #418 during startup, reproduced twice. The live homepage bundle generates globe hubs and arcs with Math.random() during render; its countdown also generates current time during initial render without hydration handling. Server HTML therefore differs from the first browser render. React documents error #418 as a hydration mismatch that causes the affected tree to be regenerated on the client.
- The globe repeatedly updates React state and redraws its SVG, including while scrolled to the footer. Its requestAnimationFrame loop checks document visibility but not viewport visibility or mobile/reduced-motion preferences. Canvas particles also keep a continuous animation loop.
- On the emulated mobile page, 31 CSS animations remain running at the footer. Computed styles show backdrop filters on 310 elements. Gallery marquees move long duplicated image rows with masks and blur effects.

## Live/local comparison

After hydration, scrolled both pages to the footer and measured approximately 2.2 seconds:

| Measurement | Live | Updated local |
| --- | ---: | ---: |
| requestAnimationFrame callbacks | 733 | 0 |
| SVG mutation records | 54,727 | 0 |
| Running CSS animations | 31 | 0 |
| Elements with backdrop filters | 310 | 0 |
| Page errors | React #418 | None |

Callback count includes separate animation loops; it is not a display frame rate. Mutation records are browser observer records, not necessarily distinct elements or painted pixels. They establish that the offscreen live globe continues doing work.

A separate live test with 4x CPU throttling, 100 ms network latency and about 1.6 Mbps download bandwidth received initial HTML at about 139 ms, displayed first content at about 1.52 s, and completed its initial load at about 6.44 s. Those are one-run laboratory timings, not real-user statistics. Large below-the-fold night posters are preloaded; the live site already lazy-loads most other images. The earlier 137-to-3 initial image comparison was between local builds and must not be represented as a live-site result.

## Interpretation

The startup hydration failure and continuous offscreen animation/compositing work are concrete defects. They strongly support a rendering bottleneck behind the blank areas in the recording. The exact iPhone/Safari painting failure is not reproduced or conclusively isolated by Chrome emulation. Verify on the affected phone after deploying the updated static build.

The updated local code uses deterministic globe geometry, countdown hydration handling, viewport/desktop-only decorative loops, static mobile gallery strips with horizontal scrolling, reduced mobile blur/masks, lazy images and a tap-to-play video poster. Existing build and rendering checks pass.

React error reference: https://react.dev/errors/418

## Final verification

Production build and TypeScript pass. All 13 rendering tests pass, including a countdown test that compares markup a week apart. All eight routes pass at five touch viewport sizes (320, 360, 390, 430, and landscape 844px): no expanded viewport, clipped menu, continuous CSS animation, backdrop filter, or JavaScript error. Gallery swiping and static content visibility were checked. Mobile decorative animation-frame callbacks remained zero at the footer.

## Carousel-only follow-up

At the user's request, visible image/logo carousels now animate on mobile. Their tracks use CSS transforms, measured loop distances and a slow speed of about 20 pixels per second. IntersectionObserver disables the animation offscreen and document visibility disables it in hidden tabs. Reduced-motion stays static and swipeable. The zero-animation result above describes the previous fully static-mobile version; the current version permits only visible mobile-carousel animations. Desktop behavior is preserved.
