import { describe, expect, it } from "vitest";
import { phoneProblem } from "./inbound-numbers";

describe("inbound number format", () => {
  it.each(["+918037091588", "+919513886363", "+14155550123", "+442071838750"])(
    "accepts %s",
    (phone) => {
      expect(phoneProblem(phone)).toBeNull();
    },
  );

  it("catches +91 followed by a national number with its trunk 0, and suggests the fix", () => {
    expect(phoneProblem("+9109513886363")).toBe(
      "Indian numbers are +91 followed by ten digits, without the leading 0. Did you mean +919513886363?",
    );
  });

  it("catches an Indian number with the wrong number of digits", () => {
    expect(phoneProblem("+91951388636")).toBe(
      "Indian numbers are +91 followed by exactly ten digits.",
    );
    expect(phoneProblem("+91951388636399")).toBe(
      "Indian numbers are +91 followed by exactly ten digits.",
    );
  });

  it("asks for international format when there is no +", () => {
    for (const phone of [
      "08037091588",
      "918037091588",
      "8037091588",
      "+0918037091588",
      "",
      "+91 80370 91588",
    ]) {
      expect(phoneProblem(phone)).toBe(
        "Enter the number in international format, for example +918047491899.",
      );
    }
  });
});
