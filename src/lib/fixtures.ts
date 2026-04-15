// Deterministic fixtures required by the assessment.
// A postcode is normalized by stripping all whitespace and upper-casing
// before lookup. All postcode comparisons happen against this normalized form.

import type { Address, Skip } from "./types";

export function normalizePostcode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidUkPostcode(input: string): boolean {
  // UK postcode regex, tolerant of spacing and casing.
  // Covers the mainland formats: A9 9AA, A9A 9AA, A99 9AA, AA9 9AA, AA9A 9AA, AA99 9AA
  const re =
    /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  return re.test(input.trim());
}

// 12 addresses for SW1A 1AA (requirement: >=12).
const SW1A_ADDRESSES: Address[] = [
  { id: "sw1a-1", line1: "10 Downing Street", city: "London" },
  { id: "sw1a-2", line1: "11 Downing Street", city: "London" },
  { id: "sw1a-3", line1: "12 Downing Street", city: "London" },
  { id: "sw1a-4", line1: "Horse Guards Parade", city: "London" },
  { id: "sw1a-5", line1: "Buckingham Palace", city: "London" },
  { id: "sw1a-6", line1: "St James's Palace", city: "London" },
  { id: "sw1a-7", line1: "Clarence House", city: "London" },
  { id: "sw1a-8", line1: "Westminster Abbey", city: "London" },
  { id: "sw1a-9", line1: "Houses of Parliament", city: "London" },
  { id: "sw1a-10", line1: "Portcullis House", city: "London" },
  { id: "sw1a-11", line1: "The Cabinet Office, 70 Whitehall", city: "London" },
  { id: "sw1a-12", line1: "HM Treasury, 1 Horse Guards Road", city: "London" },
  { id: "sw1a-13", line1: "Admiralty House", city: "London" },
];

// Map of normalized postcode -> addresses.
export const ADDRESS_FIXTURES: Record<string, Address[]> = {
  SW1A1AA: SW1A_ADDRESSES,
  // EC1A 1BB is explicitly empty to exercise the empty state.
  EC1A1BB: [],
  // M1 1AE simulates latency — still returns addresses after a delay.
  M11AE: [
    { id: "m1-1", line1: "1 Piccadilly Gardens", city: "Manchester" },
    { id: "m1-2", line1: "2 Piccadilly Gardens", city: "Manchester" },
    { id: "m1-3", line1: "14 Oxford Road", city: "Manchester" },
    { id: "m1-4", line1: "22 Deansgate", city: "Manchester" },
    { id: "m1-5", line1: "45 Market Street", city: "Manchester" },
  ],
  // BS1 4DJ succeeds on retry — the 500 is simulated in the API route via a counter.
  BS14DJ: [
    { id: "bs1-1", line1: "Bristol Harbourside", city: "Bristol" },
    { id: "bs1-2", line1: "45 Queen Square", city: "Bristol" },
    { id: "bs1-3", line1: "Cabot Tower, Brandon Hill", city: "Bristol" },
  ],
  // A generic fallback postcode for manual exploration.
  LS16AH: [
    { id: "ls1-1", line1: "1 Briggate", city: "Leeds" },
    { id: "ls1-2", line1: "42 Wellington Street", city: "Leeds" },
    { id: "ls1-3", line1: "8 Park Row", city: "Leeds" },
  ],
};

// 9 skip sizes — satisfies ">= 8 with mixed enabled/disabled states".
// Heavy waste disables sizes >= 14-yard (4 disabled), per the "at least 2" requirement.
export function buildSkips(heavyWaste: boolean): Skip[] {
  const base: Array<{ size: string; price: number }> = [
    { size: "4-yard", price: 220 },
    { size: "6-yard", price: 260 },
    { size: "8-yard", price: 300 },
    { size: "10-yard", price: 340 },
    { size: "12-yard", price: 380 },
    { size: "14-yard", price: 420 },
    { size: "16-yard", price: 460 },
    { size: "20-yard", price: 540 },
    { size: "40-yard", price: 680 },
  ];

  return base.map((s) => {
    const heavyDisabled =
      heavyWaste &&
      ["14-yard", "16-yard", "20-yard", "40-yard"].includes(s.size);
    return {
      size: s.size,
      price: s.price,
      disabled: heavyDisabled,
      disabledReason: heavyDisabled
        ? "Not available for heavy waste due to weight limits."
        : undefined,
    };
  });
}

// Latency & error simulation is keyed by normalized postcode.
export const LATENCY_POSTCODES = new Set(["M11AE"]);
export const RETRY_POSTCODES = new Set(["BS14DJ"]);
