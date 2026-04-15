// Shared domain types for the booking flow.
// These align with the API contract in the assessment PDF.

export interface Address {
  id: string;
  line1: string;
  city: string;
}

export interface PostcodeLookupRequest {
  postcode: string;
}

export interface PostcodeLookupResponse {
  postcode: string;
  addresses: Address[];
}

export type PlasterboardOption =
  | "bagged-on-skip"
  | "separate-collection"
  | "under-10-percent";

export interface WasteTypesRequest {
  heavyWaste: boolean;
  plasterboard: boolean;
  plasterboardOption: PlasterboardOption | null;
}

export interface WasteTypesResponse {
  ok: boolean;
}

export interface Skip {
  size: string;
  price: number;
  disabled: boolean;
  disabledReason?: string;
}

export interface SkipsResponse {
  skips: Skip[];
}

export interface BookingConfirmRequest {
  postcode: string;
  addressId: string;
  heavyWaste: boolean;
  plasterboard: boolean;
  plasterboardOption?: PlasterboardOption | null;
  skipSize: string;
  price: number;
}

export interface BookingConfirmResponse {
  status: "success";
  bookingId: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
