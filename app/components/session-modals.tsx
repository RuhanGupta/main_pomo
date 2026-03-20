"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type MealType = "breakfast" | "lunch" | "dinner";

type ModalShellProps = {
  open: boolean;
  kicker: string;
  title: string;
  children: ReactNode;
};

type AddTaskModalProps = {
  open: boolean;
  title: string;
  minutesInput: string;
  error: string;
  onTitleChange: (value: string) => void;
  onMinutesInputChange: (value: string) => void;
  onMinutesBlur: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

type ExtendFocusModalProps = {
  open: boolean;
  minutesInput: string;
  onMinutesInputChange: (value: string) => void;
  onMinutesBlur: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

type MealUsage = Record<MealType, boolean>;

type BreakDecisionModalProps = {
  open: boolean;
  kicker: string;
  title: string;
  description: string;
  shortBreakMinutesInput: string;
  maxShortBreakMinutes: number;
  selectedMeal: MealType | null;
  mealUsage: MealUsage;
  error: string;
  onShortBreakMinutesInputChange: (value: string) => void;
  onShortBreakMinutesBlur: () => void;
  onMealSelect: (meal: MealType | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmationLabel: string;
  extraContent?: ReactNode;
};

type CompletionModalProps = {
  open: boolean;
  taskName: string;
  onConfirm: () => void;
  onContinue: () => void;
};

type PostureReminderModalProps = {
  open: boolean;
  deskMode: "standing" | "sitting";
  onConfirm: () => void;
};

type ResetDayModalProps = {
  open: boolean;
  confirmationText: string;
  taskCount: number;
  completedCount: number;
  mealUsage: MealUsage;
  onConfirmationTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

type ReturnToSetupModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ModalShell({ open, kicker, title, children }: ModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => setMounted(false);
  }, []);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}

function MealSelector({
  selectedMeal,
  mealUsage,
  onMealSelect
}: {
  selectedMeal: MealType | null;
  mealUsage: MealUsage;
  onMealSelect: (meal: MealType | null) => void;
}) {
  return (
    <div className="modal-section">
      <p className="modal-section-label">Or claim a one-time 30-minute meal break</p>
      <div className="meal-grid">
        {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => {
          const used = mealUsage[meal];
          const active = selectedMeal === meal;

          return (
            <button
              key={meal}
              type="button"
              className={`meal-chip ${active ? "meal-chip-active" : ""}`}
              disabled={used}
              onClick={() => onMealSelect(active ? null : meal)}
            >
              <span>{meal}</span>
              <strong>{used ? "Used today" : "30 min"}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AddTaskModal({
  open,
  title,
  minutesInput,
  error,
  onTitleChange,
  onMinutesInputChange,
  onMinutesBlur,
  onCancel,
  onConfirm
}: AddTaskModalProps) {
  return (
    <ModalShell open={open} kicker="Focus session" title="Add a new task block">
      <div className="modal-grid">
        <label>
          <span>Task name</span>
          <input
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Name the task you want to complete"
          />
        </label>

        <label>
          <span>Minutes to allocate</span>
          <input
            type="number"
            min={1}
            value={minutesInput}
            onChange={(event) => onMinutesInputChange(event.target.value)}
            onBlur={onMinutesBlur}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            Add focus session
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function ExtendFocusModal({
  open,
  minutesInput,
  onMinutesInputChange,
  onMinutesBlur,
  onCancel,
  onConfirm
}: ExtendFocusModalProps) {
  return (
    <ModalShell open={open} kicker="Focus extension" title="Extend the current focus block">
      <div className="modal-grid">
        <p className="modal-copy">
          Confirm the extension and choose how much longer this task needs. The rest of your schedule will shift automatically.
        </p>

        <label>
          <span>Additional minutes</span>
          <input
            type="number"
            min={1}
            max={180}
            value={minutesInput}
            onChange={(event) => onMinutesInputChange(event.target.value)}
            onBlur={onMinutesBlur}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            Confirm focus extension
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onCancel}>
            Keep current timing
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function BreakDecisionModal({
  open,
  kicker,
  title,
  description,
  shortBreakMinutesInput,
  maxShortBreakMinutes,
  selectedMeal,
  mealUsage,
  error,
  onShortBreakMinutesInputChange,
  onShortBreakMinutesBlur,
  onMealSelect,
  onCancel,
  onConfirm,
  confirmationLabel,
  extraContent
}: BreakDecisionModalProps) {
  return (
    <ModalShell open={open} kicker={kicker} title={title}>
      <div className="modal-grid">
        <p className="modal-copy">{description}</p>

        {extraContent}

        <div className="modal-section">
          <p className="modal-section-label">Short break option</p>
          <label>
            <span>Minutes requested</span>
            <input
              type="number"
              min={1}
              max={Math.max(maxShortBreakMinutes, 1)}
              value={shortBreakMinutesInput}
              onChange={(event) => {
                onMealSelect(null);
                onShortBreakMinutesInputChange(event.target.value);
              }}
              onBlur={onShortBreakMinutesBlur}
              disabled={maxShortBreakMinutes === 0}
            />
          </label>
          <p className="info-note">
            Standard breaks cannot exceed 20 minutes total.
            {maxShortBreakMinutes > 0 ? ` You can add up to ${maxShortBreakMinutes} more minute${maxShortBreakMinutes === 1 ? "" : "s"} right now.` : " This break is already at the 20-minute cap."}
          </p>
        </div>

        <MealSelector selectedMeal={selectedMeal} mealUsage={mealUsage} onMealSelect={onMealSelect} />

        {error ? <p className="error-text">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            {confirmationLabel}
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function CompletionModal({ open, taskName, onConfirm, onContinue }: CompletionModalProps) {
  return (
    <ModalShell open={open} kicker="Task complete" title="Great job. Are you proud of yourself?">
      <div className="modal-grid">
        <p className="modal-copy">
          <strong>{taskName}</strong> is ready to be marked complete. Confirm it and your schedule sheet will update immediately.
        </p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            Update schedule and continue
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onContinue}>
            Give me 5 more minutes
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function PostureReminderModal({ open, deskMode, onConfirm }: PostureReminderModalProps) {
  return (
    <ModalShell open={open} kicker="Posture reset" title="Time to switch the desk and realign.">
      <p className="motivation-callout">
        Move the desk into {deskMode} mode, set your screen back at eye level, and let your shoulders and jaw relax before you continue.
      </p>
      <div className="posture-checklist">
        <p>Quick checklist:</p>
        <ul>
          <li>{deskMode === "standing" ? "Raise the desk and unlock your knees." : "Lower the desk and settle your hips back into the chair."}</li>
          <li>Stack ears over shoulders and shoulders over hips.</li>
          <li>Relax your grip, soften your shoulders, and lengthen through the spine.</li>
          <li>Plant both feet evenly and return with a calm breath.</li>
        </ul>
      </div>
      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={onConfirm}>
          I adjusted my posture
        </button>
      </div>
    </ModalShell>
  );
}

export function ResetDayModal({
  open,
  confirmationText,
  taskCount,
  completedCount,
  mealUsage,
  onConfirmationTextChange,
  onCancel,
  onConfirm
}: ResetDayModalProps) {
  const usedMeals = Object.entries(mealUsage)
    .filter(([, used]) => used)
    .map(([meal]) => meal);

  return (
    <ModalShell open={open} kicker="Reset day" title="Download your report and clear the day">
      <div className="modal-grid">
        <p className="modal-copy">
          This will export a PDF summary, clear every focus block, remove all meals, and reset the planner back to zero.
        </p>

        <div className="report-preview">
          <p>Report snapshot</p>
          <span>{taskCount} planned tasks</span>
          <span>{completedCount} completed tasks</span>
          <span>{usedMeals.length > 0 ? `Meals used: ${usedMeals.join(", ")}` : "Meals used: none"}</span>
        </div>

        <label>
          <span>Type `Confirmation` to continue</span>
          <input
            type="text"
            value={confirmationText}
            onChange={(event) => onConfirmationTextChange(event.target.value)}
            placeholder="Confirmation"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm} disabled={confirmationText !== "Confirmation"}>
            Download PDF and reset day
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onCancel}>
            Keep today as is
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function ReturnToSetupModal({ open, onCancel, onConfirm }: ReturnToSetupModalProps) {
  return (
    <ModalShell open={open} kicker="Switch view" title="Go back to task setting mode?">
      <div className="modal-grid">
        <p className="modal-copy">
          The timer will stay paused while you switch back. You can review the full schedule, edit the day, and then return to the main timer whenever you want.
        </p>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            Yes, go to task setting
          </button>
          <button type="button" className="ghost-button strong-ghost" onClick={onCancel}>
            Stay in main mode
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
