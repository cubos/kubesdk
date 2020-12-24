import AJV from "ajv";

export class SchemaValidationError extends Error {}

export function validate(schema: unknown, data: unknown) {
  const ajv = new AJV({
    allErrors: true,
    format: false,
    coerceTypes: true,
  });

  if (typeof schema !== "object" || !schema) {
    throw new SchemaValidationError("invalid schema");
  }

  const valid = ajv.validate(schema, JSON.parse(JSON.stringify(data)));

  if (!valid) {
    throw new SchemaValidationError(ajv.errorsText());
  }
}

export function has<P extends PropertyKey>(target: object, property: P): target is { [K in P]: unknown } {
  return property in target;
}

export function throwError(error: Error): never {
  throw error;
}

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type DeepReadonly<T> = T extends string | number | boolean | undefined | null
  ? T
  : {
      readonly [P in keyof T]: DeepReadonly<T[P]>;
    };

export type DeepUnReadonly<T> = T extends string | number | boolean | undefined | null
  ? T
  : {
      -readonly [P in keyof T]: DeepUnReadonly<T[P]>;
    };
