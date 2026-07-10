import { z } from 'zod'
import type { FormFieldAttrs } from '@/types/database'

/**
 * Whether a field should be collected on the fill-details wizard step.
 * Approver signatures are collected later during approval; initiator signatures
 * are collected here.
 */
export function isFillDetailsField(field: FormFieldAttrs): boolean {
  if (field.fieldType !== 'signature') return true
  return field.signatureRole === 'initiator'
}

/**
 * Builds a Zod object schema keyed by fieldId for every fill-details field
 * (including the initiator signature). Approver signatures are excluded.
 */
export function buildFieldValuesSchema(fields: FormFieldAttrs[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    if (!isFillDetailsField(field)) continue
    shape[field.fieldId] = buildFieldSchema(field)
  }

  return z.object(shape)
}

function buildFieldSchema(field: FormFieldAttrs): z.ZodTypeAny {
  switch (field.fieldType) {
    case 'signature': {
      return z
        .string()
        .min(1, { message: `${field.label} is required` })
        .refine((value) => value.startsWith('data:image/'), {
          message: `Please sign in the ${field.label.toLowerCase()} box`,
        })
    }
    case 'number': {
      const base = z
        .string()
        .refine((value) => value.trim() === '' || !Number.isNaN(Number(value)), {
          message: 'Enter a valid number',
        })
      return field.required
        ? base.refine((value) => value.trim() !== '', { message: `${field.label} is required` })
        : base.optional()
    }
    case 'checkbox': {
      return field.required
        ? z.boolean().refine((value) => value === true, {
            message: `You must check "${field.label}" to continue`,
          })
        : z.boolean().optional()
    }
    case 'dropdown': {
      return field.required
        ? z.string().min(1, { message: `Please select ${field.label.toLowerCase()}` })
        : z.string().optional()
    }
    case 'date':
    case 'file':
    case 'text':
    default: {
      return field.required
        ? z.string().trim().min(1, { message: `${field.label} is required` })
        : z.string().optional()
    }
  }
}

/** Sensible per-field-type empty default so every field is a controlled input from the start. */
export function getFieldDefaultValue(field: FormFieldAttrs): unknown {
  return field.fieldType === 'checkbox' ? false : ''
}

/** Converts raw form string values (e.g. "42" for a number field) into the shape stored in documents.data. */
export function normalizeFieldValue(field: FormFieldAttrs, rawValue: unknown): unknown {
  if (field.fieldType === 'signature') {
    return typeof rawValue === 'string' && rawValue.startsWith('data:image/') ? rawValue : undefined
  }
  if (field.fieldType === 'number') {
    if (typeof rawValue !== 'string' || rawValue.trim() === '') return undefined
    const parsed = Number(rawValue)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  if (field.fieldType === 'checkbox') {
    return Boolean(rawValue)
  }
  if (typeof rawValue === 'string' && rawValue.trim() === '') {
    return undefined
  }
  return rawValue
}
