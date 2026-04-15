import { NextResponse } from "next/server";
import {
  ADDRESS_FIXTURES,
  buildSkips,
  isValidUkPostcode,
  normalizePostcode,
} from "@/lib/fixtures";
import type { BookingConfirmRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

// In-memory idempotency guard to prevent double-submit on the server.
// Key is derived from booking contents + a short time window.
// For a real system this would be a persisted idempotency key.
const recentSubmissions = new Map<string, { bookingId: string; ts: number }>();
const DEDUPE_WINDOW_MS = 10_000;

function bookingKey(body: BookingConfirmRequest): string {
  return [
    normalizePostcode(body.postcode),
    body.addressId,
    body.skipSize,
    body.heavyWaste,
    body.plasterboard,
    body.plasterboardOption ?? "null",
  ].join("|");
}

function makeBookingId(): string {
  const n = Math.floor(10000 + Math.random() * 90000);
  return `BK-${n}`;
}

export async function POST(request: Request) {
  let body: Partial<BookingConfirmRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const missing: string[] = [];
  if (!body.postcode) missing.push("postcode");
  if (!body.addressId) missing.push("addressId");
  if (typeof body.heavyWaste !== "boolean") missing.push("heavyWaste");
  if (typeof body.plasterboard !== "boolean") missing.push("plasterboard");
  if (!body.skipSize) missing.push("skipSize");
  if (typeof body.price !== "number") missing.push("price");
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing/invalid fields: ${missing.join(", ")}`, code: "MISSING_FIELDS" },
      { status: 422 },
    );
  }

  if (!isValidUkPostcode(body.postcode!)) {
    return NextResponse.json(
      { error: "Invalid UK postcode format", code: "INVALID_POSTCODE" },
      { status: 422 },
    );
  }

  const normalized = normalizePostcode(body.postcode!);
  const addresses = ADDRESS_FIXTURES[normalized] ?? [];
  const addressExists = addresses.some((a) => a.id === body.addressId);
  if (!addressExists) {
    return NextResponse.json(
      { error: "addressId not found for postcode", code: "UNKNOWN_ADDRESS" },
      { status: 422 },
    );
  }

  const skips = buildSkips(body.heavyWaste!);
  const skip = skips.find((s) => s.size === body.skipSize);
  if (!skip) {
    return NextResponse.json(
      { error: "Unknown skip size", code: "UNKNOWN_SKIP" },
      { status: 422 },
    );
  }
  if (skip.disabled) {
    return NextResponse.json(
      {
        error: `Skip size ${skip.size} is not available for the selected waste type`,
        code: "SKIP_DISABLED",
      },
      { status: 409 },
    );
  }
  if (skip.price !== body.price) {
    return NextResponse.json(
      {
        error: `Price mismatch — expected ${skip.price}, received ${body.price}`,
        code: "PRICE_MISMATCH",
      },
      { status: 409 },
    );
  }

  if (body.plasterboard && !body.plasterboardOption) {
    return NextResponse.json(
      {
        error: "plasterboardOption is required when plasterboard=true",
        code: "INVALID_PLASTERBOARD_OPTION",
      },
      { status: 422 },
    );
  }

  // Double-submit guard.
  const key = bookingKey(body as BookingConfirmRequest);
  const now = Date.now();
  const existing = recentSubmissions.get(key);
  if (existing && now - existing.ts < DEDUPE_WINDOW_MS) {
    return NextResponse.json(
      {
        status: "success",
        bookingId: existing.bookingId,
        deduplicated: true,
      },
      { status: 200 },
    );
  }

  const bookingId = makeBookingId();
  recentSubmissions.set(key, { bookingId, ts: now });

  return NextResponse.json({ status: "success", bookingId });
}
