"use client";

import { useState } from "react";
import { ApiError, lookupPostcode } from "@/lib/api";
import { isValidUkPostcode } from "@/lib/fixtures";
import type { Address } from "@/lib/types";

interface Props {
  initialPostcode: string;
  initialAddressId: string | null;
  initialManualAddress: string;
  onContinue: (payload: {
    postcode: string;
    addressId: string | null;
    manualAddress: string;
    address: Address | null;
  }) => void;
}

type Status = "idle" | "loading" | "success" | "empty" | "error";

export default function PostcodeStep({
  initialPostcode,
  initialAddressId,
  initialManualAddress,
  onContinue,
}: Props) {
  const [postcode, setPostcode] = useState(initialPostcode);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialAddressId);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState(initialManualAddress);

  const doLookup = async () => {
    setInputError(null);
    const trimmed = postcode.trim();
    if (!trimmed) {
      setInputError("Please enter a postcode.");
      return;
    }
    if (!isValidUkPostcode(trimmed)) {
      setInputError("That doesn't look like a valid UK postcode.");
      return;
    }

    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await lookupPostcode(trimmed);
      setAddresses(res.addresses);
      setStatus(res.addresses.length === 0 ? "empty" : "success");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to look up postcode. Please try again.";
      setErrorMsg(message);
      setStatus("error");
    }
  };

  const canContinue =
    (selectedId !== null && addresses.some((a) => a.id === selectedId)) ||
    (manualMode && manualAddress.trim().length > 0);

  const handleContinue = () => {
    if (!canContinue) return;
    const addr = addresses.find((a) => a.id === selectedId) ?? null;
    onContinue({
      postcode: postcode.trim(),
      addressId: manualMode ? null : selectedId,
      manualAddress: manualMode ? manualAddress.trim() : "",
      address: manualMode ? null : addr,
    });
  };

  return (
    <section
      className="rounded-lg border bg-white p-5 shadow-sm sm:p-6"
      data-testid="step-postcode"
    >
      <h2 className="mb-1 text-xl font-semibold">Where&apos;s your skip going?</h2>
      <p className="mb-5 text-sm text-slate-500">
        Enter your UK postcode and we&apos;ll find your address.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label
            htmlFor="postcode-input"
            className="mb-1 block text-sm font-medium"
          >
            Postcode
          </label>
          <input
            id="postcode-input"
            data-testid="postcode-input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="postal-code"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doLookup();
              }
            }}
            placeholder="e.g. SW1A 1AA"
            aria-invalid={inputError != null}
            aria-describedby={inputError ? "postcode-input-error" : undefined}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-brand-600"
          />
          {inputError && (
            <p
              id="postcode-input-error"
              className="mt-1 text-sm text-red-600"
              data-testid="postcode-input-error"
            >
              {inputError}
            </p>
          )}
        </div>
        <div className="flex sm:items-end">
          <button
            type="button"
            onClick={doLookup}
            disabled={status === "loading"}
            data-testid="postcode-lookup-btn"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {status === "loading" ? "Looking up…" : "Find address"}
          </button>
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {status === "loading" && (
          <div
            className="flex items-center gap-2 text-sm text-slate-600"
            data-testid="postcode-loading"
          >
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
              aria-hidden
            />
            Looking up addresses…
          </div>
        )}

        {status === "error" && (
          <div
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
            role="alert"
            data-testid="postcode-error"
          >
            <p className="font-medium text-red-800">
              {errorMsg ?? "Something went wrong."}
            </p>
            <button
              type="button"
              onClick={doLookup}
              data-testid="postcode-retry-btn"
              className="mt-2 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {status === "empty" && (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
            data-testid="postcode-empty"
          >
            <p className="font-medium text-amber-900">
              No addresses found for that postcode.
            </p>
            <p className="mt-1 text-amber-800">
              Please double-check your postcode, or{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setManualMode(true)}
                data-testid="postcode-enter-manual"
              >
                enter your address manually
              </button>
              .
            </p>
          </div>
        )}

        {status === "success" && !manualMode && (
          <fieldset
            className="mt-3"
            data-testid="address-list"
            aria-label="Select an address"
          >
            <legend className="mb-2 text-sm font-medium">
              {addresses.length} address{addresses.length === 1 ? "" : "es"} found
            </legend>
            <ul className="divide-y rounded-md border">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label
                    className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"
                    data-testid="address-option"
                    data-address-id={a.id}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={a.id}
                      checked={selectedId === a.id}
                      onChange={() => setSelectedId(a.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      <span className="block font-medium">{a.line1}</span>
                      <span className="block text-slate-500">{a.city}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-brand-700 underline"
              onClick={() => setManualMode(true)}
              data-testid="postcode-switch-manual"
            >
              Address not listed? Enter manually
            </button>
          </fieldset>
        )}

        {manualMode && (
          <div className="mt-4" data-testid="manual-address-block">
            <label htmlFor="manual-addr" className="mb-1 block text-sm font-medium">
              Enter address manually
            </label>
            <textarea
              id="manual-addr"
              data-testid="manual-address-input"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600"
              placeholder="House number, street, city"
            />
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="mt-2 text-sm font-medium text-brand-700 underline"
            >
              Back to address list
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          data-testid="postcode-continue-btn"
          onClick={handleContinue}
          disabled={!canContinue}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
