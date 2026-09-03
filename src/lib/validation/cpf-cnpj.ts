// The ticket "cpf" field also stores a CNPJ for B2B marketplace sales (the
// Mercado Livre extension extracts either one into it), so this validates
// both document types by their real check digits — not just string length.

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasAllSameDigit(digits: string) {
  return digits.split("").every((digit) => digit === digits[0]);
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || hasAllSameDigit(digits)) return false;

  const numbers = digits.split("").map(Number);

  const firstCheck = (() => {
    const sum = numbers.slice(0, 9).reduce((acc, digit, index) => acc + digit * (10 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  })();

  if (firstCheck !== numbers[9]) return false;

  const secondCheck = (() => {
    const sum = numbers.slice(0, 10).reduce((acc, digit, index) => acc + digit * (11 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  })();

  return secondCheck === numbers[10];
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || hasAllSameDigit(digits)) return false;

  const numbers = digits.split("").map(Number);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const checkDigit = (values: number[], weights: number[]) => {
    const sum = values.reduce((acc, digit, index) => acc + digit * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = checkDigit(numbers.slice(0, 12), firstWeights);
  if (firstCheck !== numbers[12]) return false;

  const secondCheck = checkDigit(numbers.slice(0, 13), secondWeights);
  return secondCheck === numbers[13];
}

export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}
