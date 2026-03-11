import OpenAI from "openai";
const client = new OpenAI();

import { categoryService } from "./categoryService.js";

export const setCategorie = async (concepto, userId) => {
  try {
    const categories = await categoryService.list(userId);

    if (!categories || categories.length === 0) {
      throw new Error("No categories found for user");
    }

    // Reducimos la info que enviamos al modelo
    const formattedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4.1-nano",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Eres un asistente que clasifica gastos.

Recibirás:
- Una lista de categorías con id y name
- La descripción de un gasto (concepto)

Debes seleccionar SOLO una categoría de la lista.

Responde exclusivamente con este JSON:

{
  "categoryId": "id_de_la_categoria",
  "categoryName": "nombre_de_la_categoria"
}

Reglas:
- Solo puedes usar categorías de la lista.
- No inventes categorías.
- No devuelvas texto adicional.
- El id debe ser siempre numerico
`,
        },
        {
          role: "user",
          content: JSON.stringify({
            categories: formattedCategories,
            concepto,
          }),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error classifying category:", error);
    throw error;
  }
};
