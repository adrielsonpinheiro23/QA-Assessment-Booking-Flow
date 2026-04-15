"use client";

import { useRef, useState } from "react";
import { ApiError, confirmBooking } from "@/lib/api";
import type { Address, PlasterboardOption, Skip } from "@/lib/types";

interface Props {
  postcode: string;
  address: Address | null;
  manualAddress: string;
  heavyWaste: boolean;
  plasterboard: boolean;
  plasterboardOption: PlasterboardOption | null;
  skip: Skip;
  onBack: () => void;
  onConfirmed: (bookingId: string) => void;
}

const PLASTERBOARD_LABELS: Record<PlasterboardOption, string> = {
  "bagged-on-skip": "Bagged on skip",
  "separate-collection": "Separate collection",
  "under-10-percent": "Small quantity (under 10%)",
};

// Price breakdown: skip hire + vat + site surcharge (illustrative).
function buildBreakdown(skip: Skip, heavyWaste: boolean, plasterboard: boolean) {
  const subtotal = skip.price;
  const heavyFee = heavyWaste ? 25 : 0;
  const plasterboardFee = plasterboard ? 15 : 0;
  const preVat = subtotal + heavyFee + plasterboardFee;
  const vat = Math.round(preVat * 0.2);
  const total = preVat + vat;
  return { subtotal, heavyFee, plasterboardFee, vat, total };
}

export default function ReviewStep({
  postcode,
  address,
  manualAddress,
  heavyWaste,
  plasterboard,
  plasterboardOption,
  skip,
  onBack,
  onConfirmed,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  // useRef complements the state guard: synchronous rapid clicks read the
  // same React closure (submitting=false) but the ref updates immediately,
  // so only the first click fires a request.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const breakdown = buildBreakdown(skip, heavyWaste, plasterboard);

  const handleConfirm = async () => {
    if (inFlight.current) return; // synchronous guard
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await confirmBooking({
        postcode,
        addressId: address?.id ?? "",
        heavyWaste,
        plasterboard,
        plasterboardOption,
        skipSize: skip.size,
        price: skip.price,
      });
      onConfirmed(res.bookingId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to confirm booking. Please try again.",
      );
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-lg border bg-white p-5 shadow-sm sm:p-6"
      data-testid="step-review"
    >
      <h2 className="mb-1 text-xl font-semibold">Review your booking</h2>
      <p className="mb-5 text-sm text-slate-500">
        Double-check the details before we confirm.
      </p>

      <dl className="divide-y rounded-md border text-sm" data-testid="review-summary">
        <div className="flex justify-between gap-4 p-3">
          <dt className="text-slate-500">Postcode</dt>
          <dd className="font-medium" data-testid="review-postcode">
            {postcode}
          </dd>
        </div>
        <div className="flex justify-between gap-4 p-3">
          <dt className="text-slate-500">Address</dt>
          <dd
            className="text-right font-medium"
            data-testid="review-address"
          >
            {address ? (
              <>
                <span className="block">{address.line1}</span>
                <span className="block text-slate-500">{address.city}</span>
              </>
            ) : (
              <span className="whitespace-pre-line">{manualAddress}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4 p-3">
          <dt className="text-slate-500">Heavy waste</dt>
          <dd className="font-medium" data-testid="review-heavy-waste">
            {heavyWaste ? "Yes" : "No"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 p-3">
          <dt className="text-slate-500">Plasterboard</dt>
          <dd className="text-right font-medium" data-testid="review-plasterboard">
            {plasterboard
              ? plasterboardOption
                ? PLASTERBOARD_LABELS[plasterboardOption]
                : "Yes"
              : "No"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 p-3">
          <dt className="text-slate-500">Skip size</dt>
          <dd className="font-medium" data-testid="review-skip-size">
            {skip.size}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 rounded-md border bg-slate-50 p-4 text-sm"
        data-testid="price-breakdown"
      >
        <p className="mb-2 font-semibold">Price breakdown</p>
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt>Skip hire ({skip.size})</dt>
            <dd data-testid="price-subtotal">£{breakdown.subtotal}</dd>
          </div>
          {breakdown.heavyFee > 0 && (
            <div className="flex justify-between">
              <dt>Heavy waste surcharge</dt>
              <dd data-testid="price-heavy">£{breakdown.heavyFee}</dd>
            </div>
          )}
          {breakdown.plasterboardFee > 0 && (
            <div className="flex justify-between">
              <dt>Plasterboard handling</dt>
              <dd data-testid="price-plasterboard">£{breakdown.plasterboardFee}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>VAT (20%)</dt>
            <dd data-testid="price-vat">£{breakdown.vat}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <dt>Total</dt>
            <dd data-testid="price-total">£{breakdown.total}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
          data-testid="review-error"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          data-testid="review-back-btn"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          data-testid="review-confirm-btn"
          aria-busy={submitting}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Confirming…" : `Confirm booking · £${breakdown.total}`}
        </button>
      </div>
    </section>
  );
}
