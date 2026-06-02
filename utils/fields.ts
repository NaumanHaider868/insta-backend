export function isEmpty(fields: unknown[]): boolean {
  for (const field of fields) {
    if (field === undefined || field === null || field === '') {
      return true;
    }
  }
  return false;
}

export const sanitizeFields = <T extends object>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, val]) => val !== undefined && val !== '' && val !== null)
  ) as T;

type Primitive = string | number | boolean;
type JsonValue = Primitive | JsonValue[] | { [key: string]: JsonValue };

export const deepSanitize = <T extends JsonValue>(obj: T): T => {
  const isEmpty = (val: JsonValue): boolean => {
    if (val === undefined || val === null || val === '') return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  };

  if (Array.isArray(obj)) {
    const sanitizedArray = obj.map((item) => deepSanitize(item)).filter((item) => !isEmpty(item));

    return sanitizedArray as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const entries = Object.entries(obj)
      .map(([key, val]) => [key, deepSanitize(val)] as const)
      .filter(([, val]) => !isEmpty(val));

    return Object.fromEntries(entries) as T;
  }

  return obj;
};
