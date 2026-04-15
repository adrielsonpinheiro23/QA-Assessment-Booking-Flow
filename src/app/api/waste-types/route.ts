import { NextResponse } from "next/server";
import type { PlasterboardOption, WasteTypesRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_PLASTERBOARD_OPTIONS: PlasterboardOption[] = [
  "bagged-on-skip",
  "separate-collection",
  "under-10-percent",
];

export async function POST(request: Request) {
  let body: Partial<WasteTypesRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  if (typeof body.heavyWaste !== "boolean") {
    return NextResponse.json(
      { error: "heavyWaste must be a boolean", code: "INVALID_HEAVY_WASTE" },
      { status: 422 },
    );
  }
  if (typeof body.plasterboard !== "boolean") {
    return NextResponse.json(
      { error: "plasterboard must be a boolean", code: "INVALID_PLASTERBOARD" },
      { status: 422 },
    );
  }

  // Branching logic: if plasterboard is true, a plasterboardOption is required.
  if (body.plasterboard) {
    if (
      !body.plasterboardOption ||
      !VALID_PLASTERBOARD_OPTIONS.includes(body.plasterboardOption)
    ) {
      return NextResponse.json(
        {
          error:
            "plasterboardOption is required when plasterboard=true and must be one of: " +
            VALID_PLASTERBOARD_OPTIONS.join(", "),
          code: "INVALID_PLASTERBOARD_OPTION",
        },
        { status: 422 },
      );
    }
  } else if (body.plasterboardOption != null) {
    return NextResponse.json(
      {
        error: "plasterboardOption must be null when plasterboard=false",
        code: "INVALID_PLASTERBOARD_OPTION",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true });
}
