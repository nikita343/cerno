"use client";

import { useEffect } from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import styles from "@/app/landing.module.css";

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
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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
      const typed = one("[data-typed]");
      if (typed) typed.textContent = "call the plumber about the leak…";
      const notif = one("[data-notif]");
      if (notif) gsap.set(notif, { opacity: 1 });
      const featureTyped = one(
        "[data-f1-typed], [data-f3-typed], [data-f6-typed]",
      );
      if (featureTyped)
        featureTyped.textContent = "call the plumber about the leak…";
      q(
        "[data-f1-task], [data-f2-deferred], [data-f3-add], [data-f6-avatar], [data-f7-card]",
      ).forEach((el) => {
        if (el instanceof HTMLElement) gsap.set(el, { opacity: 1 });
      });
      return;
    }

    /**
     * Defensive reveal: hide the elements, then animate them in once when they
     * scroll into view. Because the hide happens here in JS, a failure earlier
     * than this leaves the elements visible rather than blank.
     */
    const appear = (
      els: Element | Element[] | NodeListOf<Element> | null,
      opts: {
        y?: number;
        trigger?: Element | null;
        start?: string;
        stagger?: number;
      } = {},
    ) => {
      const arr = (
        els == null ? [] : els instanceof Element ? [els] : Array.from(els)
      ).filter(Boolean);
      if (!arr.length) return;
      const y = opts.y ?? 40;
      gsap.set(arr, { opacity: 0, y });
      const t = ScrollTrigger.create({
        trigger: opts.trigger ?? arr[0],
        start: opts.start ?? "top 88%",
        once: true,
        onEnter: () =>
          gsap.to(arr, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: opts.stagger ?? 0,
          }),
      });
      triggers.push(t);
    };

    // ---- nav: solidify after leaving the hero ----------------------------
    const nav = one("[data-nav]");
    if (nav) {
      const navTrigger = ScrollTrigger.create({
        start: "top top",
        end: "max",
        onUpdate: (self) =>
          nav.classList.toggle(styles.navSolid, self.scroll() > 60),
      });
      triggers.push(navTrigger);
      nav.classList.toggle(styles.navSolid, window.scrollY > 60);
    }

    // ---- hero intro ------------------------------------------------------
    const tl = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.1 });
    const heroCopy = one("[data-hero-copy]");
    const heroMedia = one("[data-hero-media]");
    if (heroCopy) tl.from(heroCopy, { y: 26, opacity: 0, duration: 0.8 });
    if (heroMedia)
      tl.from(
        heroMedia,
        { y: 56, opacity: 0, scale: 0.96, duration: 1.0 },
        "-=0.55",
      );

    // ---- hero floating dots: gentle scrub parallax -----------------------
    q("[data-floating-dot]").forEach((dot, i) =>
      loops.push(
        gsap.to(dot, {
          y: i % 2 ? 120 : -100,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        }),
      ),
    );

    // ---- statement: word-by-word rise, preserving inline accent markup ---
    const statement = one("[data-statement-text]");
    if (statement && !statement.dataset.split) {
      statement.dataset.split = "true";
      const nodes = Array.from(statement.childNodes);
      statement.innerHTML = "";
      const words: HTMLElement[] = [];
      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          (node.textContent ?? "").split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              statement.appendChild(document.createTextNode(part));
              return;
            }
            const s = document.createElement("span");
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
      // Each word starts dimmed (30%) and fills to full as it scrolls in —
      // opacity preserves the accent word's red rather than recolouring it.
      gsap.set(words, { opacity: 0.3 });
      const stTrigger = ScrollTrigger.create({
        trigger: statement,
        start: "top 78%",
        once: true,
        onEnter: () =>
          gsap.to(words, {
            opacity: 1,
            duration: 0.4,
            ease: "power1.out",
            stagger: 0.045,
          }),
      });
      triggers.push(stTrigger);
    }

    // ---- generic reveals (steps, feature copy/media, plans) --------------
    q("[data-reveal]").forEach((el) => appear(el, { y: 40, start: "top 86%" }));

    // ---- "how it works" bottom line: draw across on enter ----------------
    const howLine = one("[data-how-line]");
    if (howLine) {
      gsap.set(howLine, { scaleX: 0 });
      const t = ScrollTrigger.create({
        trigger: howLine,
        start: "top 92%",
        once: true,
        onEnter: () =>
          gsap.to(howLine, { scaleX: 1, duration: 1.1, ease: "power3.out" }),
      });
      triggers.push(t);
    }

    // ---- feature media: subtle scrub parallax ----------------------------
    q("." + styles.feature).forEach((feat) => {
      const media = feat.querySelector("[data-reveal]:last-child");
      if (media)
        loops.push(
          gsap.fromTo(
            media,
            { yPercent: 4 },
            {
              yPercent: -4,
              ease: "none",
              scrollTrigger: {
                trigger: feat,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          ),
        );
    });

    // ---- live "watch it think" bento demos -------------------------------

    // pulsing planning / command dots
    const pulseDots = q("[data-think-dot], [data-cmd-dot]");
    if (pulseDots.length)
      loops.push(
        gsap.to(pulseDots, {
          scale: 1.5,
          opacity: 0.45,
          duration: 0.85,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        }),
      );

    // breathing status dots
    q("[data-breathe]").forEach((d, i) =>
      loops.push(
        gsap.to(d, {
          scale: 1.18,
          duration: 1.4,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * 0.5,
        }),
      ),
    );

    // reprioritizing queue ticker — the top row advances, list re-settles
    const stream = one("[data-stream]");
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
            ease: "power2.inOut",
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
    const typed = one("[data-typed]");
    if (typed) {
      const phrases = [
        "call the plumber about the leak…",
        "Karlsson brief due thursday, ~10 min",
        "dentist, dry cleaning, PR reviews",
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
        timers.push(
          window.setTimeout(tick, deleting ? 28 : 46 + Math.random() * 55),
        );
      };
      tick();
    }

    // caret blink
    const carets = q("[data-caret]");
    if (carets.length)
      loops.push(
        gsap.to(carets, {
          opacity: 0,
          duration: 0.5,
          ease: "steps(1)",
          repeat: -1,
          yoyo: true,
        }),
      );

    // "plan ready" pop notification, recurring with overshoot
    const notif = one("[data-notif]");
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
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.5,
              ease: "back.out(2.2)",
            },
          )
          .to(notif, {
            opacity: 0,
            y: -8,
            duration: 0.4,
            ease: "power2.in",
            delay: 2.6,
          });
        loops.push(tl2);
      };
      timers.push(window.setTimeout(cycle, 1600));
    }

    // feature demos: each panel is bespoke and loops independently
    const featureDemoBlocks = [
      () => {
        const nodes = q("[data-f1-typed]") as HTMLElement[];
        const tasks = q("[data-f1-task]") as HTMLElement[];
        if (!nodes.length || !tasks.length) return;
        const phrases = [
          "call the plumber about the leak…",
          "Karlsson brief due thursday, ~10 min",
          "dentist cleanup, dry cleaning, PR reviews",
        ];
        let index = 0;
        let char = 0;
        let deleting = false;
        const type = () => {
          if (!alive) return;
          const current = phrases[index];
          const target = nodes[0];
          if (!target || !target.isConnected) return;
          if (!deleting) {
            target.textContent = current.slice(0, char + 1);
            char += 1;
            if (char === current.length) {
              deleting = true;
              timers.push(window.setTimeout(type, 1300));
              return;
            }
          } else {
            target.textContent = current.slice(0, char - 1);
            char -= 1;
            if (char === 0) {
              deleting = false;
              index = (index + 1) % phrases.length;
            }
          }
          timers.push(
            window.setTimeout(type, deleting ? 28 : 42 + Math.random() * 45),
          );
        };
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
        tl.fromTo(
          tasks,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out",
            stagger: 0.12,
          },
        )
          .to(tasks, {
            opacity: 0,
            y: -4,
            duration: 0.24,
            ease: "power2.in",
            stagger: 0.08,
            delay: 1.7,
          })
          .set(tasks, { opacity: 0, y: 8 });
        loops.push(tl);
        timers.push(window.setTimeout(type, 300));
      },
      () => {
        const bar = one("[data-f2-bar]") as HTMLElement | null;
        const deferred = one("[data-f2-deferred]") as HTMLElement | null;
        if (!bar || !deferred) return;
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(bar, { width: "108%", duration: 1.1, ease: "power2.inOut" })
          .to(
            deferred,
            { opacity: 1, duration: 0.3, ease: "power2.out" },
            "-=0.25",
          )
          .to(
            deferred,
            { opacity: 0, duration: 0.3, ease: "power2.in" },
            "+=0.9",
          );
        loops.push(tl);
      },
      () => {
        const typed = one("[data-f3-typed]") as HTMLElement | null;
        const add = one("[data-f3-add]") as HTMLElement | null;
        if (!typed || !add) return;
        const phrases = [
          "the task is small, but the timing is weird.",
          "it needs a human nudge before it can fit.",
          "it would get in the way of the anchor block.",
        ];
        let index = 0;
        let char = 0;
        let deleting = false;
        const tick = () => {
          if (!alive || !typed.isConnected) return;
          const current = phrases[index];
          if (!deleting) {
            typed.textContent = current.slice(0, char + 1);
            char += 1;
            if (char === current.length) {
              deleting = true;
              timers.push(window.setTimeout(tick, 1400));
              return;
            }
          } else {
            typed.textContent = current.slice(0, char - 1);
            char -= 1;
            if (char === 0) {
              deleting = false;
              index = (index + 1) % phrases.length;
            }
          }
          timers.push(
            window.setTimeout(tick, deleting ? 24 : 36 + Math.random() * 35),
          );
        };
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
        tl.fromTo(
          add,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.6)" },
        ).to(
          add,
          { opacity: 0, y: -6, duration: 0.25, ease: "power2.in" },
          "+=1.6",
        );
        loops.push(tl);
        timers.push(window.setTimeout(tick, 400));
      },
      () => {
        const chips = q("[data-f4-chip]") as HTMLElement[];
        const underline = one("[data-f4-underline]") as HTMLElement | null;
        const segs = q("[data-f4-seg]") as HTMLElement[];
        if (!chips.length || !underline || !segs.length) return;

        // Highlight one chip at a time, cycling through them.
        let ci = 0;
        const chipStep = () => {
          if (!alive) return;
          chips.forEach((c, j) => {
            const on = j === ci % chips.length;
            gsap.to(c, {
              duration: 0.35,
              ease: "power2.out",
              backgroundColor: on ? "rgba(230,0,55,0.07)" : "#ffffff",
              borderColor: on ? "rgba(230,0,55,0.45)" : "#ecece8",
              color: on ? "#0a0a0b" : "#6e6e75",
              scale: on ? 1.04 : 1,
            });
          });
          ci += 1;
          timers.push(window.setTimeout(chipStep, 1150));
        };
        chipStep();

        // Slide the segmented-control pill to the active segment, reading its
        // real geometry each step so it always lines up (flex widths differ).
        let si = 0;
        const segStep = () => {
          if (!alive) return;
          const s = segs[si % segs.length];
          gsap.to(underline, {
            left: s.offsetLeft,
            width: s.offsetWidth,
            duration: 0.45,
            ease: "power3.out",
          });
          segs.forEach((se, j) =>
            gsap.to(se, {
              color: j === si % segs.length ? "#0a0a0b" : "#9b9ba1",
              duration: 0.3,
            }),
          );
          si += 1;
          timers.push(window.setTimeout(segStep, 1550));
        };
        segStep();
      },
      () => {
        const wrap = one("[data-f5-rows]") as HTMLElement | null;
        const badge = one("[data-f5-badge]") as HTMLElement | null;
        if (!wrap) return;
        const total = wrap.children.length;
        if (!total) return;
        let pending = total;
        if (badge) badge.textContent = String(pending);
        const advance = () => {
          if (!alive || !wrap.isConnected) return;
          const first = wrap.children[0] as HTMLElement | undefined;
          if (!first) {
            timers.push(window.setTimeout(advance, 1500));
            return;
          }
          const check = first.querySelector<HTMLElement>("[data-f5-check]");
          const title = first.querySelector<HTMLElement>("[data-f5-title]");
          const tl = gsap.timeline();
          tl.to(check, {
            color: "#1e9e6e",
            scale: 1.18,
            duration: 0.28,
            ease: "back.out(2.5)",
          })
            .add(() => {
              if (title) {
                title.style.textDecoration = "line-through";
                title.style.color = "#9b9ba1";
              }
              pending = pending > 1 ? pending - 1 : total;
              if (badge) badge.textContent = String(pending);
            })
            .to({}, { duration: 0.7 })
            .add(() => {
              const gap = 0.55 * 16; // .demoReminderRow + margin-top: 0.55rem
              const h = first.getBoundingClientRect().height + gap;
              gsap.to(wrap, {
                y: -h,
                duration: 0.55,
                ease: "power2.inOut",
                onComplete: () => {
                  if (!alive) return;
                  gsap.set(wrap, { y: 0 });
                  if (check) {
                    check.style.color = "";
                    gsap.set(check, { scale: 1 });
                  }
                  if (title) {
                    title.style.textDecoration = "none";
                    title.style.color = "#0a0a0b";
                  }
                  wrap.appendChild(first);
                  timers.push(window.setTimeout(advance, 1500));
                },
              });
            });
          loops.push(tl);
        };
        timers.push(window.setTimeout(advance, 1400));
      },
      () => {
        const typed = one("[data-f6-typed]") as HTMLElement | null;
        const mention = one("[data-f6-mention]") as HTMLElement | null;
        const avatars = q("[data-f6-avatar]") as HTMLElement[];
        const seats = one("[data-f6-seats]") as HTMLElement | null;
        if (!typed || !mention || !avatars.length || !seats) return;
        const phrase = "schedule kickoff call @ma";
        const run = () => {
          if (!alive) return;
          gsap.set(mention, { opacity: 0, y: 6, scale: 0.9 });
          gsap.set(avatars, { opacity: 0, y: 6, scale: 0.85 });
          seats.textContent = "2 / 10 seats";
          typed.textContent = "";
          let char = 0;
          const type = () => {
            if (!alive || !typed.isConnected) return;
            typed.textContent = phrase.slice(0, char + 1);
            char += 1;
            if (char >= phrase.length) {
              const tl = gsap.timeline();
              tl.to(mention, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.35,
                ease: "back.out(2)",
              })
                .to(mention, { opacity: 0, y: -4, duration: 0.3 }, "+=1.0")
                .to(
                  avatars,
                  {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.45,
                    stagger: 0.1,
                    ease: "back.out(2)",
                  },
                  "<",
                )
                .add(() => {
                  seats.textContent = "3 / 10 seats";
                }, "<")
                .add(() => {
                  timers.push(window.setTimeout(run, 2500));
                });
              loops.push(tl);
              return;
            }
            timers.push(window.setTimeout(type, 42 + Math.random() * 30));
          };
          type();
        };
        run();
      },
      () => {
        const card = one("[data-f7-card]") as HTMLElement | null;
        const afternoon = one("[data-f7-afternoon]") as HTMLElement | null;
        if (!card || !afternoon) return;
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
        tl.to(card, {
          y: -20,
          scale: 1.03,
          boxShadow: "0 22px 40px -24px rgba(10, 10, 11, 0.28)",
          duration: 0.45,
          ease: "back.out(1.6)",
        })
          .to(
            afternoon,
            { backgroundColor: "#fff8eb", duration: 0.25, ease: "power2.out" },
            "<",
          )
          .to(
            card,
            {
              x: 94,
              y: -10,
              scale: 0.98,
              duration: 0.75,
              ease: "power2.inOut",
            },
            "+=0.1",
          )
          .to(card, {
            x: 0,
            y: 0,
            scale: 1,
            boxShadow: "0 10px 18px -14px rgba(10,10,11,0.2)",
            duration: 0.45,
            ease: "back.out(1.2)",
          })
          .to(
            afternoon,
            { backgroundColor: "#ffffff", duration: 0.25, ease: "power2.out" },
            "<",
          );
        loops.push(tl);
      },
    ];

    featureDemoBlocks.forEach((block) => block());

    // keep trigger positions honest as fonts/images settle
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    const refreshTmr = window.setTimeout(() => ScrollTrigger.refresh(), 500);

    // ---- safety net: force anything still hidden back to visible ---------
    const safetyTmr = window.setTimeout(() => {
      q("[data-reveal], [data-hero-copy], [data-hero-media]").forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05)
          gsap.set(el, { opacity: 1, y: 0, scale: 1 });
      });
      q(
        "[data-f1-task], [data-f2-deferred], [data-f3-add], [data-f6-avatar], [data-f7-card]",
      ).forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05)
          gsap.set(el, { opacity: 1, y: 0, scale: 1 });
      });
      q("." + styles.statementWord).forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05)
          gsap.set(el, { opacity: 1, y: 0 });
      });
      ScrollTrigger.refresh();
    }, 2600);

    ScrollTrigger.refresh();

    return () => {
      alive = false;
      window.removeEventListener("load", onLoad);
      window.clearTimeout(refreshTmr);
      window.clearTimeout(safetyTmr);
      timers.forEach((id) => window.clearTimeout(id));
      tl.kill();
      loops.forEach((t) => {
        const st = (
          t as gsap.core.Animation & { scrollTrigger?: ScrollTrigger }
        ).scrollTrigger;
        st?.kill();
        t.kill();
      });
      triggers.forEach((t) => t && t.kill && t.kill());
    };
  }, []);

  return null;
}

export default LandingMotion;
