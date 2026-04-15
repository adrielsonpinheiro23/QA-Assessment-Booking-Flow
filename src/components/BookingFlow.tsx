"use client";

import { useState } from "react";
import type { Address, PlasterboardOption, Skip } from "@/lib/types";
import StepIndicator, { type StepId } from "./StepIndicator";
import PostcodeStep from "./PostcodeStep";
import WasteTypeStep from "./WasteTypeStep";
import SkipStep from "./SkipStep";
import ReviewStep from "./ReviewStep";
import ConfirmationStep from "./ConfirmationStep";

interface FlowState {
  step: StepId;
  postcode: string;
  address: Address | null;
  addressId: string | null;
  manualAddress: string;
  heavyWaste: boolean;
  plasterboard: boolean;
  plasterboardOption: PlasterboardOption | null;
  skip: Skip | null;
  bookingId: string | null;
}

const initialState: FlowState = {
  step: "postcode",
  postcode: "",
  address: null,
  addressId: null,
  manualAddress: "",
  heavyWaste: false,
  plasterboard: false,
  plasterboardOption: null,
  skip: null,
  bookingId: null,
};

export default function BookingFlow() {
  const [state, setState] = useState<FlowState>(initialState);

  const patch = (next: Partial<FlowState>) =>
    setState((prev) => ({ ...prev, ...next }));

  return (
    <div className="space-y-4">
      <StepIndicator current={state.step} />

      {state.step === "postcode" && (
        <PostcodeStep
          initialPostcode={state.postcode}
          initialAddressId={state.addressId}
          initialManualAddress={state.manualAddress}
          onContinue={({ postcode, addressId, manualAddress, address }) =>
            patch({
              step: "waste",
              postcode,
              addressId,
              manualAddress,
              address,
            })
          }
        />
      )}

      {state.step === "waste" && (
        <WasteTypeStep
          initial={{
            heavyWaste: state.heavyWaste,
            plasterboard: state.plasterboard,
            plasterboardOption: state.plasterboardOption,
          }}
          onBack={() => patch({ step: "postcode" })}
          onContinue={({ heavyWaste, plasterboard, plasterboardOption }) =>
            patch({
              step: "skip",
              heavyWaste,
              plasterboard,
              plasterboardOption,
              // Clear the previously selected skip if user toggled heavy waste.
              skip:
                state.heavyWaste === heavyWaste ? state.skip : null,
            })
          }
        />
      )}

      {state.step === "skip" && (
        <SkipStep
          postcode={state.postcode}
          heavyWaste={state.heavyWaste}
          initialSkipSize={state.skip?.size ?? null}
          onBack={() => patch({ step: "waste" })}
          onContinue={(skip) => patch({ step: "review", skip })}
        />
      )}

      {state.step === "review" && state.skip && (
        <ReviewStep
          postcode={state.postcode}
          address={state.address}
          manualAddress={state.manualAddress}
          heavyWaste={state.heavyWaste}
          plasterboard={state.plasterboard}
          plasterboardOption={state.plasterboardOption}
          skip={state.skip}
          onBack={() => patch({ step: "skip" })}
          onConfirmed={(bookingId) => patch({ step: "done", bookingId })}
        />
      )}

      {state.step === "done" && state.bookingId && (
        <ConfirmationStep
          bookingId={state.bookingId}
          onStartOver={() => setState(initialState)}
        />
      )}
    </div>
  );
}
