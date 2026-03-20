"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AddTaskModal,
  BreakDecisionModal,
  CompletionModal,
  ExtendFocusModal,
  PostureReminderModal,
  ResetDayModal,
  ReturnToSetupModal
} from "./components/session-modals";

type TaskStatus = "pending" | "done";
type MealType = "breakfast" | "lunch" | "dinner";
type DeskMode = "standing" | "sitting";
type Mode = "planning" | "focus" | "scheduledBreak" | "intermittentBreak" | "mealBreak" | "complete";
type ViewMode = "setup" | "main";
type ScheduleItemKind = "focus" | "break" | "meal";

type Task = {
  id: string;
  title: string;
  plannedMinutes: number;
  status: TaskStatus;
};

type ScheduleItem = {
  label: string;
  kind: ScheduleItemKind;
  start: Date;
  end: Date;
};

type MealUsage = Record<MealType, boolean>;

const MAX_BREAK_MINUTES = 10;
const MEAL_BREAK_MINUTES = 30;
const POSTURE_REMINDER_SECONDS = 45 * 60;
const STORAGE_KEY = "momentum-pomodoro-state-v1";
const MOTIVATIONAL_MESSAGES = [
  "Future-you is built by the choice you make in the next few minutes.",
  "You do not need perfect energy to protect meaningful progress.",
  "Stay with the work just long enough for resistance to soften.",
  "Momentum grows when you keep promises to yourself."
];

const INITIAL_MEAL_USAGE: MealUsage = {
  breakfast: false,
  lunch: false,
  dinner: false
};

type PersistedState = {
  tasks: Task[];
  breakMinutes: number;
  mode: Mode;
  viewMode: ViewMode;
  currentTaskIndex: number;
  remainingSeconds: number;
  currentPhaseAllocatedSeconds: number;
  resumeFocusSeconds: number | null;
  activeMealType: MealType | null;
  usedMeals: MealUsage;
  isRunning: boolean;
  elapsedActiveSeconds: number;
  posturePromptMode: DeskMode;
  nextDeskMode: DeskMode;
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTask(title: string, plannedMinutes: number): Task {
  return {
    id: createId(),
    title,
    plannedMinutes,
    status: "pending"
  };
}

function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isMode(value: unknown): value is Mode {
  return ["planning", "focus", "scheduledBreak", "intermittentBreak", "mealBreak", "complete"].includes(String(value));
}

function isViewMode(value: unknown): value is ViewMode {
  return value === "setup" || value === "main";
}

function isMealType(value: unknown): value is MealType {
  return value === "breakfast" || value === "lunch" || value === "dinner";
}

function isDeskMode(value: unknown): value is DeskMode {
  return value === "standing" || value === "sitting";
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [breakMinutes, setBreakMinutes] = useState(10);
  const [mode, setMode] = useState<Mode>("planning");
  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentPhaseAllocatedSeconds, setCurrentPhaseAllocatedSeconds] = useState(0);
  const [resumeFocusSeconds, setResumeFocusSeconds] = useState<number | null>(null);
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [usedMeals, setUsedMeals] = useState<MealUsage>(INITIAL_MEAL_USAGE);
  const [isRunning, setIsRunning] = useState(false);
  const [plannerError, setPlannerError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [elapsedActiveSeconds, setElapsedActiveSeconds] = useState(0);
  const [postureModalOpen, setPostureModalOpen] = useState(false);
  const [posturePromptMode, setPosturePromptMode] = useState<DeskMode>("standing");
  const [nextDeskMode, setNextDeskMode] = useState<DeskMode>("standing");
  const [resumeAfterPostureReminder, setResumeAfterPostureReminder] = useState(false);
  const [resumeAfterTransientModal, setResumeAfterTransientModal] = useState(false);

  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addTaskMinutes, setAddTaskMinutes] = useState(25);
  const [addTaskError, setAddTaskError] = useState("");

  const [focusExtendModalOpen, setFocusExtendModalOpen] = useState(false);
  const [focusExtendMinutes, setFocusExtendMinutes] = useState(10);

  const [intermittentModalOpen, setIntermittentModalOpen] = useState(false);
  const [intermittentReflection, setIntermittentReflection] = useState("");
  const [intermittentBreakMinutes, setIntermittentBreakMinutes] = useState(5);
  const [intermittentSelectedMeal, setIntermittentSelectedMeal] = useState<MealType | null>(null);
  const [intermittentError, setIntermittentError] = useState("");
  const [motivation, setMotivation] = useState(MOTIVATIONAL_MESSAGES[0]);

  const [breakExtendModalOpen, setBreakExtendModalOpen] = useState(false);
  const [breakExtendMinutes, setBreakExtendMinutes] = useState(1);
  const [breakExtendSelectedMeal, setBreakExtendSelectedMeal] = useState<MealType | null>(null);
  const [breakExtendError, setBreakExtendError] = useState("");

  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  const [resetDayModalOpen, setResetDayModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [returnToSetupModalOpen, setReturnToSetupModalOpen] = useState(false);

  const currentTask = tasks[currentTaskIndex] ?? null;
  const completedTaskCount = tasks.filter((task) => task.status === "done").length;
  const totalFocusMinutes = tasks.reduce((sum, task) => sum + task.plannedMinutes, 0);
  const scheduledBreakMinutes = Math.max(tasks.length - 1, 0) * breakMinutes;
  const usedMealCount = Object.values(usedMeals).filter(Boolean).length;
  const intermittentWordCount = countWords(intermittentReflection);
  const availableBreakExtensionMinutes = Math.max(0, MAX_BREAK_MINUTES - Math.round(currentPhaseAllocatedSeconds / 60));
  const postureSecondsIntoCycle = elapsedActiveSeconds % POSTURE_REMINDER_SECONDS;
  const postureSecondsUntilReminder =
    postureSecondsIntoCycle === 0 ? POSTURE_REMINDER_SECONDS : POSTURE_REMINDER_SECONDS - postureSecondsIntoCycle;
  const mainMotivationMessage = MOTIVATIONAL_MESSAGES[currentTaskIndex % MOTIVATIONAL_MESSAGES.length];

  useEffect(() => {
    setIsHydrated(true);

    try {
      const savedState = window.localStorage.getItem(STORAGE_KEY);

      if (!savedState) {
        setHasLoadedPersistedState(true);
        return;
      }

      const parsed = JSON.parse(savedState) as Partial<PersistedState>;

      if (Array.isArray(parsed.tasks)) {
        setTasks(
          parsed.tasks
            .filter(
              (task): task is Task =>
                typeof task?.id === "string" &&
                typeof task?.title === "string" &&
                typeof task?.plannedMinutes === "number" &&
                (task?.status === "pending" || task?.status === "done")
            )
            .map((task) => ({
              id: task.id,
              title: task.title,
              plannedMinutes: clampMinutes(task.plannedMinutes, 1, 240),
              status: task.status
            }))
        );
      }

      if (typeof parsed.breakMinutes === "number") {
        setBreakMinutes(clampMinutes(parsed.breakMinutes, 1, MAX_BREAK_MINUTES));
      }

      if (isMode(parsed.mode)) {
        setMode(parsed.mode);
      }

      if (isViewMode(parsed.viewMode)) {
        setViewMode(parsed.viewMode);
      }

      if (typeof parsed.currentTaskIndex === "number" && parsed.currentTaskIndex >= 0) {
        setCurrentTaskIndex(parsed.currentTaskIndex);
      }

      if (typeof parsed.remainingSeconds === "number" && parsed.remainingSeconds >= 0) {
        setRemainingSeconds(parsed.remainingSeconds);
      }

      if (typeof parsed.currentPhaseAllocatedSeconds === "number" && parsed.currentPhaseAllocatedSeconds >= 0) {
        setCurrentPhaseAllocatedSeconds(parsed.currentPhaseAllocatedSeconds);
      }

      if (parsed.resumeFocusSeconds === null || (typeof parsed.resumeFocusSeconds === "number" && parsed.resumeFocusSeconds >= 0)) {
        setResumeFocusSeconds(parsed.resumeFocusSeconds ?? null);
      }

      if (parsed.activeMealType === null || isMealType(parsed.activeMealType)) {
        setActiveMealType(parsed.activeMealType ?? null);
      }

      if (parsed.usedMeals) {
        setUsedMeals({
          breakfast: Boolean(parsed.usedMeals.breakfast),
          lunch: Boolean(parsed.usedMeals.lunch),
          dinner: Boolean(parsed.usedMeals.dinner)
        });
      }

      if (typeof parsed.isRunning === "boolean") {
        setIsRunning(parsed.isRunning);
      }

      if (typeof parsed.elapsedActiveSeconds === "number" && parsed.elapsedActiveSeconds >= 0) {
        setElapsedActiveSeconds(parsed.elapsedActiveSeconds);
      }

      if (isDeskMode(parsed.posturePromptMode)) {
        setPosturePromptMode(parsed.posturePromptMode);
      }

      if (isDeskMode(parsed.nextDeskMode)) {
        setNextDeskMode(parsed.nextDeskMode);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasLoadedPersistedState(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || !hasLoadedPersistedState) {
      return;
    }

    const persistedState: PersistedState = {
      tasks,
      breakMinutes,
      mode,
      viewMode,
      currentTaskIndex,
      remainingSeconds,
      currentPhaseAllocatedSeconds,
      resumeFocusSeconds,
      activeMealType,
      usedMeals,
      isRunning,
      elapsedActiveSeconds,
      posturePromptMode,
      nextDeskMode
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [
    activeMealType,
    breakMinutes,
    currentPhaseAllocatedSeconds,
    currentTaskIndex,
    elapsedActiveSeconds,
    hasLoadedPersistedState,
    isHydrated,
    isRunning,
    mode,
    nextDeskMode,
    posturePromptMode,
    remainingSeconds,
    resumeFocusSeconds,
    tasks,
    usedMeals,
    viewMode
  ]);

  useEffect(() => {
    if (mode === "planning" && viewMode === "main") {
      setViewMode("setup");
    }
  }, [mode, viewMode]);

  useEffect(() => {
    if (tasks.length === 0 && mode !== "planning") {
      setMode("planning");
      setViewMode("setup");
      setIsRunning(false);
      return;
    }

    if (tasks.length > 0 && currentTaskIndex >= tasks.length) {
      setCurrentTaskIndex(tasks.length - 1);
    }
  }, [currentTaskIndex, mode, tasks.length]);

  useEffect(() => {
    if (!isRunning || !["focus", "scheduledBreak", "intermittentBreak", "mealBreak"].includes(mode)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(previous - 1, 0));
      setElapsedActiveSeconds((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning, mode]);

  useEffect(() => {
    if (
      elapsedActiveSeconds === 0 ||
      elapsedActiveSeconds % POSTURE_REMINDER_SECONDS !== 0 ||
      mode === "planning" ||
      mode === "complete" ||
      postureModalOpen
    ) {
      return;
    }

    setPosturePromptMode(nextDeskMode);
    setNextDeskMode((previous) => (previous === "standing" ? "sitting" : "standing"));
    setResumeAfterPostureReminder(isRunning);
    setPostureModalOpen(true);
    setIsRunning(false);
  }, [elapsedActiveSeconds, isRunning, mode, nextDeskMode, postureModalOpen]);

  useEffect(() => {
    if (remainingSeconds !== 0) {
      return;
    }

    if (mode === "focus") {
      if (!completionModalOpen) {
        setIsRunning(false);
        setCompletionModalOpen(true);
      }
      return;
    }

    if (mode === "scheduledBreak") {
      advanceToNextFocusOrComplete();
      return;
    }

    if (mode === "intermittentBreak") {
      resumeFocusedTask();
      return;
    }

    if (mode === "mealBreak") {
      if (resumeFocusSeconds !== null) {
        resumeFocusedTask();
        return;
      }

      advanceToNextFocusOrComplete();
    }
  }, [completionModalOpen, mode, remainingSeconds, resumeFocusSeconds, tasks]);

  function resetTransientModalRecovery() {
    setResumeAfterTransientModal(false);
  }

  function pauseForTransientModal(openModal: () => void) {
    setResumeAfterTransientModal(isRunning);
    setIsRunning(false);
    openModal();
  }

  function resumeAfterTransientClose() {
    if (resumeAfterTransientModal) {
      setIsRunning(true);
    }

    resetTransientModalRecovery();
  }

  function openAddTaskModal() {
    setAddTaskTitle("");
    setAddTaskMinutes(25);
    setAddTaskError("");
    setAddTaskModalOpen(true);
  }

  function confirmAddTask() {
    if (addTaskTitle.trim().length === 0) {
      setAddTaskError("Add a task name before saving the focus session.");
      return;
    }

    const nextMinutes = clampMinutes(addTaskMinutes || 1, 1, 240);
    setTasks((existingTasks) => [...existingTasks, createTask(addTaskTitle.trim(), nextMinutes)]);
    setAddTaskModalOpen(false);
    setAddTaskError("");
    setAddTaskTitle("");
    setAddTaskMinutes(25);
  }

  function removeTask(taskId: string) {
    if (mode !== "planning") {
      return;
    }

    setTasks((existingTasks) => existingTasks.filter((task) => task.id !== taskId));
  }

  function returnToPlanner() {
    setViewMode("setup");
    setMode("planning");
    setCurrentTaskIndex(0);
    setRemainingSeconds(0);
    setCurrentPhaseAllocatedSeconds(0);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setIsRunning(false);
    setPlannerError("");
    setCompletionModalOpen(false);
    setIntermittentModalOpen(false);
    setBreakExtendModalOpen(false);
    setFocusExtendModalOpen(false);
    setPostureModalOpen(false);
    setResetDayModalOpen(false);
    setReturnToSetupModalOpen(false);
    resetTransientModalRecovery();
  }

  function startScheduledBreak() {
    const nextBreakMinutes = clampMinutes(breakMinutes, 1, MAX_BREAK_MINUTES);
    setMode("scheduledBreak");
    setRemainingSeconds(nextBreakMinutes * 60);
    setCurrentPhaseAllocatedSeconds(nextBreakMinutes * 60);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setIsRunning(true);
  }

  function advanceToNextFocusOrComplete() {
    const nextTaskIndex = currentTaskIndex + 1;
    const nextTask = tasks[nextTaskIndex];

    if (!nextTask) {
      setMode("complete");
      setRemainingSeconds(0);
      setCurrentPhaseAllocatedSeconds(0);
      setResumeFocusSeconds(null);
      setActiveMealType(null);
      setIsRunning(false);
      return;
    }

    setCurrentTaskIndex(nextTaskIndex);
    setMode("focus");
    setRemainingSeconds(nextTask.plannedMinutes * 60);
    setCurrentPhaseAllocatedSeconds(nextTask.plannedMinutes * 60);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setIsRunning(true);
  }

  function resumeFocusedTask() {
    if (resumeFocusSeconds === null) {
      return;
    }

    setMode("focus");
    setRemainingSeconds(resumeFocusSeconds);
    setCurrentPhaseAllocatedSeconds(resumeFocusSeconds);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setIsRunning(true);
  }

  function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (tasks.length === 0) {
      setPlannerError("Add at least one focus session before starting the day.");
      return;
    }

    const sessionTasks = tasks.map((task) => ({ ...task, status: "pending" as TaskStatus }));
    const firstTask = sessionTasks[0];
    const nextBreakMinutes = clampMinutes(breakMinutes, 1, MAX_BREAK_MINUTES);

    setTasks(sessionTasks);
    setBreakMinutes(nextBreakMinutes);
    setPlannerError("");
    setViewMode("main");
    setMode("focus");
    setCurrentTaskIndex(0);
    setRemainingSeconds(firstTask.plannedMinutes * 60);
    setCurrentPhaseAllocatedSeconds(firstTask.plannedMinutes * 60);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setElapsedActiveSeconds(0);
    setPostureModalOpen(false);
    setPosturePromptMode("standing");
    setNextDeskMode("standing");
    setResumeAfterPostureReminder(false);
    setIsRunning(true);
  }

  function toggleRunState() {
    if (mode === "planning" || mode === "complete") {
      return;
    }

    setIsRunning((previous) => !previous);
  }

  function openFocusExtendModal() {
    if (mode !== "focus") {
      return;
    }

    setFocusExtendMinutes(10);
    pauseForTransientModal(() => setFocusExtendModalOpen(true));
  }

  function confirmFocusExtend() {
    if (mode !== "focus" || !currentTask) {
      return;
    }

    const extraMinutes = clampMinutes(focusExtendMinutes || 1, 1, 180);
    setTasks((existingTasks) =>
      existingTasks.map((task, index) =>
        index === currentTaskIndex
          ? {
              ...task,
              plannedMinutes: task.plannedMinutes + extraMinutes
            }
          : task
      )
    );
    setRemainingSeconds((previous) => previous + extraMinutes * 60);
    setCurrentPhaseAllocatedSeconds((previous) => previous + extraMinutes * 60);
    setFocusExtendModalOpen(false);
    resumeAfterTransientClose();
  }

  function cancelFocusExtend() {
    setFocusExtendModalOpen(false);
    resumeAfterTransientClose();
  }

  function openIntermittentBreakModal() {
    if (mode !== "focus") {
      return;
    }

    setMotivation(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
    setIntermittentReflection("");
    setIntermittentBreakMinutes(5);
    setIntermittentSelectedMeal(null);
    setIntermittentError("");
    pauseForTransientModal(() => setIntermittentModalOpen(true));
  }

  function confirmIntermittentBreak() {
    if (mode !== "focus") {
      return;
    }

    if (intermittentWordCount < 20) {
      setIntermittentError("Write at least 20 words before you unlock a break.");
      return;
    }

    setResumeFocusSeconds(remainingSeconds);

    if (intermittentSelectedMeal) {
      if (usedMeals[intermittentSelectedMeal]) {
        setIntermittentError("That meal break has already been used today.");
        return;
      }

      setUsedMeals((previous) => ({ ...previous, [intermittentSelectedMeal]: true }));
      setActiveMealType(intermittentSelectedMeal);
      setMode("mealBreak");
      setRemainingSeconds(MEAL_BREAK_MINUTES * 60);
      setCurrentPhaseAllocatedSeconds(MEAL_BREAK_MINUTES * 60);
    } else {
      const nextBreakMinutes = clampMinutes(intermittentBreakMinutes || 1, 1, MAX_BREAK_MINUTES);
      setActiveMealType(null);
      setMode("intermittentBreak");
      setRemainingSeconds(nextBreakMinutes * 60);
      setCurrentPhaseAllocatedSeconds(nextBreakMinutes * 60);
    }

    setIntermittentModalOpen(false);
    setIntermittentError("");
    setIntermittentSelectedMeal(null);
    setIsRunning(true);
    resetTransientModalRecovery();
  }

  function cancelIntermittentBreak() {
    setIntermittentModalOpen(false);
    setIntermittentError("");
    setIntermittentSelectedMeal(null);
    setIntermittentReflection("");
    resumeAfterTransientClose();
  }

  function openBreakExtendModal() {
    if (!["scheduledBreak", "intermittentBreak"].includes(mode)) {
      return;
    }

    setBreakExtendMinutes(Math.min(Math.max(availableBreakExtensionMinutes, 1), 3));
    setBreakExtendSelectedMeal(null);
    setBreakExtendError("");
    pauseForTransientModal(() => setBreakExtendModalOpen(true));
  }

  function confirmBreakExtension() {
    if (!["scheduledBreak", "intermittentBreak"].includes(mode)) {
      return;
    }

    if (breakExtendSelectedMeal) {
      if (usedMeals[breakExtendSelectedMeal]) {
        setBreakExtendError("That meal break has already been used today.");
        return;
      }

      setUsedMeals((previous) => ({ ...previous, [breakExtendSelectedMeal]: true }));
      setActiveMealType(breakExtendSelectedMeal);
      setMode("mealBreak");
      setRemainingSeconds(MEAL_BREAK_MINUTES * 60);
      setCurrentPhaseAllocatedSeconds(MEAL_BREAK_MINUTES * 60);
      setBreakExtendModalOpen(false);
      setIsRunning(true);
      resetTransientModalRecovery();
      return;
    }

    if (availableBreakExtensionMinutes <= 0) {
      setBreakExtendError("This break is already at the 10-minute cap.");
      return;
    }

    const extraMinutes = clampMinutes(breakExtendMinutes || 1, 1, availableBreakExtensionMinutes);
    setRemainingSeconds((previous) => previous + extraMinutes * 60);
    setCurrentPhaseAllocatedSeconds((previous) => previous + extraMinutes * 60);
    setBreakExtendModalOpen(false);
    resumeAfterTransientClose();
  }

  function cancelBreakExtension() {
    setBreakExtendModalOpen(false);
    setBreakExtendError("");
    setBreakExtendSelectedMeal(null);
    resumeAfterTransientClose();
  }

  function openCompletionModal() {
    if (mode !== "focus") {
      return;
    }

    setCompletionModalOpen(true);
    setIsRunning(false);
  }

  function confirmTaskCompletion() {
    if (mode !== "focus" || !currentTask) {
      return;
    }

    const isLastTask = currentTaskIndex === tasks.length - 1;

    setTasks((existingTasks) =>
      existingTasks.map((task, index) =>
        index === currentTaskIndex
          ? {
              ...task,
              status: "done"
            }
          : task
      )
    );
    setCompletionModalOpen(false);

    if (isLastTask) {
      setMode("complete");
      setRemainingSeconds(0);
      setCurrentPhaseAllocatedSeconds(0);
      setResumeFocusSeconds(null);
      setActiveMealType(null);
      setIsRunning(false);
      return;
    }

    startScheduledBreak();
  }

  function giveCurrentTaskFiveMoreMinutes() {
    if (mode !== "focus" || !currentTask) {
      return;
    }

    setTasks((existingTasks) =>
      existingTasks.map((task, index) =>
        index === currentTaskIndex
          ? {
              ...task,
              plannedMinutes: task.plannedMinutes + 5
            }
          : task
      )
    );
    setCompletionModalOpen(false);
    setRemainingSeconds(5 * 60);
    setCurrentPhaseAllocatedSeconds(5 * 60);
    setIsRunning(true);
  }

  function handleManualAdvance() {
    if (mode === "focus") {
      openCompletionModal();
      return;
    }

    if (mode === "scheduledBreak") {
      advanceToNextFocusOrComplete();
      return;
    }

    if (mode === "intermittentBreak" || mode === "mealBreak") {
      if (resumeFocusSeconds !== null) {
        resumeFocusedTask();
      } else {
        advanceToNextFocusOrComplete();
      }
    }
  }

  function dismissPostureReminder() {
    setPostureModalOpen(false);

    if (resumeAfterPostureReminder && mode !== "planning" && mode !== "complete") {
      setIsRunning(true);
    }

    setResumeAfterPostureReminder(false);
  }

  function requestReturnToSetupMode() {
    if (viewMode !== "main") {
      return;
    }

    pauseForTransientModal(() => setReturnToSetupModalOpen(true));
  }

  function confirmReturnToSetupMode() {
    setReturnToSetupModalOpen(false);
    setViewMode("setup");
    resetTransientModalRecovery();
  }

  function cancelReturnToSetupMode() {
    setReturnToSetupModalOpen(false);
    resumeAfterTransientClose();
  }

  function openResetDayModal() {
    setResetConfirmationText("");
    pauseForTransientModal(() => setResetDayModalOpen(true));
  }

  function resetDay() {
    setViewMode("setup");
    setTasks([]);
    setBreakMinutes(10);
    setMode("planning");
    setCurrentTaskIndex(0);
    setRemainingSeconds(0);
    setCurrentPhaseAllocatedSeconds(0);
    setResumeFocusSeconds(null);
    setActiveMealType(null);
    setUsedMeals(INITIAL_MEAL_USAGE);
    setIsRunning(false);
    setPlannerError("");
    setElapsedActiveSeconds(0);
    setPostureModalOpen(false);
    setPosturePromptMode("standing");
    setNextDeskMode("standing");
    setResumeAfterPostureReminder(false);
    setAddTaskModalOpen(false);
    setFocusExtendModalOpen(false);
    setIntermittentModalOpen(false);
    setBreakExtendModalOpen(false);
    setCompletionModalOpen(false);
    setResetDayModalOpen(false);
    setReturnToSetupModalOpen(false);
    setResetConfirmationText("");
    setIntermittentReflection("");
    setIntermittentSelectedMeal(null);
    setBreakExtendSelectedMeal(null);
    resetTransientModalRecovery();
  }

  async function downloadReportAndResetDay() {
    const jsPdfModule = await import("jspdf/dist/jspdf.umd.min.js");
    const jsPDF =
      (jsPdfModule as unknown as { jsPDF?: new () => any }).jsPDF ??
      (jsPdfModule as unknown as { default?: { jsPDF?: new () => any } }).default?.jsPDF ??
      (jsPdfModule as unknown as { default?: { default?: { jsPDF?: new () => any } } }).default?.default?.jsPDF;

    if (typeof jsPDF !== "function") {
      throw new Error("Unable to load jsPDF in the browser.");
    }

    const doc = new jsPDF();
    const reportDate = new Date();
    const usedMealSummary = (Object.keys(usedMeals) as MealType[])
      .filter((meal) => usedMeals[meal])
      .map((meal) => capitalize(meal));

    const lines = [
      `Momentum Pomodoro Report`,
      `Date: ${reportDate.toLocaleDateString("en-SG")}`,
      "",
      `Tasks planned: ${tasks.length}`,
      `Tasks completed: ${completedTaskCount}`,
      `Scheduled break length: ${breakMinutes} minutes`,
      `Meals used: ${usedMealSummary.length > 0 ? usedMealSummary.join(", ") : "None"}`,
      "",
      "Task sheet:",
      ...tasks.map(
        (task, index) =>
          `${index + 1}. ${task.title} - ${task.plannedMinutes} min - ${task.status === "done" ? "Completed" : "Pending"}`
      )
    ];

    const wrappedLines = doc.splitTextToSize(lines.join("\n"), 180);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(wrappedLines, 14, 18);
    doc.save(`momentum-report-${reportDate.toISOString().slice(0, 10)}.pdf`);

    resetDay();
  }

  function buildSchedule(): ScheduleItem[] {
    if (!isHydrated || tasks.length === 0) {
      return [];
    }

    const items: ScheduleItem[] = [];
    let cursor = new Date();

    const pushItem = (label: string, kind: ScheduleItemKind, minutes: number) => {
      const end = addMinutes(cursor, minutes);
      items.push({
        label,
        kind,
        start: cursor,
        end
      });
      cursor = end;
    };

    const appendFutureTasks = (startTaskIndex: number) => {
      for (let index = startTaskIndex; index < tasks.length; index += 1) {
        const task = tasks[index];
        pushItem(task.title, "focus", task.plannedMinutes);

        if (index < tasks.length - 1) {
          pushItem("Scheduled break", "break", breakMinutes);
        }
      }
    };

    if (mode === "planning") {
      appendFutureTasks(0);
      return items;
    }

    if (mode === "complete") {
      return items;
    }

    if (mode === "focus" && currentTask) {
      pushItem(currentTask.title, "focus", Math.ceil(remainingSeconds / 60));

      if (currentTaskIndex < tasks.length - 1) {
        pushItem("Scheduled break", "break", breakMinutes);
        appendFutureTasks(currentTaskIndex + 1);
      }

      return items;
    }

    if (mode === "scheduledBreak") {
      pushItem("Scheduled break", "break", Math.ceil(remainingSeconds / 60));
      appendFutureTasks(currentTaskIndex + 1);
      return items;
    }

    if (mode === "intermittentBreak" && currentTask) {
      pushItem("Intermittent break", "break", Math.ceil(remainingSeconds / 60));
      pushItem(currentTask.title, "focus", Math.ceil((resumeFocusSeconds ?? 0) / 60));

      if (currentTaskIndex < tasks.length - 1) {
        pushItem("Scheduled break", "break", breakMinutes);
        appendFutureTasks(currentTaskIndex + 1);
      }

      return items;
    }

    if (mode === "mealBreak") {
      pushItem(`${capitalize(activeMealType ?? "meal")} break`, "meal", Math.ceil(remainingSeconds / 60));

      if (resumeFocusSeconds !== null && currentTask) {
        pushItem(currentTask.title, "focus", Math.ceil(resumeFocusSeconds / 60));

        if (currentTaskIndex < tasks.length - 1) {
          pushItem("Scheduled break", "break", breakMinutes);
          appendFutureTasks(currentTaskIndex + 1);
        }

        return items;
      }

      appendFutureTasks(currentTaskIndex + 1);
    }

    return items;
  }

  const scheduleItems = buildSchedule();
  const projectedFinish = scheduleItems.at(-1)?.end ?? null;
  const activeHeading =
    mode === "planning"
      ? "Build the day before you hit start"
      : mode === "focus"
        ? currentTask?.title ?? "Focus block"
        : mode === "scheduledBreak"
          ? "Scheduled break"
          : mode === "intermittentBreak"
            ? "Intermittent break"
            : mode === "mealBreak"
              ? `${capitalize(activeMealType ?? "meal")} break`
              : "All blocks complete";

  const activeDescription =
    mode === "planning"
      ? "Add each focus session through a popup, set your break rhythm, and use the schedule sheet to track the whole day."
      : mode === "focus"
        ? "You can extend the block with confirmation, or request a capped intermittent break or one-time meal break."
        : mode === "scheduledBreak"
          ? "Short breaks stay capped at 10 minutes, but you can still claim one breakfast, lunch, and dinner break."
          : mode === "intermittentBreak"
            ? "This break was taken in the middle of a focus block. You will return to the same task when it ends."
            : mode === "mealBreak"
              ? "Meal breaks run for 30 minutes and can only be used once each until you reset the day."
              : "Your schedule sheet is updated. Export the day when you are ready to clear everything.";

  const taskSheetItems = tasks.map((task, index) => {
    const isCurrentFocus = mode === "focus" && index === currentTaskIndex && task.status === "pending";
    const isNextUp =
      (mode === "scheduledBreak" || (mode === "mealBreak" && resumeFocusSeconds === null)) &&
      index === currentTaskIndex + 1 &&
      task.status === "pending";

    return {
      ...task,
      sheetState: task.status === "done" ? "done" : isCurrentFocus ? "in-progress" : isNextUp ? "next-up" : "pending"
    };
  });
  const sharedModals = (
    <>
      <AddTaskModal
        open={addTaskModalOpen}
        title={addTaskTitle}
        minutes={addTaskMinutes}
        error={addTaskError}
        onTitleChange={setAddTaskTitle}
        onMinutesChange={(value) => setAddTaskMinutes(clampMinutes(value, 1, 240))}
        onCancel={() => setAddTaskModalOpen(false)}
        onConfirm={confirmAddTask}
      />

      <ExtendFocusModal
        open={focusExtendModalOpen}
        minutes={focusExtendMinutes}
        onMinutesChange={(value) => setFocusExtendMinutes(clampMinutes(value, 1, 180))}
        onCancel={cancelFocusExtend}
        onConfirm={confirmFocusExtend}
      />

      <BreakDecisionModal
        open={intermittentModalOpen}
        kicker="Intermittent break"
        title="Confirm the break before you leave the block"
        description="Read the prompt, reflect honestly, and then choose either a short break or one of your one-time meal breaks."
        shortBreakMinutes={intermittentBreakMinutes}
        maxShortBreakMinutes={MAX_BREAK_MINUTES}
        selectedMeal={intermittentSelectedMeal}
        mealUsage={usedMeals}
        error={intermittentError}
        onShortBreakMinutesChange={(value) => setIntermittentBreakMinutes(clampMinutes(value, 1, MAX_BREAK_MINUTES))}
        onMealSelect={setIntermittentSelectedMeal}
        onCancel={cancelIntermittentBreak}
        onConfirm={confirmIntermittentBreak}
        confirmationLabel={intermittentSelectedMeal ? `Start ${intermittentSelectedMeal} break` : "Unlock break"}
        extraContent={
          <>
            <p className="motivation-callout">{motivation}</p>
            <label>
              <span>Write at least 20 words about whether this break is necessary right now.</span>
              <textarea
                rows={6}
                value={intermittentReflection}
                onChange={(event) => setIntermittentReflection(event.target.value)}
                placeholder="Describe what is urgent, what can wait, and what happens if you keep working for a little longer."
              />
            </label>
            <p className={`word-counter ${intermittentWordCount >= 20 ? "word-counter-ready" : ""}`}>{intermittentWordCount}/20 words</p>
          </>
        }
      />

      <BreakDecisionModal
        open={breakExtendModalOpen}
        kicker="Break extension"
        title="Extend the current break or swap to a meal break"
        description="Short breaks stay capped at 10 total minutes, but you can still use an unused meal break here if you need a longer reset."
        shortBreakMinutes={breakExtendMinutes}
        maxShortBreakMinutes={availableBreakExtensionMinutes}
        selectedMeal={breakExtendSelectedMeal}
        mealUsage={usedMeals}
        error={breakExtendError}
        onShortBreakMinutesChange={(value) => setBreakExtendMinutes(clampMinutes(value, 1, Math.max(availableBreakExtensionMinutes, 1)))}
        onMealSelect={setBreakExtendSelectedMeal}
        onCancel={cancelBreakExtension}
        onConfirm={confirmBreakExtension}
        confirmationLabel={breakExtendSelectedMeal ? `Start ${breakExtendSelectedMeal} break` : "Confirm break extension"}
      />

      <CompletionModal
        open={completionModalOpen}
        taskName={currentTask?.title ?? "Current task"}
        onConfirm={confirmTaskCompletion}
        onContinue={giveCurrentTaskFiveMoreMinutes}
      />

      <PostureReminderModal open={postureModalOpen} deskMode={posturePromptMode} onConfirm={dismissPostureReminder} />

      <ResetDayModal
        open={resetDayModalOpen}
        confirmationText={resetConfirmationText}
        taskCount={tasks.length}
        completedCount={completedTaskCount}
        mealUsage={usedMeals}
        onConfirmationTextChange={setResetConfirmationText}
        onCancel={() => {
          setResetDayModalOpen(false);
          resumeAfterTransientClose();
        }}
        onConfirm={downloadReportAndResetDay}
      />

      <ReturnToSetupModal open={returnToSetupModalOpen} onCancel={cancelReturnToSetupMode} onConfirm={confirmReturnToSetupMode} />
    </>
  );

  if (viewMode === "main" && mode !== "planning") {
    return (
      <main className="main-mode-shell">
        <section className="main-mode-frame">
          <div className="main-topbar">
            <div>
              <p className="eyebrow">Main Pomodoro Timer</p>
              <p className="main-topbar-copy">Minimal mode for staying with the current block.</p>
            </div>
            <button type="button" className="ghost-button strong-ghost" onClick={requestReturnToSetupMode}>
              Back to task setting
            </button>
          </div>

          <div className="main-stage">
            <p className="main-stage-kicker">{mode === "focus" ? "Current task" : activeHeading}</p>
            <h1 className="main-stage-title">{mode === "focus" && currentTask ? currentTask.title : activeHeading}</h1>
            <p className="main-stage-timer">{mode === "complete" ? "--:--" : formatClock(remainingSeconds)}</p>
            <p className="main-stage-support">
              {mode === "focus"
                ? `${currentTask?.plannedMinutes ?? 0} minutes allocated to this block`
                : mode === "mealBreak"
                  ? `${capitalize(activeMealType ?? "meal")} break in progress`
                  : activeDescription}
            </p>
          </div>

          <div className="main-mode-message">
            <span>Motivational message</span>
            <p>{mainMotivationMessage}</p>
          </div>

          <div className="main-mode-actions">
            <button type="button" className="primary-button" onClick={toggleRunState} disabled={mode === "complete"}>
              {isRunning ? "Pause timer" : "Resume timer"}
            </button>
            <button type="button" className="secondary-button" onClick={openFocusExtendModal} disabled={mode !== "focus"}>
              Extend block
            </button>
            <button type="button" className="secondary-button" onClick={openIntermittentBreakModal} disabled={mode !== "focus"}>
              Unscheduled break
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={openBreakExtendModal}
              disabled={!["scheduledBreak", "intermittentBreak"].includes(mode)}
            >
              Extend break
            </button>
            <button type="button" className="ghost-button strong-ghost" onClick={handleManualAdvance} disabled={mode === "complete"}>
              {mode === "focus"
                ? "Complete task"
                : resumeFocusSeconds !== null
                  ? "Return to focus now"
                  : "Start next focus"}
            </button>
          </div>

          <div className="main-mode-meta">
            <div>
              <span>Mode</span>
              <strong>{mode.replace(/([A-Z])/g, " $1").trim()}</strong>
            </div>
            <div>
              <span>Posture reminder</span>
              <strong>{mode === "complete" ? "Session complete" : `${formatClock(postureSecondsUntilReminder)} until ${nextDeskMode}`}</strong>
            </div>
            <div>
              <span>Meal breaks left</span>
              <strong>{3 - usedMealCount}</strong>
            </div>
          </div>
        </section>
        {sharedModals}
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Momentum Pomodoro</p>
          <h1>{activeHeading}</h1>
          <p className="lead">{activeDescription}</p>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <span>Focus planned</span>
            <strong>{formatDuration(totalFocusMinutes)}</strong>
          </div>
          <div className="metric-card">
            <span>Schedule sheet</span>
            <strong>
              {completedTaskCount}/{tasks.length || 0}
            </strong>
          </div>
          <div className="metric-card">
            <span>Breaks planned</span>
            <strong>{formatDuration(scheduledBreakMinutes)}</strong>
          </div>
          <div className="metric-card">
            <span>Projected finish</span>
            <strong>{isHydrated ? (projectedFinish ? formatTime(projectedFinish) : "Waiting") : "Calculating..."}</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel planner-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Task Setting</p>
              <h2>Everything you need to complete today</h2>
            </div>
            <button type="button" className="secondary-button" onClick={openAddTaskModal} disabled={mode !== "planning"}>
              Add focus session
            </button>
          </div>

          <form onSubmit={startSession} className="planner-form">
            <div className="task-stack">
              {taskSheetItems.length > 0 ? (
                taskSheetItems.map((task, index) => (
                  <div className={`task-card task-card-${task.sheetState}`} key={task.id}>
                    <div className="task-card-top">
                      <span className="task-index">Task {index + 1}</span>
                      <div className="task-card-actions">
                        <span className={`sheet-pill sheet-pill-${task.sheetState}`}>{task.sheetState.replace("-", " ")}</span>
                        {mode === "planning" ? (
                          <button type="button" className="ghost-button" onClick={() => removeTask(task.id)}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="task-title">{task.title}</p>
                    <p className="task-meta">{task.plannedMinutes} planned minutes</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No focus sessions added yet.</p>
                  <button type="button" className="secondary-button" onClick={openAddTaskModal}>
                    Create the first one
                  </button>
                </div>
              )}
            </div>

            <div className="config-grid">
              <label>
                <span>Break length between tasks</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_BREAK_MINUTES}
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(clampMinutes(Number(event.target.value) || 1, 1, MAX_BREAK_MINUTES))}
                />
              </label>

              <div className="meal-summary">
                <span>Meal passes</span>
                <div className="meal-summary-grid">
                  {(["breakfast", "lunch", "dinner"] as MealType[]).map((meal) => (
                    <span key={meal} className={`meal-summary-pill ${usedMeals[meal] ? "meal-summary-pill-used" : ""}`}>
                      {meal}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {plannerError ? <p className="error-text">{plannerError}</p> : null}

            <div className="planner-actions">
              <button type="submit" className="primary-button" disabled={mode !== "planning" || tasks.length === 0}>
                Start focus session
              </button>
              <button type="button" className="secondary-button" onClick={returnToPlanner}>
                Back to planner
              </button>
            </div>
          </form>
        </article>

        <article className="panel timer-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Main Timer Preview</p>
              <h2>{mode === "focus" && currentTask ? currentTask.title : activeHeading}</h2>
            </div>
            <div className="task-card-actions">
              <span className={`status-pill status-${mode}`}>{mode.replace(/([A-Z])/g, " $1").trim()}</span>
              <button type="button" className="ghost-button strong-ghost" onClick={() => setViewMode("main")} disabled={mode === "planning"}>
                Open main mode
              </button>
            </div>
          </div>

          <div className="clock-card">
            <p className="clock-label">
              {mode === "focus"
                ? "Focus remaining"
                : mode === "scheduledBreak"
                  ? "Scheduled break remaining"
                  : mode === "intermittentBreak"
                    ? "Intermittent break remaining"
                    : mode === "mealBreak"
                      ? `${capitalize(activeMealType ?? "meal")} break remaining`
                      : "Ready when you are"}
            </p>
            <p className="clock-value">{mode === "planning" || mode === "complete" ? "--:--" : formatClock(remainingSeconds)}</p>
            <p className="clock-subtitle">
              {mode === "focus" && currentTask
                ? `${currentTask.plannedMinutes} planned minutes in this task block`
                : mode === "mealBreak"
                  ? "Meal breaks are one-time 30-minute passes until the day is reset."
                  : activeDescription}
            </p>
          </div>

          <div className="control-grid">
            <button type="button" className="primary-button" onClick={toggleRunState} disabled={mode === "planning" || mode === "complete"}>
              {isRunning ? "Pause timer" : "Resume timer"}
            </button>

            <button type="button" className="secondary-button" onClick={openFocusExtendModal} disabled={mode !== "focus"}>
              Extend current block
            </button>

            <button type="button" className="secondary-button" onClick={openIntermittentBreakModal} disabled={mode !== "focus"}>
              Intermittent break
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openBreakExtendModal}
              disabled={!["scheduledBreak", "intermittentBreak"].includes(mode)}
            >
              Extend current break
            </button>

            <button
              type="button"
              className="ghost-button strong-ghost"
              onClick={handleManualAdvance}
              disabled={mode === "planning" || mode === "complete"}
            >
              {mode === "focus"
                ? "Mark task complete"
                : resumeFocusSeconds !== null
                  ? "Return to focus now"
                  : "Start next focus"}
            </button>
          </div>

          <div className="insight-strip">
            <div>
              <span>Current task</span>
              <strong>{currentTask?.title ?? "No active task"}</strong>
            </div>
            <div>
              <span>Motivation</span>
              <strong>{mainMotivationMessage}</strong>
            </div>
            <div>
              <span>Meal availability</span>
              <strong>{3 - usedMealCount} one-time meal breaks left</strong>
            </div>
            <div>
              <span>Posture reminder</span>
              <strong>
                {mode === "planning" || mode === "complete"
                  ? "Every 45 min once the session starts"
                  : `${formatClock(postureSecondsUntilReminder)} until ${nextDeskMode} reminder`}
              </strong>
            </div>
          </div>
        </article>

        <article className="panel schedule-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Schedule Shift</p>
              <h2>How the rest of the day moves</h2>
            </div>
          </div>

          {scheduleItems.length > 0 ? (
            <div className="timeline">
              {scheduleItems.map((item, index) => (
                <div className={`timeline-item timeline-${item.kind}`} key={`${item.label}-${index}`}>
                  <div className="timeline-time">
                    <span>{formatTime(item.start)}</span>
                    <span>{formatTime(item.end)}</span>
                  </div>
                  <div className="timeline-body">
                    <p>{item.label}</p>
                    <span>
                      {item.kind === "focus" ? "Focus block" : item.kind === "meal" ? "Meal break" : "Short break"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {mode === "complete" ? (
                <p>Everything in the current schedule sheet is complete.</p>
              ) : (
                <p>Schedule times will appear here as soon as the browser finishes loading.</p>
              )}
            </div>
          )}
        </article>
      </section>

      <section className="panel reset-panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Day Reset</p>
            <h2>Export today and clear every block</h2>
          </div>
        </div>
        <p className="reset-copy">
          When you are done, download a PDF report of the day and wipe the planner clean, including any breakfast, lunch, and dinner passes you already used.
        </p>
        <button type="button" className="danger-button" onClick={openResetDayModal}>
          Reset day and download report
        </button>
      </section>
      {sharedModals}
    </main>
  );
}
