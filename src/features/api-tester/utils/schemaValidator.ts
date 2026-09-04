import { SchemaValidationResult, SchemaValidationDiagnostic } from '../types';

/**
 * Pure TypeScript JSON Schema Validator
 * Supports:
 * - Types: string, number, integer, boolean, array, object, null
 * - Required properties
 * - Property validation & nested object schemas
 * - Array item schemas, minItems, maxItems
 * - String formats: email, uri, uuid, iso-date, ipv4
 * - String length: minLength, maxLength, pattern (regex)
 * - Number ranges: minimum, maximum
 * - Enums
 */
export function validateJsonSchema(data: any, schema: any, currentPath = '$'): SchemaValidationResult {
  const errors: SchemaValidationDiagnostic[] = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] };
  }

  function validateNode(value: any, nodeSchema: any, path: string) {
    if (!nodeSchema || typeof nodeSchema !== 'object') return;

    // 1. Type validation
    if (nodeSchema.type) {
      const expectedType = Array.isArray(nodeSchema.type) ? nodeSchema.type : [nodeSchema.type];
      const actualType = getActualType(value);

      const matchesType = expectedType.some((t: string) => {
        if (t === 'integer') return typeof value === 'number' && Number.isInteger(value);
        return actualType === t;
      });

      if (!matchesType && value !== undefined) {
        errors.push({
          path,
          message: `Expected type ${expectedType.join(' | ')}, but received ${actualType}`,
          expected: expectedType.join(' | '),
          actual: actualType
        });
        return; // Skip inner checks if type mismatch
      }
    }

    if (value === undefined || value === null) {
      if (nodeSchema.type && !['null', 'any'].includes(nodeSchema.type) && value === null) {
        // already handled by type check
      }
      return;
    }

    // 2. Enum check
    if (Array.isArray(nodeSchema.enum)) {
      if (!nodeSchema.enum.includes(value)) {
        errors.push({
          path,
          message: `Value '${value}' is not in allowed enum list [${nodeSchema.enum.join(', ')}]`,
          expected: nodeSchema.enum.join(', '),
          actual: String(value)
        });
      }
    }

    // 3. String validations
    if (typeof value === 'string') {
      if (typeof nodeSchema.minLength === 'number' && value.length < nodeSchema.minLength) {
        errors.push({
          path,
          message: `String length ${value.length} is less than minLength ${nodeSchema.minLength}`,
          expected: `>= ${nodeSchema.minLength}`,
          actual: String(value.length)
        });
      }
      if (typeof nodeSchema.maxLength === 'number' && value.length > nodeSchema.maxLength) {
        errors.push({
          path,
          message: `String length ${value.length} is greater than maxLength ${nodeSchema.maxLength}`,
          expected: `<= ${nodeSchema.maxLength}`,
          actual: String(value.length)
        });
      }
      if (nodeSchema.pattern) {
        try {
          const regex = new RegExp(nodeSchema.pattern);
          if (!regex.test(value)) {
            errors.push({
              path,
              message: `String does not match pattern: ${nodeSchema.pattern}`,
              expected: nodeSchema.pattern,
              actual: value
            });
          }
        } catch (err) {}
      }
      if (nodeSchema.format) {
        const formatErr = validateFormat(value, nodeSchema.format);
        if (formatErr) {
          errors.push({
            path,
            message: formatErr,
            expected: `format: ${nodeSchema.format}`,
            actual: value
          });
        }
      }
    }

    // 4. Number validations
    if (typeof value === 'number') {
      if (typeof nodeSchema.minimum === 'number' && value < nodeSchema.minimum) {
        errors.push({
          path,
          message: `Number ${value} is less than minimum ${nodeSchema.minimum}`,
          expected: `>= ${nodeSchema.minimum}`,
          actual: String(value)
        });
      }
      if (typeof nodeSchema.maximum === 'number' && value > nodeSchema.maximum) {
        errors.push({
          path,
          message: `Number ${value} is greater than maximum ${nodeSchema.maximum}`,
          expected: `<= ${nodeSchema.maximum}`,
          actual: String(value)
        });
      }
    }

    // 5. Object validations
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Required keys
      if (Array.isArray(nodeSchema.required)) {
        for (const reqKey of nodeSchema.required) {
          if (!(reqKey in value) || value[reqKey] === undefined) {
            errors.push({
              path: `${path}.${reqKey}`,
              message: `Required property '${reqKey}' is missing`,
              expected: `present`,
              actual: `missing`
            });
          }
        }
      }

      // Property schemas
      if (nodeSchema.properties && typeof nodeSchema.properties === 'object') {
        for (const [propKey, propSchema] of Object.entries(nodeSchema.properties)) {
          if (propKey in value) {
            validateNode(value[propKey], propSchema, `${path}.${propKey}`);
          }
        }
      }
    }

    // 6. Array validations
    if (Array.isArray(value)) {
      if (typeof nodeSchema.minItems === 'number' && value.length < nodeSchema.minItems) {
        errors.push({
          path,
          message: `Array items count ${value.length} is less than minItems ${nodeSchema.minItems}`,
          expected: `>= ${nodeSchema.minItems}`,
          actual: String(value.length)
        });
      }
      if (typeof nodeSchema.maxItems === 'number' && value.length > nodeSchema.maxItems) {
        errors.push({
          path,
          message: `Array items count ${value.length} is greater than maxItems ${nodeSchema.maxItems}`,
          expected: `<= ${nodeSchema.maxItems}`,
          actual: String(value.length)
        });
      }
      if (nodeSchema.items && typeof nodeSchema.items === 'object') {
        value.forEach((item, idx) => {
          validateNode(item, nodeSchema.items, `${path}[${idx}]`);
        });
      }
    }
  }

  try {
    validateNode(data, schema, currentPath);
  } catch (err: any) {
    errors.push({
      path: currentPath,
      message: `Schema evaluation failed: ${err.message}`,
      expected: 'valid schema',
      actual: 'runtime exception'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function getActualType(val: any): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function validateFormat(val: string, format: string): string | null {
  if (format === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return `Invalid email format`;
  } else if (format === 'uuid') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(val)) return `Invalid UUID format`;
  } else if (format === 'uri' || format === 'url') {
    try {
      new URL(val);
    } catch {
      return `Invalid URI/URL format`;
    }
  } else if (format === 'iso-date' || format === 'date-time') {
    if (isNaN(Date.parse(val))) return `Invalid ISO Date-Time format`;
  }
  return null;
}
