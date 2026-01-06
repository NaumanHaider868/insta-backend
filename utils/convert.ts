const toSafeString = <T extends string | number | boolean | null | undefined>(val: T): string => {
  return val ? String(val) : '';
};

const toSafeNumber = <T extends string | number | boolean | null | undefined>(val: T): number => {
  return val ? Number(val) : 0;
};

const toSafeBoolean = <T extends boolean | number | string | null | undefined>(val: T): boolean => {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return val.toLowerCase() !== 'false' && val !== '0';
  return false;
};

const toSafeJson = <T extends string | number | boolean | null | undefined>(val: T): string => {
  return val ? JSON.stringify(val) : '';
};

const toSafeParsed = <T extends object>(val: string, fallback: T = {} as T): T => {
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
};
const toSafeStringifyParsed = <T extends object>(val: T, fallback: T = {} as T): T => {
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return fallback;
  }
};

export {
  toSafeString,
  toSafeNumber,
  toSafeBoolean,
  toSafeJson,
  toSafeParsed,
  toSafeStringifyParsed,
};
