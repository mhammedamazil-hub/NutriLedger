import { generateJson, generateText, type RequestOptions } from './client';
import {
  ESTIMATE_SYSTEM,
  EXPLAIN_SYSTEM,
  MEAL_IDEAS_SYSTEM,
  PHOTO_SYSTEM,
  QA_SYSTEM,
  SUMMARY_SYSTEM,
} from './prompts';
import {
  mealIdeasJsonSchema,
  mealIdeasSchema,
  nutritionEstimateJsonSchema,
  nutritionEstimateSchema,
  type MealIdeas,
  type NutritionEstimate,
} from './schemas';

export const MAX_PROMPT_CHARS = 2000;

const clip = (s: string, max = MAX_PROMPT_CHARS) => s.trim().slice(0, max);

export function estimateFromDescription(
  opts: RequestOptions,
  description: string,
): Promise<NutritionEstimate> {
  return generateJson({
    ...opts,
    systemInstruction: ESTIMATE_SYSTEM,
    parts: [{ text: `Food description:\n"""${clip(description)}"""` }],
    jsonSchema: nutritionEstimateJsonSchema,
    schema: nutritionEstimateSchema,
  });
}

export function estimateFromPhoto(
  opts: RequestOptions,
  image: { mimeType: string; base64: string },
  note: string,
): Promise<NutritionEstimate> {
  return generateJson({
    ...opts,
    systemInstruction: PHOTO_SYSTEM,
    parts: [
      { inlineData: { mimeType: image.mimeType, data: image.base64 } },
      {
        text: note.trim()
          ? `Estimate the nutrition of the meal in this photo. User note:\n"""${clip(note, 500)}"""`
          : 'Estimate the nutrition of the meal in this photo.',
      },
    ],
    jsonSchema: nutritionEstimateJsonSchema,
    schema: nutritionEstimateSchema,
  });
}

export interface MealIdeasRequest {
  mealType: string;
  preferences: string;
  restrictions: string;
  ingredients: string;
}

export function buildMealIdeasPrompt(r: MealIdeasRequest): string {
  const lines = [`Meal type: ${clip(r.mealType, 40) || 'any'}`];
  if (r.preferences.trim()) lines.push(`Preferences: ${clip(r.preferences, 500)}`);
  if (r.restrictions.trim()) lines.push(`Dietary restrictions or allergies: ${clip(r.restrictions, 500)}`);
  if (r.ingredients.trim()) lines.push(`Ingredients available: ${clip(r.ingredients, 500)}`);
  return lines.join('\n');
}

export function suggestMeals(opts: RequestOptions, r: MealIdeasRequest): Promise<MealIdeas> {
  return generateJson({
    ...opts,
    systemInstruction: MEAL_IDEAS_SYSTEM,
    parts: [{ text: buildMealIdeasPrompt(r) }],
    jsonSchema: mealIdeasJsonSchema,
    schema: mealIdeasSchema,
    temperature: 0.8,
  });
}

/** `facts` is a locally generated, human-readable list of the exact computed values. */
export function explainCalculation(opts: RequestOptions, facts: string): Promise<string> {
  return generateText({
    ...opts,
    systemInstruction: EXPLAIN_SYSTEM,
    parts: [{ text: `Explain these already-computed results:\n${facts}` }],
  });
}

export function summarizeRecords(opts: RequestOptions, payload: string): Promise<string> {
  return generateText({
    ...opts,
    systemInstruction: SUMMARY_SYSTEM,
    parts: [{ text: payload }],
  });
}

export function askNutritionQuestion(opts: RequestOptions, question: string): Promise<string> {
  return generateText({
    ...opts,
    systemInstruction: QA_SYSTEM,
    parts: [{ text: `Question:\n"""${clip(question)}"""` }],
  });
}
