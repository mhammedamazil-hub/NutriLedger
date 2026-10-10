import { z } from 'zod';

const finiteRange = (min: number, max: number) =>
  z.number().refine((n) => Number.isFinite(n) && n >= min && n <= max, {
    message: `Expected a number between ${min} and ${max}.`,
  });

const shortText = (max: number) => z.string().trim().max(max);

/** Validated shape of a Gemini nutrition estimate (text or photo). */
export const nutritionEstimateSchema = z
  .object({
    status: z.enum(['estimate', 'needs_clarification']),
    food_name: shortText(120),
    portion_description: shortText(200),
    quantity: finiteRange(0, 100000).nullable(),
    unit: shortText(24),
    calories: finiteRange(0, 10000).nullable(),
    protein_g: finiteRange(0, 1000).nullable(),
    carbs_g: finiteRange(0, 1000).nullable(),
    fat_g: finiteRange(0, 1000).nullable(),
    fiber_g: finiteRange(0, 300).nullable(),
    confidence: z.enum(['low', 'medium', 'high']),
    assumptions: z.array(shortText(300)).max(12),
    clarifying_questions: z.array(shortText(300)).max(6),
  })
  .refine((v) => v.status !== 'estimate' || (v.calories !== null && v.food_name.length > 0), {
    message: 'An estimate must include a food name and calories.',
  })
  .refine((v) => v.status !== 'needs_clarification' || v.clarifying_questions.length > 0, {
    message: 'A clarification request must include at least one question.',
  });

export type NutritionEstimate = z.infer<typeof nutritionEstimateSchema>;

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };

/** JSON Schema sent to Gemini (responseJsonSchema). Zod above is the real gatekeeper. */
export const nutritionEstimateJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['estimate', 'needs_clarification'] },
    food_name: { type: 'string', description: 'Short name for the meal or food.' },
    portion_description: { type: 'string', description: 'The portion the numbers refer to, in words.' },
    quantity: { ...nullableNumber, description: 'Numeric amount of the portion, or null if unknown.' },
    unit: { type: 'string', description: 'Unit for quantity, e.g. g, ml, cup, piece, serving.' },
    calories: { ...nullableNumber, description: 'Estimated kcal for the whole portion.' },
    protein_g: nullableNumber,
    carbs_g: nullableNumber,
    fat_g: nullableNumber,
    fiber_g: nullableNumber,
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    assumptions: { type: 'array', items: { type: 'string' } },
    clarifying_questions: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'status',
    'food_name',
    'portion_description',
    'quantity',
    'unit',
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
    'fiber_g',
    'confidence',
    'assumptions',
    'clarifying_questions',
  ],
};

export const mealIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: shortText(120).min(1),
        summary: shortText(400),
        key_ingredients: z.array(shortText(80)).max(15),
        approx_calories: finiteRange(0, 5000).nullable(),
        prep_minutes: finiteRange(0, 600).nullable(),
      }),
    )
    .min(1)
    .max(6),
  caution_note: shortText(500),
});

export type MealIdeas = z.infer<typeof mealIdeasSchema>;

export const mealIdeasJsonSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          key_ingredients: { type: 'array', items: { type: 'string' } },
          approx_calories: nullableNumber,
          prep_minutes: nullableNumber,
        },
        required: ['name', 'summary', 'key_ingredients', 'approx_calories', 'prep_minutes'],
      },
    },
    caution_note: { type: 'string' },
  },
  required: ['ideas', 'caution_note'],
};
