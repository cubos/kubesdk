import AJV from "ajv";

export class SchemaValidationError extends Error {}

export function validate(schema: object, data: any) {
  const ajv = new AJV({
    allErrors: true,
    format: false,
    coerceTypes: true,
  });
  const valid = ajv.validate(schema, data);

  if (!valid) {
    throw new SchemaValidationError(ajv.errorsText());
  }
}

export function _throw(error: Error): never {
  throw error;
}
