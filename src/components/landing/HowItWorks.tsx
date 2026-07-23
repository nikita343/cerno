"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";

import styles from "@/app/landing.module.css";

import dumpImg from "@/assets/addnewtaskwithai.png";
import planImg from "@/assets/upcoming.png";
import doImg from "@/assets/draganddrop.png";

const STEP_MS = 3800;

const STEPS: { title: string; body: string; image: StaticImageData }[] = [
  {
    title: "Dump it all",
    body: "Type or speak everything on your mind. One long, messy sentence is fine — no fields, no tags, no formatting.",
    image: dumpImg,
  },
  {
    title: "Cerno plans",
    body: "It splits the pile into tasks, estimates effort, weighs deadlines, and lays a realistic day on the clock.",
    image: planImg,
  },
  {
    title: "Do the day",
    body: "What fits is scheduled by time. What doesn't is parked for tomorrow — always with a reason you can read.",
    image: doImg,
  },
];

/**
 * The dark "three moves" band. The screenshot on the right cycles on a timer,
 * and the matching card lights up as it does; clicking a card jumps to it and
 * restarts the timer. Reduced-motion viewers get a static first step.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const interval = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (interval.current !== null) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }, []);

  const run = useCallback(() => {
    stop();
    interval.current = window.setInterval(
      () => setActive((a) => (a + 1) % STEPS.length),
      STEP_MS,
    );
  }, [stop]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    run();
    return stop;
  }, [run, stop]);

  const select = (i: number) => {
    setActive(i);
    if (interval.current !== null) run(); // only restart if the timer is live
  };

  return (
    <div className={styles.howInner}>
      <div className={styles.howLeft}>
        <h2 className={styles.howTitle} data-reveal>
          three moves.
          <br />
          one calm day.
        </h2>
        <div className={styles.howSteps}>
          {STEPS.map((step, i) => (
            <button
              type="button"
              key={step.title}
              className={styles.howStep}
              data-active={i === active || undefined}
              data-reveal
              onClick={() => select(i)}
              aria-pressed={i === active}
            >
              <h3 className={styles.howStepTitle}>{step.title}</h3>
              <p className={styles.howStepBody}>{step.body}</p>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.howMedia} data-reveal>
        <div className={styles.howFrame}>
          <div className={styles.howFrameBar}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.howShots}>
            {STEPS.map((step, i) => (
              <Image
                key={step.title}
                src={step.image}
                alt=""
                fill
                className={styles.howShot}
                data-active={i === active || undefined}
                sizes="(max-width: 860px) 100vw, 760px"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HowItWorks;
