import { describe, expect, it } from "vitest";
import { generateQrs } from "./qr";

describe("QR generation", () => {
  it("isolates an oversized URL so other links and backups remain available", async () => {
    let errors: string[] = [];
    const result = await generateQrs(
      [
        {
          id: "ordinary",
          label: "Portfolio",
          url: "https://example.com",
          icon: "none",
        },
        {
          id: "oversized",
          label: "Long link",
          url: "https://example.com/" + "a".repeat(1900),
          icon: "none",
        },
      ],
      (ids) => {
        errors = ids;
      },
    );
    expect(result.ordinary).toMatch(/^data:image\/png;base64,/);
    expect(result.oversized).toBe("");
    expect(errors).toEqual(["oversized"]);
  });
});
