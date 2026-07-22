'use client';

import { createElement, useEffect, useState } from 'react';

import styles from '@/app/landing.module.css';

const SPLINE_SCRIPT =
  'https://unpkg.com/@splinetool/viewer@1.12.98/build/spline-viewer.js';
const SPLINE_SCENE = 'https://prod.spline.design/r0LaK8jsP7Hf7-wt/scene.splinecode';

/**
 * The hero's ambient 3D backdrop, bleeding out behind the framed screenshot.
 *
 * The `<spline-viewer>` custom element comes from an external module script we
 * inject once on mount. It's purely decorative — `aria-hidden`, non-interactive
 * (`pointer-events: none` via the wrapper), and layered behind the screenshot —
 * so if the script or scene fails to load, the hero is unaffected.
 *
 * We deliberately defer mounting the viewer until after the hero's intro
 * animation has run. A Spline scene is a heavy WebGL init; letting it start
 * mid-intro would fight the GSAP timeline for the main thread. Mounting it a
 * beat later (and fading it in) keeps the entrance crisp.
 */
export function HeroSpline() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!document.querySelector('script[data-spline-viewer]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = SPLINE_SCRIPT;
      script.setAttribute('data-spline-viewer', '');
      document.head.appendChild(script);
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduce ? 0 : 1400;
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={styles.heroSpline}
      data-ready={ready || undefined}
      aria-hidden="true"
    >
      {ready &&
        createElement('spline-viewer', {
          url: SPLINE_SCENE,
          'loading-anim-type': 'none',
        })}
    </div>
  );
}

export default HeroSpline;
