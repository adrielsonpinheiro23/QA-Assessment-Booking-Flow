"use client";

import { useState } from "react";
import clsx from "clsx";
import { ApiError, submitWasteTypes } from "@/lib/api";
import type { PlasterboardOption } from "@/lib/types";

interface Props {
  initial: {
    heavyWaste: boolean;
    plasterboard: boolean;
    plasterboardOption: PlasterboardOption | null;
  };
  onBack: () => void;
  onContinue: (payload: {
    heavyWaste: boolean;
    plasterboard: boolean;
    plasterboardOption: PlasterboardOption | null;
  }) => void;
}

const PLASTERBOARD_CHOICES: {
  id: PlasterboardOption;
  title: string;
  desc: string;
}[] = [
  {
    id: "bagged-on-skip",
    title: "Bag it on the skip",
    desc: "We'll supply heavy-duty bags. Keep plasterboard bagged and separate on the skip.",
  },
  {
    id: "separate-collection",
    title: "Separate collection",
    desc: "We collect the plasterboard in a dedicated skip or bag alongside your main skip.",
  },
  {
    id: "under-10-percent",
    title: "Small quantity (under 10%)",
    desc: "Mix in with general waste — only if the plasterboard is less than 10% by volume.",
  },
];

export default function WasteTypeStep({ initial, onBack, onContinue }: Props) {
  const [heavyWaste, setHeavyWaste] = useState(initial.heavyWaste);
  const [plasterboard, setPlasterboard] = useState(initial.plasterboard);
  const [plasterboardOption, setPlasterboardOption] = useState<
    PlasterboardOption | null
  >(initial.plasterboardOption);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = plasterboard ? plasterboardOption !== null : true;

  const handleContinue = async () => {
    setError(null);
    if (!canContinue) return;
    setSubmitting(true);
    try {
      await submitWasteTypes({
        heavyWaste,
        plasterboard,
        plasterboardOption: plasterboard ? plasterboardOption : null,
      });
      onContinue({
        heavyWaste,
        plasterboard,
        plasterboardOption: plasterboard ? plasterboardOption : null,
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save your waste selection. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-lg border bg-white p-5 shadow-sm sm:p-6"
      data-testid="step-waste"
    >
      <h2 className="mb-1 text-xl font-semibold">What are you throwing away?</h2>
      <p className="mb-5 text-sm text-slate-500">
        Tell us about your waste so we can recommend the right skip.
      </p>

      <div className="space-y-4">
        <div className="rounded-md border p-4">
          <label
            className="flex items-start gap-3"
            data-testid="heavy-waste-toggle"
          >
            <input
              type="checkbox"
              checked={heavyWaste}
              onChange={(e) => setHeavyWaste(e.target.checked)}
              className="mt-1 h-4 w-4"
              data-testid="heavy-waste-checkbox"
            />
            <span className="text-sm">
              <span className="block font-medium">Heavy waste</span>
              <span className="block text-slate-500">
                Soil, rubble, concrete, tiles, bricks. Limits the skip sizes we
                can offer.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-md border p-4">
          <label
            className="flex items-start gap-3"
            data-testid="plasterboard-toggle"
          >
            <input
              type="checkbox"
              checked={plasterboard}
              onChange={(e) => {
                const v = e.target.checked;
                setPlasterboard(v);
                if (!v) setPlasterboardOption(null);
              }}
              className="mt-1 h-4 w-4"
              data-testid="plasterboard-checkbox"
            />
            <span className="text-sm">
              <span className="block font-medium">Plasterboard</span>
              <span className="block text-slate-500">
                Plasterboard must be kept separate. Choose how we should handle
                it.
              </span>
            </span>
          </label>

          {plasterboard && (
            <fieldset
              className="mt-4 space-y-2"
              data-testid="plasterboard-options"
              aria-label="Plasterboard handling options"
            >
              <legend className="mb-1 text-sm font-medium">
                How should we handle it?
              </legend>
              {PLASTERBOARD_CHOICES.map((opt) => (
                <label
                  key={opt.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                    plasterboardOption === opt.id
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                  data-testid="plasterboard-option"
                  data-value={opt.id}
                >
                  <input
                    type="radio"
                    name="plasterboardOption"
                    value={opt.id}
                    checked={plasterboardOption === opt.id}
                    onChange={() => setPlasterboardOption(opt.id)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">{opt.title}</span>
                    <span className="block text-slate-500">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
          data-testid="waste-error"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          data-testid="waste-back-btn"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue || submitting}
          data-testid="waste-continue-btn"
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </section>
  );
}
