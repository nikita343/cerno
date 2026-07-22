"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { DASHBOARD_ROOT } from "@/lib/nav";
import { MAX_WORKSPACE_MEMBERS } from "@/lib/types";

import styles from "./UpgradeCelebration.module.css";

/**
 * Shown once, when a Team upgrade is confirmed.
 *
 * Confirmed, not *attempted* — it fires off the webhook landing, not off the
 * redirect. Congratulating someone before the payment is recorded is how you
 * end up celebrating a checkout that later failed.
 *
 * The confetti is hand-drawn on a canvas rather than pulled from a library:
 * it's ~50 lines, runs once, and avoids adding a dependency to the bundle of
 * every route that imports Settings.
 */
export function UpgradeCelebration({ onClose }: { onClose: () => void }) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <Confetti />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t.celebration.close}
        >
          <CloseIcon size="1rem" />
        </button>

        <span className={styles.badge}>{t.celebration.team}</span>

        <h2 id="upgrade-title" className={styles.title}>
          {t.celebration.onTeam}
        </h2>

        <p className={styles.body}>
          {t.celebration.bodyPrefix} {MAX_WORKSPACE_MEMBERS - 1}{" "}
          {t.celebration.bodySuffix}
        </p>
        <p className={styles.small}>
          {t.celebration.small}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t.celebration.later}
          </button>
          <Link
            href={`${DASHBOARD_ROOT}/workspaces/new`}
            className={styles.primary}
            onClick={onClose}
          >
            {t.celebration.createWorkspace}
          </Link>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Colours drawn from the app's own palette, so this reads as Cerno. */
const CONFETTI_COLORS = ["#ff003d", "#f2a93b", "#3fb98a", "#5b8def", "#9b7bff"];
const PIECES = 90;
const DURATION_MS = 2600;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  width: number;
  height: number;
  color: string;
}

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Motion sensitivity is not a preference to override for a celebration.
    // The dialog still says the same thing without it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    // Backing store at device resolution, CSS box at layout size — otherwise
    // every piece is visibly soft on a retina screen.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: PIECES }, () => ({
      // Launched from two points near the top corners rather than one, which
      // reads as a burst rather than a leak from the middle of the screen.
      x: width * (Math.random() < 0.5 ? 0.2 : 0.8) + (Math.random() - 0.5) * 80,
      y: height * 0.28 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -7 - 3,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      width: 5 + Math.random() * 5,
      height: 8 + Math.random() * 6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      context.clearRect(0, 0, width, height);

      // Fades out over the last third rather than vanishing on a frame.
      const fade = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS * 0.66) / (DURATION_MS * 0.34));
      context.globalAlpha = fade;

      for (const piece of pieces) {
        piece.vy += 0.22; // gravity
        piece.vx *= 0.995; // drag
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }

      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        context.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // aria-hidden and pointer-events:none — it is decoration sitting over the
  // dialog, and it must never intercept a click meant for the button beneath.
  return <canvas ref={canvasRef} className={styles.confetti} aria-hidden="true" />;
}
