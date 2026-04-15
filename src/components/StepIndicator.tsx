"use client";

import clsx from "clsx";

export type StepId = "postcode" | "waste" | "skip" | "review" | "done";

const STEPS: { id: StepId; label: string }[] = [
  { id: "postcode", label: "Postcode" },
  { id: "waste", label: "Waste type" },
  { id: "skip", label: "Skip" },
  { id: "review", label: "Review" },
];

export default function StepIndicator({ current }: { current: StepId }) {
  const currentIndex =
    current === "done" ? STEPS.length - 1 : STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Booking progress" className="mb-6">
      <ol className="flex items-center gap-2" data-testid="step-indicator">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentIndex && current !== "done";
          const isComplete = idx < currentIndex || current === "done";
          return (
            <li
              key={step.id}
              className="flex flex-1 items-center gap-2"
              data-step={step.id}
              data-state={
                isActive ? "active" : isComplete ? "complete" : "pending"
              }
            >
              <span
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isComplete
                    ? "bg-brand-600 text-white"
                    : isActive
                      ? "border-2 border-brand-600 bg-white text-brand-700"
                      : "border border-slate-300 bg-white text-slate-500",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isComplete ? "✓" : idx + 1}
              </span>
              <span
                className={clsx(
                  "hidden text-sm font-medium sm:inline",
                  isActive
                    ? "text-brand-700"
                    : isComplete
                      ? "text-slate-900"
                      : "text-slate-500",
                )}
              >
                {step.label}
              </span>
              {idx < STEPS.length - 1 && (
                <span
                  className={clsx(
                    "h-px flex-1",
                    isComplete ? "bg-brand-600" : "bg-slate-200",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
