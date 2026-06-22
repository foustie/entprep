import { describe, it, expect } from "vitest";
import { deriveRcTxId } from "../revenuecat-webhook.mjs";

describe("deriveRcTxId (RevenueCat idempotency key)", () => {
  it("derives a stable per-event id from event.id", () => {
    expect(deriveRcTxId({ id: "abc123", type: "RENEWAL" })).toBe("rc_abc123");
  });

  it("returns null when event.id is missing (no eventType fallback)", () => {
    // Critical: must NOT collapse to rc_RENEWAL — that would dedupe distinct
    // renewals into one payment row.
    expect(deriveRcTxId({ type: "RENEWAL" })).toBeNull();
    expect(deriveRcTxId({ id: "", type: "INITIAL_PURCHASE" })).toBeNull();
    expect(deriveRcTxId({})).toBeNull();
    expect(deriveRcTxId(null)).toBeNull();
    expect(deriveRcTxId(undefined)).toBeNull();
  });

  it("yields the same key for a replayed event (idempotent)", () => {
    const event = { id: "evt_999", type: "INITIAL_PURCHASE" };
    expect(deriveRcTxId(event)).toBe(deriveRcTxId(event));
  });

  it("yields distinct keys for distinct events of the same type", () => {
    const a = deriveRcTxId({ id: "r1", type: "RENEWAL" });
    const b = deriveRcTxId({ id: "r2", type: "RENEWAL" });
    expect(a).not.toBe(b);
  });
});
