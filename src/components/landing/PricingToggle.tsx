"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { HoverButton } from "@/components/landing/HoverButton";
import styles from "@/app/landing.module.css";

const PRICES = {
  month: { amount: 8, period: "/ month" },
  year: { amount: 80, period: "/ year" },
} as const;

export function TeamPlanCard() {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const amountText = useRef<HTMLSpanElement | null>(null);
  const amountValue = useRef({ val: PRICES.year.amount });

  useEffect(() => {
    const target = PRICES[interval].amount;
    gsap.to(amountValue.current, {
      val: target,
      duration: 0.9,
      ease: "power3.out",
      onUpdate() {
        if (!amountText.current) return;
        amountText.current.textContent = `$${Math.round(amountValue.current.val)}`;
      },
    });
  }, [interval]);

  return (
    <div className={styles.plan} data-featured data-reveal>
      <div className={styles.planHead}>
        <span className={styles.planName}>Team</span>
        <span className={styles.planTag}>up to 10 people</span>
      </div>

      <div
        className={styles.priceToggle}
        role="group"
        aria-label="Billing interval"
      >
        <button
          type="button"
          className={
            interval === "month"
              ? styles.priceToggleButtonSelected
              : styles.priceToggleButton
          }
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
        >
          monthly
        </button>
        <button
          type="button"
          className={
            interval === "year"
              ? styles.priceToggleButtonSelected
              : styles.priceToggleButton
          }
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
        >
          yearly
        </button>
      </div>

      <div className={styles.planPrice}>
        <span ref={amountText} className={styles.planAmount}>
          ${PRICES.year.amount}
        </span>
        <span className={styles.planPer}>{PRICES[interval].period}</span>
      </div>

      <p className={styles.planPlus}>Everything in Free, plus</p>
      <ul className={styles.planPoints} data-accent>
        <li>Shared workspaces, up to 10 people</li>
        <li>Assign tasks to teammates</li>
        <li>You pay; the people you invite don’t</li>
      </ul>
      <HoverButton href="/signup" className={styles.planCtaPrimary} arrow>
        Get started
      </HoverButton>
    </div>
  );
}
