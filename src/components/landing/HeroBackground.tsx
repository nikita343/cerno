import styles from "@/app/landing.module.css";

/**
 * Full-bleed ambient backdrop for the hero — replaces the external Spline
 * scene. Purely decorative, self-contained (no scripts, no network), and
 * animated with CSS keyframes: a few large blurred brand-coloured orbs drift
 * slowly behind the hero. Reduced-motion viewers get the same layout, frozen.
 */
export function HeroBackground() {
  return (
    <div className={styles.heroBg} aria-hidden="true">
      <span className={styles.heroOrb1} />
      <span className={styles.heroOrb2} />
      <span className={styles.heroOrb3} />
      <span className={styles.heroOrb4} />
      <span className={styles.heroGrid} />
    </div>
  );
}

export default HeroBackground;
