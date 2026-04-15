// API contract tests.
//
// These tests hit every endpoint directly via Playwright's APIRequestContext —
// no UI, no browser. The goal is to assert that the response shape matches the
// contract in the assessment PDF exactly:
//   - every documented field is present and correctly typed
//   - undocumented extra fields are flagged (with two known additive
//     extensions: `Skip.disabledReason` and `BookingConfirmResponse.deduplicated`)
//   - every error response uses the same `{ error, code }` envelope
//
// If the contract regresses (a field gets renamed, a key disappears, a new
// field sneaks in undocumented) these tests fail in a way that pinpoints the
// exact field — much louder than the UI breaking three steps later.

import { expect, test } from "@playwright/test";

// ---------- Shape helpers ----------

const REQUIRED = {
  postcodeLookup: ["postcode", "addresses"],
  address: ["id", "line1", "city"],
  wasteTypes: ["ok"],
  skipsResponse: ["skips"],
  skip: ["size", "price", "disabled"],
  bookingConfirm: ["status", "bookingId"],
} as const;

// Additive fields documented as extensions of the spec — tolerated by contract.
const ADDITIVE = {
  skip: ["disabledReason"],
  bookingConfirm: ["deduplicated"],
} as const;

// Asserts an object has exactly the required keys (plus optional additive keys),
// and nothing else. The third argument is the set of additive keys that are
// allowed but not required.
function expectShape(
  obj: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  expect(obj, "expected response body to be an object").toEqual(
    expect.any(Object),
  );
  const o = obj as Record<string, unknown>;
  for (const key of required) {
    expect(o, `missing required field "${key}"`).toHaveProperty(key);
  }
  const allowed = new Set<string>([...required, ...optional]);
  const extras = Object.keys(o).filter((k) => !allowed.has(k));
  expect(
    extras,
    `response contains undocumented fields: ${extras.join(", ")}`,
  ).toEqual([]);
}

// Every error response should use the same envelope. `code` is optional in the
// types but always present in our implementation — we check for both.
function expectErrorEnvelope(body: unknown) {
  const b = body as Record<string, unknown>;
  expect(typeof b.error, "error must be a string").toBe("string");
  expect(typeof b.code, "code must be a string").toBe("string");
}

// ============================================================
// POST /api/postcode/lookup
// ============================================================

test.describe("contract · POST /api/postcode/lookup", () => {
  test("happy path: SW1A 1AA returns the documented shape with ≥12 addresses", async ({
    request,
  }) => {
    const res = await request.post("/api/postcode/lookup", {
      data: { postcode: "SW1A 1AA" },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expectShape(body, REQUIRED.postcodeLookup);

    expect(body.postcode).toBe("SW1A 1AA");
    expect(Array.isArray(body.addresses)).toBe(true);
    expect(body.addresses.length).toBeGreaterThanOrEqual(12);

    for (const addr of body.addresses) {
      expectShape(addr, REQUIRED.address);
      expect(typeof addr.id).toBe("string");
      expect(typeof addr.line1).toBe("string");
      expect(typeof addr.city).toBe("string");
      expect(addr.id.length).toBeGreaterThan(0);
      expect(addr.line1.length).toBeGreaterThan(0);
      expect(addr.city.length).toBeGreaterThan(0);
    }
  });

  test("empty result: EC1A 1BB returns an empty addresses array, not 404", async ({
    request,
  }) => {
    const res = await request.post("/api/postcode/lookup", {
      data: { postcode: "EC1A 1BB" },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expectShape(body, REQUIRED.postcodeLookup);
    expect(body.addresses).toEqual([]);
  });

  test("missing postcode field returns 400 with error envelope", async ({
    request,
  }) => {
    const res = await request.post("/api/postcode/lookup", { data: {} });
    expect(res.status()).toBe(400);
    expectErrorEnvelope(await res.json());
  });

  test("invalid postcode format returns 422 with error envelope", async ({
    request,
  }) => {
    const res = await request.post("/api/postcode/lookup", {
      data: { postcode: "NOTAPOSTCODE" },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("invalid JSON body returns 400 with error envelope", async ({
    request,
  }) => {
    const res = await request.post("/api/postcode/lookup", {
      headers: { "content-type": "application/json" },
      data: "{ not valid json",
    });
    expect(res.status()).toBe(400);
    expectErrorEnvelope(await res.json());
  });
});

// ============================================================
// POST /api/waste-types
// ============================================================

test.describe("contract · POST /api/waste-types", () => {
  test("general waste returns exactly { ok: true }", async ({ request }) => {
    const res = await request.post("/api/waste-types", {
      data: {
        heavyWaste: false,
        plasterboard: false,
        plasterboardOption: null,
      },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expectShape(body, REQUIRED.wasteTypes);
    expect(body).toEqual({ ok: true });
  });

  test("heavy + plasterboard with valid option returns { ok: true }", async ({
    request,
  }) => {
    const res = await request.post("/api/waste-types", {
      data: {
        heavyWaste: true,
        plasterboard: true,
        plasterboardOption: "bagged-on-skip",
      },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("plasterboard=true without an option returns 422", async ({
    request,
  }) => {
    const res = await request.post("/api/waste-types", {
      data: {
        heavyWaste: false,
        plasterboard: true,
        plasterboardOption: null,
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("plasterboard=true with an unknown option value returns 422", async ({
    request,
  }) => {
    const res = await request.post("/api/waste-types", {
      data: {
        heavyWaste: false,
        plasterboard: true,
        plasterboardOption: "burn-it",
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("non-boolean heavyWaste returns 422", async ({ request }) => {
    const res = await request.post("/api/waste-types", {
      data: {
        heavyWaste: "yes",
        plasterboard: false,
        plasterboardOption: null,
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });
});

// ============================================================
// GET /api/skips
// ============================================================

test.describe("contract · GET /api/skips", () => {
  test("general waste returns 9 skips, all enabled, exact shape", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/skips?postcode=SW1A1AA&heavyWaste=false",
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expectShape(body, REQUIRED.skipsResponse);
    expect(Array.isArray(body.skips)).toBe(true);
    expect(body.skips).toHaveLength(9);

    for (const skip of body.skips) {
      expectShape(skip, REQUIRED.skip, ADDITIVE.skip);
      expect(typeof skip.size).toBe("string");
      expect(typeof skip.price).toBe("number");
      expect(skip.price).toBeGreaterThan(0);
      expect(typeof skip.disabled).toBe("boolean");
      expect(skip.disabled).toBe(false);
      // disabledReason should not appear on enabled skips.
      expect(skip).not.toHaveProperty("disabledReason");
    }
  });

  test("heavy waste disables ≥2 skips and includes disabledReason", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/skips?postcode=SW1A1AA&heavyWaste=true",
    );
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.skips).toHaveLength(9);

    const disabled = body.skips.filter((s: { disabled: boolean }) => s.disabled);
    expect(disabled.length).toBeGreaterThanOrEqual(2);

    for (const skip of disabled) {
      expectShape(skip, REQUIRED.skip, ADDITIVE.skip);
      expect(typeof skip.disabledReason).toBe("string");
      expect(skip.disabledReason.length).toBeGreaterThan(0);
    }
  });

  test("missing postcode query param returns 400", async ({ request }) => {
    const res = await request.get("/api/skips");
    expect(res.status()).toBe(400);
    expectErrorEnvelope(await res.json());
  });

  test("invalid postcode returns 422", async ({ request }) => {
    const res = await request.get("/api/skips?postcode=BAD&heavyWaste=false");
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });
});

// ============================================================
// POST /api/booking/confirm
// ============================================================

test.describe("contract · POST /api/booking/confirm", () => {
  test("happy path returns { status: 'success', bookingId: BK-NNNNN }", async ({
    request,
  }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "SW1A 1AA",
        addressId: "sw1a-1",
        heavyWaste: false,
        plasterboard: false,
        skipSize: "4-yard",
        price: 220,
      },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expectShape(body, REQUIRED.bookingConfirm, ADDITIVE.bookingConfirm);
    expect(body.status).toBe("success");
    expect(body.bookingId).toMatch(/^BK-\d{5}$/);
  });

  test("dedupe: identical submission within 10s returns the same bookingId", async ({
    request,
  }) => {
    const payload = {
      postcode: "SW1A 1AA",
      addressId: "sw1a-2",
      heavyWaste: false,
      plasterboard: false,
      skipSize: "6-yard",
      price: 260,
    };

    const first = await request.post("/api/booking/confirm", { data: payload });
    const second = await request.post("/api/booking/confirm", {
      data: payload,
    });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const a = await first.json();
    const b = await second.json();

    expect(a.bookingId).toBe(b.bookingId);
    // First call should NOT carry the additive marker; second call should.
    expect(a).not.toHaveProperty("deduplicated");
    expect(b.deduplicated).toBe(true);
  });

  test("missing fields returns 422 with error envelope", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: { postcode: "SW1A 1AA" },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("invalid postcode returns 422", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "NOPE",
        addressId: "sw1a-1",
        heavyWaste: false,
        plasterboard: false,
        skipSize: "4-yard",
        price: 220,
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("unknown addressId returns 422", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "SW1A 1AA",
        addressId: "addr_does_not_exist",
        heavyWaste: false,
        plasterboard: false,
        skipSize: "4-yard",
        price: 220,
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("unknown skip size returns 422", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "SW1A 1AA",
        addressId: "sw1a-3",
        heavyWaste: false,
        plasterboard: false,
        skipSize: "999-yard",
        price: 220,
      },
    });
    expect(res.status()).toBe(422);
    expectErrorEnvelope(await res.json());
  });

  test("disabled skip (heavy + 14-yard) returns 409", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "SW1A 1AA",
        addressId: "sw1a-4",
        heavyWaste: true,
        plasterboard: false,
        skipSize: "14-yard",
        price: 420,
      },
    });
    expect(res.status()).toBe(409);
    expectErrorEnvelope(await res.json());
  });

  test("price tampering returns 409", async ({ request }) => {
    const res = await request.post("/api/booking/confirm", {
      data: {
        postcode: "SW1A 1AA",
        addressId: "sw1a-5",
        heavyWaste: false,
        plasterboard: false,
        skipSize: "8-yard",
        price: 1, // real price is 300
      },
    });
    expect(res.status()).toBe(409);
    expectErrorEnvelope(await res.json());
  });
});
