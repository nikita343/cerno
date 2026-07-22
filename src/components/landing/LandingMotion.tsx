'use client';

import { useEffect } from 'react';

import styles from '@/app/landing.module.css';

export function LandingMotion() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = document.querySelector<HTMLElement>('[data-nav]');
    const hero = document.querySelector<HTMLElement>('[data-hero]');
    const heroCopy = document.querySelector<HTMLElement>('[data-hero-copy]');
    const heroMedia = document.querySelector<HTMLElement>('[data-hero-media]');
    const statement = document.querySelector<HTMLElement>('[data-statement-text]');
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    const applyVisible = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.add(styles.isVisible);
    };

    if (reducedMotion) {
      applyVisible(heroCopy);
      applyVisible(heroMedia);
      revealTargets.forEach((el) => applyVisible(el));

      if (statement) {
        const text = statement.textContent ?? '';
        statement.innerHTML = '';
        const parts = text.split(/(\s+)/);
        parts.forEach((part) => {
          if (!part.trim()) {
            statement.appendChild(document.createTextNode(part));
            return;
          }
          const span = document.createElement('span');
          span.className = styles.statementWord;
          span.classList.add(styles.isVisible);
          span.textContent = part;
          statement.appendChild(span);
        });
      }
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.isVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));

    if (heroCopy) {
      window.setTimeout(() => applyVisible(heroCopy), 120);
    }
    if (heroMedia) {
      window.setTimeout(() => applyVisible(heroMedia), 220);
    }

    if (statement && !statement.dataset.wordSplit) {
      const text = statement.textContent ?? '';
      statement.innerHTML = '';
      const parts = text.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part.trim()) {
          statement.appendChild(document.createTextNode(part));
          return;
        }

        const span = document.createElement('span');
        span.className = styles.statementWord;
        statement.appendChild(span);

        window.setTimeout(() => {
          span.classList.add(styles.isVisible);
        }, 50 + Math.random() * 260);
      });
      statement.dataset.wordSplit = 'true';
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (nav) {
        nav.classList.toggle(styles.navSolid, y > 28);
      }
      if (hero) {
        hero.style.setProperty('--hero-parallax', `${Math.min(24, Math.max(-24, y * -0.04))}px`);
      }

      document.querySelectorAll<HTMLElement>('[data-floating-dot]').forEach((dot, index) => {
        const offset = (index % 2 === 0 ? -1 : 1) * Math.min(24, y * 0.025);
        dot.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      revealObserver.disconnect();
    };
  }, []);

  return null;
}

export default LandingMotion;
