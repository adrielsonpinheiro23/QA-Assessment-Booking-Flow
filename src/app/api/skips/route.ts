import { NextResponse } from "next/server";
import {
  buildSkips,
  isValidUkPostcode,
  normalizePostcode,
} from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get("postcode");
  const heavyWasteRaw = searchParams.get("heavyWaste");

  if (!postcode) {
    return NextResponse.json(
      { error: "postcode query param is required", code: "MISSING_POSTCODE" },
      { status: 400 },
    );
  }

  if (!isValidUkPostcode(postcode)) {
    return NextResponse.json(
      { error: "Invalid UK postcode format", code: "INVALID_POSTCODE" },
      { status: 422 },
    );
  }

  // Treat any value other than the literal "true" as false.
  const heavyWaste = heavyWasteRaw === "true";

  // Normalize purely to keep the shape stable; skips are not
  // postcode-specific in this demo, but a real impl would key by
  // service area.
  normalizePostcode(postcode);

  const skips = buildSkips(heavyWaste);
  return NextResponse.json({ skips });
}
