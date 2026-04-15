import { NextResponse } from "next/server";
import {
  ADDRESS_FIXTURES,
  LATENCY_POSTCODES,
  RETRY_POSTCODES,
  isValidUkPostcode,
  normalizePostcode,
} from "@/lib/fixtures";
import type { PostcodeLookupRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

// In-memory retry counter for the BS1 4DJ fixture.
// First call fails with 500, subsequent calls succeed.
// We intentionally do not reset this per-request to make retry observable
// across the same session. It resets on server restart.
const retryAttempts = new Map<string, number>();

export async function POST(request: Request) {
  let body: Partial<PostcodeLookupRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const postcode = body.postcode?.trim();
  if (!postcode) {
    return NextResponse.json(
      { error: "postcode is required", code: "MISSING_POSTCODE" },
      { status: 400 },
    );
  }

  if (!isValidUkPostcode(postcode)) {
    return NextResponse.json(
      { error: "Invalid UK postcode format", code: "INVALID_POSTCODE" },
      { status: 422 },
    );
  }

  const normalized = normalizePostcode(postcode);

  // Simulate latency for M1 1AE.
  if (LATENCY_POSTCODES.has(normalized)) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  // Simulate 500 on first call for BS1 4DJ, success on retry.
  if (RETRY_POSTCODES.has(normalized)) {
    const attempts = (retryAttempts.get(normalized) ?? 0) + 1;
    retryAttempts.set(normalized, attempts);
    if (attempts === 1) {
      return NextResponse.json(
        {
          error: "Upstream postcode service temporarily unavailable",
          code: "UPSTREAM_500",
        },
        { status: 500 },
      );
    }
  }

  const addresses = ADDRESS_FIXTURES[normalized] ?? [];

  return NextResponse.json({
    postcode,
    addresses,
  });
}
