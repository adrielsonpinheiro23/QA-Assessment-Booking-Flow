"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { ApiError, fetchSkips } from "@/lib/api";
import type { Skip } from "@/lib/types";

interface Props {
  postcode: string;
  heavyWaste: boolean;
  initialSkipSize: string | null;
  onBack: () => void;
  onContinue: (skip: Skip) => void;
}

type Status = "loading" | "success" | "empty" | "error";

export default function SkipStep({
  postcode,
  heavyWaste,
  initialSkipSize,
  onBack,
  onContinue,
}: Props) {
  const [skips, setSkips] = useState<Skip[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    initialSkipSize,
  );

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetchSkips(postcode, heavyWaste);
      setSkips(res.skips);
      setStatus(res.skips.length === 0 ? "empty" : "success");
      // If current selection became disabled (e.g. user toggled heavy waste),
      // clear it so they have to pick again.
      if (initialSkipSize) {
        const match = res.skips.find((s) => s.size === initialSkipSize);
        if (!match || match.disabled) {
          setSelectedSize(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to load skip options. Please try again.",
      );
      setStatus("error");
    }
  }, [postcode, heavyWaste, initialSkipSize]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = skips.find((s) => s.size === selectedSize) ?? null;
  const canContinue = selected !== null && !selected.disabled;

  return (
    <section
      className="rounded-lg border bg-white p-5 shadow-sm sm:p-6"
      data-testid="step-skip"
    >
      <h2 className="mb-1 text-xl font-semibold">Pick a skip size</h2>
      <p className="mb-5 text-sm text-slate-500">
        {heavyWaste
          ? "Some sizes are unavailable because you selected heavy waste."
          : "All sizes are available for your waste type."}
      </p>

      {status === "loading" && (
        <div
          className="flex items-center gap-2 text-sm text-slate-600"
          data-testid="skip-loading"
        >
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
            aria-hidden
          />
          Loading skip options…
        </div>
      )}

      {status === "error" && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
          role="alert"
          data-testid="skip-error"
        >
          <p className="font-medium text-red-800">
            {error ?? "Couldn't load skip options."}
          </p>
          <button
            type="button"
            onClick={load}
            data-testid="skip-retry-btn"
            className="mt-2 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {status === "empty" && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="skip-empty"
        >
          No skip options are currently available for this postcode.
        </div>
      )}

      {status === "success" && (
        <ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          data-testid="skip-list"
        >
          {skips.map((s) => {
            const isSelected = s.size === selectedSize;
            return (
              <li key={s.size}>
                <button
                  type="button"
                  disabled={s.disabled}
                  aria-disabled={s.disabled}
                  onClick={() => !s.disabled && setSelectedSize(s.size)}
                  data-testid="skip-option"
                  data-size={s.size}
                  data-disabled={s.disabled ? "true" : "false"}
                  className={clsx(
                    "w-full rounded-md border p-4 text-left transition",
                    s.disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                      : isSelected
                        ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                        : "border-slate-200 hover:border-brand-600 hover:bg-brand-50/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.size}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.disabled ? "Unavailable" : "Available"}
                      </p>
                    </div>
                    <p className="font-semibold">£{s.price}</p>
                  </div>
                  {s.disabled && s.disabledReason && (
                    <p
                      className="mt-2 text-xs text-amber-800"
                      data-testid="skip-disabled-reason"
                    >
                      {s.disabledReason}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          data-testid="skip-back-btn"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => selected && onContinue(selected)}
          disabled={!canContinue}
          data-testid="skip-continue-btn"
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
