// PAY-7: regression test for the payments unique-violation (23505) idempotency helper
// in netlify/functions/utils/shared.mjs. A duplicate kaspi_tx_id INSERT must be treated
// as success (no throw, no double-grant) so webhook retries / double-fires don't error.
import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs Netlify function, no type declarations
import { isDuplicatePaymentResponse } from "../../../netlify/functions/utils/shared.mjs";

describe("isDuplicatePaymentResponse", () => {
  it("treats a PostgREST 409 as a duplicate (idempotent success)", () => {
    expect(isDuplicatePaymentResponse(409, "")).toBe(true);
  });

  it("treats a body containing the 23505 unique-violation code as a duplicate", () => {
    const body = '{"code":"23505","message":"duplicate key value violates unique constraint"}';
    expect(isDuplicatePaymentResponse(400, body)).toBe(true);
  });

  it("does NOT treat an unrelated error as a duplicate", () => {
    expect(isDuplicatePaymentResponse(500, "Internal Server Error")).toBe(false);
    expect(isDuplicatePaymentResponse(400, '{"code":"23502"}')).toBe(false);
  });

  it("does NOT treat a successful (200/201) insert as a duplicate", () => {
    expect(isDuplicatePaymentResponse(201, "")).toBe(false);
  });

  it("handles a missing/undefined body without throwing", () => {
    expect(isDuplicatePaymentResponse(409, undefined as unknown as string)).toBe(true);
    expect(isDuplicatePaymentResponse(500, undefined as unknown as string)).toBe(false);
  });
});
