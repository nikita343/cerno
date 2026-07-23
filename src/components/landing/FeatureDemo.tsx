import styles from "@/app/landing.module.css";

export type DemoVariant =
  | "capture"
  | "plan"
  | "inbox"
  | "drag"
  | "labels"
  | "reminders"
  | "teams";

export function FeatureDemo({ variant }: { variant: DemoVariant }) {
  return <div className={styles.demoBox}>{renderDemo(variant)}</div>;
}

function renderDemo(variant: DemoVariant) {
  switch (variant) {
    case "plan":
      return <PlanDemo />;
    case "inbox":
      return <InboxDemo />;
    case "drag":
      return <DragDemo />;
    case "labels":
      return <LabelsDemo />;
    case "reminders":
      return <RemindersDemo />;
    case "teams":
      return <TeamsDemo />;
    case "capture":
    default:
      return <CaptureDemo />;
  }
}

function CaptureDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoCaptureBar}>
          <div className={styles.demoDotRow}>
            <span className={styles.demoDot} />
            <span className={styles.demoDot} />
            <span className={styles.demoDot} />
          </div>
          <span className={styles.demoSpec}>brain dump</span>
          <span className={styles.demoBell} aria-hidden="true" />
        </div>
        <div className={styles.demoCaptureText}>
          <span data-f1-typed className={styles.demoTyped} />
          <span className={styles.demoCaret} aria-hidden="true" />
        </div>
        <div className={styles.demoMeta}>cerno structured 3 tasks</div>
        <div className={styles.demoTaskList}>
          <div className={styles.demoTaskRow} data-f1-task>
            <span className={`${styles.demoDot} ${styles.demoDotAmber}`} />
            <span className={styles.demoTaskTitle}>call the plumber</span>
            <span className={styles.demoTaskMeta}>20m</span>
          </div>
          <div className={styles.demoTaskRow} data-f1-task>
            <span className={`${styles.demoDot} ${styles.demoDotBlue}`} />
            <span className={styles.demoTaskTitle}>
              reply to the Karlsson brief
            </span>
            <span className={`${styles.demoTaskMeta} ${styles.demoTag}`}>
              due Thu
            </span>
          </div>
          <div className={styles.demoTaskRow} data-f1-task>
            <span className={`${styles.demoDot} ${styles.demoDotRose}`} />
            <span className={styles.demoTaskTitle}>book the dentist</span>
            <span className={styles.demoTaskMeta}>5m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoRowBetween}>
          <span className={styles.demoLabel}>today&apos;s capacity</span>
          <span className={styles.demoMuted}>8h working day</span>
        </div>
        <div className={styles.demoBarTrack}>
          <div className={styles.demoBarFill} data-f2-bar />
        </div>
        <div className={styles.demoTaskList}>
          <div className={styles.demoPlanRow}>
            <span className={`${styles.demoDot} ${styles.demoDotAccent}`} />
            <span className={styles.demoPlanLabel}>morning</span>
            <span className={styles.demoMuted}>3h 40m</span>
          </div>
          <div className={styles.demoPlanRow}>
            <span className={`${styles.demoDot} ${styles.demoDotAmber}`} />
            <span className={styles.demoPlanLabel}>afternoon</span>
            <span className={styles.demoMuted}>3h 00m</span>
          </div>
          <div className={styles.demoPlanRow}>
            <span className={`${styles.demoDot} ${styles.demoDotBlue}`} />
            <span className={styles.demoPlanLabel}>evening</span>
            <span className={styles.demoMuted}>1h 20m</span>
          </div>
        </div>
        <div className={styles.demoDeferred} data-f2-deferred>
          <span className={styles.demoArrow} aria-hidden="true" />
          <span className={styles.demoDeferredText}>
            4 tasks parked for tomorrow
          </span>
          <span className={styles.demoMuted}>over capacity</span>
        </div>
      </div>
    </div>
  );
}

function InboxDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <span className={styles.demoEyebrow}>inbox · not scheduled</span>
        <div className={styles.demoInboxItem}>
          <span className={styles.demoInboxCheckbox} />
          <span className={styles.demoInboxTitle} data-f3-title>
            text sister happy birthday
          </span>
          <span className={styles.demoInboxTag}>
            <span className={`${styles.demoDot} ${styles.demoDotPurple}`} />
            <span data-f3-label>comms</span>
          </span>
        </div>
        <div className={styles.demoReasonRow}>
          <span className={styles.demoReasonStem} />
          <span className={styles.demoReasonText} data-f3-typed />
        </div>
        <div className={styles.demoAddPill} data-f3-add>
          <span className={styles.demoPlus} aria-hidden="true" />
          add to today
        </div>
      </div>
    </div>
  );
}

function DragDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoDayGrid}>
          <div className={`${styles.demoDayCol} ${styles.demoDayColActive}`}>
            <span className={styles.demoDayLabel}>morning</span>
            <span className={styles.demoDayValue}>3 / 4</span>
          </div>
          <div className={styles.demoDayCol} data-f7-afternoon>
            <span className={styles.demoDayLabel}>afternoon</span>
            <span className={styles.demoDayValue}>1 / 4</span>
          </div>
          <div className={styles.demoDayCol}>
            <span className={styles.demoDayLabel}>evening</span>
            <span className={styles.demoDayValue}>2 / 4</span>
          </div>
        </div>
        <div className={styles.demoTaskCard} data-f7-card>
          <span className={`${styles.demoDot} ${styles.demoDotAmber}`} />
          <span className={styles.demoTaskTitle}>review the proposal</span>
          <span className={styles.demoTaskMeta}>45m</span>
        </div>
      </div>
    </div>
  );
}

function LabelsDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoInboxItem}>
          <span className={styles.demoInboxCheckbox} />
          <span className={styles.demoInboxTitle}>
            renew passport before it expires
          </span>
        </div>
        <div className={styles.demoLabelBlock}>
          <span className={styles.demoEyebrow}>auto-applied labels</span>
          <div className={styles.demoChipRow}>
            <span className={styles.demoChip} data-f4-chip>
              <span className={`${styles.demoDot} ${styles.demoDotBlue}`} />
              work
            </span>
            <span className={styles.demoChip} data-f4-chip>
              <span className={`${styles.demoDot} ${styles.demoDotAmber}`} />
              home
            </span>
            <span className={styles.demoChip} data-f4-chip>
              <span className={`${styles.demoDot} ${styles.demoDotGreen}`} />
              errand
            </span>
            <span className={styles.demoChip} data-f4-chip>
              <span className={`${styles.demoDot} ${styles.demoDotPurple}`} />
              comms
            </span>
            <span className={styles.demoChip} data-f4-chip>
              <span className={`${styles.demoDot} ${styles.demoDotRose}`} />
              health
            </span>
          </div>
        </div>
        <div className={styles.demoLabelBlock}>
          <span className={styles.demoEyebrow}>group by</span>
          <div className={styles.demoSegmentRow}>
            <div className={styles.demoUnderline} data-f4-underline />
            <span
              className={`${styles.demoSegment} ${styles.demoSegmentActive}`}
              data-f4-seg
            >
              priority
            </span>
            <span className={styles.demoSegment} data-f4-seg>
              deadline
            </span>
            <span className={styles.demoSegment} data-f4-seg>
              by label
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemindersDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoReminderHead}>
          <span className={styles.demoReminderIcon} aria-hidden="true" />
          <span className={styles.demoLabel}>reminders</span>
          <span className={styles.demoBadge} data-f5-badge>
            3
          </span>
        </div>
        <div className={styles.demoReminderRows} data-f5-rows>
          <div className={styles.demoReminderRow} data-f5-row>
            <span
              className={styles.demoReminderCheck}
              data-f5-check
              aria-hidden="true"
            />
            <div className={styles.demoReminderContent}>
              <div className={styles.demoReminderTitle} data-f5-title>
                water the wilting plants
              </div>
              <div className={styles.demoReminderMeta}>09:00 · 1h 55m late</div>
            </div>
          </div>
          <div className={styles.demoReminderRow} data-f5-row>
            <span
              className={styles.demoReminderCheck}
              data-f5-check
              aria-hidden="true"
            />
            <div className={styles.demoReminderContent}>
              <div className={styles.demoReminderTitle} data-f5-title>
                call internet provider about billing
              </div>
              <div className={styles.demoReminderMeta}>09:10 · 1h 45m late</div>
            </div>
          </div>
          <div className={styles.demoReminderRow} data-f5-row>
            <span
              className={styles.demoReminderCheck}
              data-f5-check
              aria-hidden="true"
            />
            <div className={styles.demoReminderContent}>
              <div className={styles.demoReminderTitle} data-f5-title>
                book dentist cleaning appointment
              </div>
              <div className={styles.demoReminderMeta}>09:25 · 1h 30m late</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamsDemo() {
  return (
    <div className={styles.demoPanel}>
      <div className={styles.demoShell}>
        <div className={styles.demoRowBetween}>
          <span className={styles.demoLabel}>Awake Agency</span>
          <span className={styles.demoMuted} data-f6-seats>
            2 / 10 seats
          </span>
        </div>
        <div className={styles.demoInboxItem}>
          <span className={styles.demoInboxCheckbox} />
          <span className={styles.demoInboxTitle}>
            <span data-f6-typed />
            <span className={styles.demoCaret} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.demoMention} data-f6-mention>
          <span
            className={`${styles.demoAvatar} ${styles.demoAvatarBlue}`}
            aria-hidden="true"
          >
            M
          </span>
          <span className={styles.demoMentionLabel}>Mara Kessler</span>
        </div>
        <div className={styles.demoInboxItem}>
          <span className={styles.demoInboxCheckbox} />
          <span className={styles.demoInboxTitle}>schedule kickoff call</span>
          <span className={styles.demoAvatar} data-f6-avatar aria-hidden="true">
            M
          </span>
        </div>
        <div className={styles.demoSeatStack}>
          <div className={styles.demoSeatRow}>
            <span className={`${styles.demoAvatar} ${styles.demoAvatarAccent}`}>
              A
            </span>
            <span className={`${styles.demoAvatar} ${styles.demoAvatarInk}`}>
              T
            </span>
            <span
              className={`${styles.demoAvatar} ${styles.demoAvatarBlue}`}
              data-f6-avatar
            >
              M
            </span>
          </div>
          <span className={styles.demoMuted}>everyone sees the shared day</span>
        </div>
      </div>
    </div>
  );
}

export default FeatureDemo;
