'use client';

import { useEffect } from 'react';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import styles from '@/app/landing.module.css';

/**
 * Landing-page motion, ported from the old GSAP + ScrollTrigger landing.
 *
 * The guiding rule is the old file's: content is visible by default in the CSS,
 * and GSAP hides-then-reveals it. If this script never runs (JS disabled, a
 * chunk fails to load, an error mid-init) the page simply stays fully visible —
 * it can never leave anything stuck invisible. A 2.6s safety net also forces
 * anything still hidden back to visible in case a trigger never fires.
 */
export function LandingMotion() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const q = <T extends Element = HTMLElement>(sel: string) =>
      Array.from(document.querySelectorAll<T>(sel));
    const one = <T extends Element = HTMLElement>(sel: string) =>
      document.querySelector<T>(sel);

    const triggers: ScrollTrigger[] = [];
    const loops: gsap.core.Animation[] = [];
    const timers: number[] = [];
    let alive = true;

    // Reduced motion: no animation at all. Content is already visible in the
    // CSS, so there is nothing to reveal. Populate the live-demo placeholders
    // with a static frame so nothing reads as empty.
    if (reduce) {
      const typed = one('[data-typed]');
      if (typed) typed.textContent = 'call the plumber about the leak…';
      const notif = one('[data-notif]');
      if (notif) gsap.set(notif, { opacity: 1 });
      return;
    }

    /**
     * Defensive reveal: hide the elements, then animate them in once when they
     * scroll into view. Because the hide happens here in JS, a failure earlier
     * than this leaves the elements visible rather than blank.
     */
    const appear = (
      els: Element | Element[] | NodeListOf<Element> | null,
      opts: { y?: number; trigger?: Element | null; start?: string; stagger?: number } = {},
    ) => {
      const arr = (
        els == null ? [] : els instanceof Element ? [els] : Array.from(els)
      ).filter(Boolean);
      if (!arr.length) return;
      const y = opts.y ?? 40;
      gsap.set(arr, { opacity: 0, y });
      const t = ScrollTrigger.create({
        trigger: opts.trigger ?? arr[0],
        start: opts.start ?? 'top 88%',
        once: true,
        onEnter: () =>
          gsap.to(arr, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: opts.stagger ?? 0,
          }),
      });
      triggers.push(t);
    };

    // ---- nav: solidify after leaving the hero ----------------------------
    const nav = one('[data-nav]');
    if (nav) {
      const navTrigger = ScrollTrigger.create({
        start: 'top top',
        end: 'max',
        onUpdate: (self) => nav.classList.toggle(styles.navSolid, self.scroll() > 60),
      });
      triggers.push(navTrigger);
      nav.classList.toggle(styles.navSolid, window.scrollY > 60);
    }

    // ---- hero intro ------------------------------------------------------
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.1 });
    const heroCopy = one('[data-hero-copy]');
    const heroMedia = one('[data-hero-media]');
    if (heroCopy) tl.from(heroCopy, { y: 26, opacity: 0, duration: 0.8 });
    if (heroMedia)
      tl.from(heroMedia, { y: 56, opacity: 0, scale: 0.96, duration: 1.0 }, '-=0.55');

    // ---- hero floating dots: gentle scrub parallax -----------------------
    q('[data-floating-dot]').forEach((dot, i) =>
      loops.push(
        gsap.to(dot, {
          y: i % 2 ? 120 : -100,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-hero]',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        }),
      ),
    );

    // ---- statement: word-by-word rise, preserving inline accent markup ---
    const statement = one('[data-statement-text]');
    if (statement && !statement.dataset.split) {
      statement.dataset.split = 'true';
      const nodes = Array.from(statement.childNodes);
      statement.innerHTML = '';
      const words: HTMLElement[] = [];
      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          (node.textContent ?? '').split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              statement.appendChild(document.createTextNode(part));
              return;
            }
            const s = document.createElement('span');
            s.className = styles.statementWord;
            s.textContent = part;
            statement.appendChild(s);
            words.push(s);
          });
        } else if (node instanceof HTMLElement) {
          // The accent span (`finish`) — keep it whole so it stays red.
          node.classList.add(styles.statementWord);
          statement.appendChild(node);
          words.push(node);
        } else {
          statement.appendChild(node);
        }
      });
      gsap.set(words, { opacity: 0, y: 14 });
      const stTrigger = ScrollTrigger.create({
        trigger: statement,
        start: 'top 78%',
        once: true,
        onEnter: () =>
          gsap.to(words, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.02,
          }),
      });
      triggers.push(stTrigger);
    }

    // ---- generic reveals (steps, feature copy/media, plans) --------------
    q('[data-reveal]').forEach((el) => appear(el, { y: 40, start: 'top 86%' }));

    // ---- feature media: subtle scrub parallax ----------------------------
    q('.' + styles.feature).forEach((feat) => {
      const media = feat.querySelector('[data-reveal]:last-child');
      if (media)
        loops.push(
          gsap.fromTo(
            media,
            { yPercent: 4 },
            {
              yPercent: -4,
              ease: 'none',
              scrollTrigger: {
                trigger: feat,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          ),
        );
    });

    // ---- live "watch it think" bento demos -------------------------------

    // pulsing planning / command dots
    const pulseDots = q('[data-think-dot], [data-cmd-dot]');
    if (pulseDots.length)
      loops.push(
        gsap.to(pulseDots, {
          scale: 1.5,
          opacity: 0.45,
          duration: 0.85,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        }),
      );

    // breathing status dots
    q('[data-breathe]').forEach((d, i) =>
      loops.push(
        gsap.to(d, {
          scale: 1.18,
          duration: 1.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.5,
        }),
      ),
    );

    // reprioritizing queue ticker — the top row advances, list re-settles
    const stream = one('[data-stream]');
    if (stream) {
      const advance = () => {
        if (!alive || !stream.isConnected) return;
        const first = stream.children[0] as HTMLElement | undefined;
        if (!first) return;
        const h = first.getBoundingClientRect().height + 12;
        loops.push(
          gsap.to(stream, {
            y: -h,
            duration: 0.65,
            ease: 'power2.inOut',
            delay: 2.1,
            onComplete: () => {
              if (!alive) return;
              gsap.set(stream, { y: 0 });
              stream.appendChild(first);
              advance();
            },
          }),
        );
      };
      advance();
    }

    // typewriter brain dump
    const typed = one('[data-typed]');
    if (typed) {
      const phrases = [
        'call the plumber about the leak…',
        'Karlsson brief due thursday, ~10 min',
        'dentist, dry cleaning, PR reviews',
        "mom's birthday gift + book flights",
      ];
      let pi = 0;
      let ci = 0;
      let deleting = false;
      const tick = () => {
        if (!alive || !typed.isConnected) return;
        const cur = phrases[pi];
        if (!deleting) {
          typed.textContent = cur.slice(0, ci + 1);
          ci++;
          if (ci === cur.length) {
            deleting = true;
            timers.push(window.setTimeout(tick, 1400));
            return;
          }
        } else {
          typed.textContent = cur.slice(0, ci - 1);
          ci--;
          if (ci === 0) {
            deleting = false;
            pi = (pi + 1) % phrases.length;
          }
        }
        timers.push(window.setTimeout(tick, deleting ? 28 : 46 + Math.random() * 55));
      };
      tick();
    }

    // caret blink
    const carets = q('[data-caret]');
    if (carets.length)
      loops.push(
        gsap.to(carets, {
          opacity: 0,
          duration: 0.5,
          ease: 'steps(1)',
          repeat: -1,
          yoyo: true,
        }),
      );

    // "plan ready" pop notification, recurring with overshoot
    const notif = one('[data-notif]');
    if (notif) {
      const cycle = () => {
        if (!alive || !notif.isConnected) return;
        const tl2 = gsap.timeline({
          onComplete: () => {
            if (alive) timers.push(window.setTimeout(cycle, 4200));
          },
        });
        tl2
          .fromTo(
            notif,
            { opacity: 0, y: -10, scale: 0.9 },
            { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.2)' },
          )
          .to(notif, { opacity: 0, y: -8, duration: 0.4, ease: 'power2.in', delay: 2.6 });
        loops.push(tl2);
      };
      timers.push(window.setTimeout(cycle, 1600));
    }

    // keep trigger positions honest as fonts/images settle
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    const refreshTmr = window.setTimeout(() => ScrollTrigger.refresh(), 500);

    // ---- safety net: force anything still hidden back to visible ---------
    const safetyTmr = window.setTimeout(() => {
      q('[data-reveal], [data-hero-copy], [data-hero-media]').forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05)
          gsap.set(el, { opacity: 1, y: 0, scale: 1 });
      });
      q('.' + styles.statementWord).forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05)
          gsap.set(el, { opacity: 1, y: 0 });
      });
      ScrollTrigger.refresh();
    }, 2600);

    ScrollTrigger.refresh();

    return () => {
      alive = false;
      window.removeEventListener('load', onLoad);
      window.clearTimeout(refreshTmr);
      window.clearTimeout(safetyTmr);
      timers.forEach((id) => window.clearTimeout(id));
      tl.kill();
      loops.forEach((t) => {
        const st = (t as gsap.core.Animation & { scrollTrigger?: ScrollTrigger }).scrollTrigger;
        st?.kill();
        t.kill();
      });
      triggers.forEach((t) => t && t.kill && t.kill());
    };
  }, []);

  return null;
}

export default LandingMotion;
