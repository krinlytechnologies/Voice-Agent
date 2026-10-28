// Shape checks for the number an inbound route is published for. Browser-safe: the same rule runs in the
// form, in the server function and (for +91) in the voice engine, so a typo is caught where it is made.

const E164 = /^\+[1-9][0-9]{9,14}$/;
const INDIAN_NUMBER = /^\+91[1-9][0-9]{9}$/;

/** Why a number cannot be right, or null if it is acceptable. */
export function phoneProblem(phone: string): string | null {
  if (!E164.test(phone)) {
    return "Enter the number in international format, for example +918047491899.";
  }
  if (phone.startsWith("+91") && !INDIAN_NUMBER.test(phone)) {
    const local = phone.slice(3);
    return local.startsWith("0")
      ? `Indian numbers are +91 followed by ten digits, without the leading 0. Did you mean +91${local.slice(1)}?`
      : "Indian numbers are +91 followed by exactly ten digits.";
  }
  return null;
}
