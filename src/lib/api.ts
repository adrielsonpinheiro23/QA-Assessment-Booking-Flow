// Thin client-side API wrapper. Throws on non-2xx so callers can
// centralize error-handling + retry UX at the hook level.

import type {
  BookingConfirmRequest,
  BookingConfirmResponse,
  PostcodeLookupResponse,
  SkipsResponse,
  WasteTypesRequest,
  WasteTypesResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? `Request failed (${res.status})`,
      (data as { code?: string }).code,
    );
  }
  return data as T;
}

export async function lookupPostcode(
  postcode: string,
): Promise<PostcodeLookupResponse> {
  const res = await fetch("/api/postcode/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postcode }),
  });
  return asJson<PostcodeLookupResponse>(res);
}

export async function submitWasteTypes(
  body: WasteTypesRequest,
): Promise<WasteTypesResponse> {
  const res = await fetch("/api/waste-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<WasteTypesResponse>(res);
}

export async function fetchSkips(
  postcode: string,
  heavyWaste: boolean,
): Promise<SkipsResponse> {
  const qs = new URLSearchParams({
    postcode,
    heavyWaste: String(heavyWaste),
  });
  const res = await fetch(`/api/skips?${qs.toString()}`);
  return asJson<SkipsResponse>(res);
}

export async function confirmBooking(
  body: BookingConfirmRequest,
): Promise<BookingConfirmResponse> {
  const res = await fetch("/api/booking/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson<BookingConfirmResponse>(res);
}
