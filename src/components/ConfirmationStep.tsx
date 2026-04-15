"use client";

interface Props {
  bookingId: string;
  onStartOver: () => void;
}

export default function ConfirmationStep({ bookingId, onStartOver }: Props) {
  return (
    <section
      className="rounded-lg border bg-white p-6 text-center shadow-sm"
      data-testid="step-confirmation"
    >
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700"
        aria-hidden
      >
        ✓
      </div>
      <h2 className="text-xl font-semibold">Booking confirmed</h2>
      <p className="mt-1 text-sm text-slate-500">
        We&apos;ve emailed you a receipt and next steps.
      </p>
      <p className="mt-4 text-sm">
        Booking reference:{" "}
        <span
          className="rounded bg-slate-100 px-2 py-1 font-mono font-semibold"
          data-testid="booking-id"
        >
          {bookingId}
        </span>
      </p>
      <button
        type="button"
        onClick={onStartOver}
        data-testid="start-over-btn"
        className="mt-6 rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Book another skip
      </button>
    </section>
  );
}
