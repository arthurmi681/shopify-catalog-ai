// ========================================
// AGENT 5: VALIDATOR - Valida qualidade do conteúdo
// ========================================

import { openAIClient } from '../lib/openai.js';
import { logEvent } from '../lib/logger.js';
import { getSystemConfig } from '../lib/supabase.js';

/**
 * Valida se o conteúdo atende aos padrões de qualidade
 * @param {Object} product - Dados do produto com conteúdo otimizado
 * @returns {Promise<Object>} Resultado da validação
 */
export async function validateProduct(product) {
  const startTime = Date.now();
  
  try {
    console.log(`[Validator] Validando produto ${product.id}...`);
    
    // Obter thresholds de qualidade
    const thresholds = await getSystemConfig('quality_thresholds');
    const minScore = thresholds?.min_score || 70;
    
    // Criar prompt de validação
    const validationPrompt = createValidationPrompt(product, minScore);
    
    // Chamar OpenAI
    const response = await openAIClient.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em qualidade de conteúdo e-commerce.
Valide descrições de produtos e forn返回一个 score de 0-100.`
        },
        {
          role: 'user',
          content: validationPrompt
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    // Adicionar feedback baseado no score
    const passed = result.score >= minScore;
    
    const duration = Date.now() - startTime;
    
    await logEvent('validator', 'validate_product', passed ? 'success' : 'warning', {
      product_id: product.id,
      score: result.score,
      passed
    }, duration);
    
    return {
      ...result,
      pass_threshold: minScore,
      feedback: result.suggestions || []
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('validator', 'validate_product', 'error', {
      product_id: product.id,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Cria o prompt de validação
 */
function createValidationPrompt(product, minScore) {
  return `
Valide o seguinte conteúdo otimizado:

## PRODUTO
- Título: ${product.title}
- Descrição: ${product.description || product.body_html || 'Não disponível'}
- Meta description: ${product.meta_description || 'Não disponível'}
- Tags: ${product.tags?.join(', ') || 'Nenhuma'}
- Categorias: ${product.categories?.join(', ') || 'Nenhuma'}

## CRITÉRIOS DE AVALIAÇÃO (score mínimo: ${minScore})
1. Título: Direto, keyword-rich, até 60 caracteres (20 pontos)
2. Descrição: Persuasiva, estrutura HTML, benefícios claros (30 pontos)
3. SEO: Meta description keyword-optimized (15 pontos)
4. Tags: Relevantes e diversas (15 pontos)
5. Categorização: Correta e completa (20 pontos)

## SAÍDA (JSON)
{
  "score": 0-100,
  "title_check": { "passed": true/false, "feedback": "..." },
  "description_check": { "passed": true/false, "feedback": "..." },
  "seo_check": { "passed": true/false, "feedback": "..." },
  "tags_check": { "passed": true/false, "feedback": "..." },
  "category_check": { "passed": true/false, "feedback": "..." },
  "suggestions": ["sugestão 1", "sugestão 2"]
}
`;
}

/**
 * Valida especificamente o título
 * @param {string} title - Título a validar
 * @returns {Promise<Object>} Resultado
 */
export async function validateTitle(title) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'Valide títulos de produtos e-commerce.'
      },
      {
        role: 'user',
        content: `
Valide este título:
"${title}"

Critérios: keyword-rich, até 60 caracteres, direto.
Responda: { "valid": true/false, "score": 0-100, "feedback": "..." }
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

/**
 * Valida a descrição
 * @param {string} description - Descrição a validar
 * @returns {Promise<Object>} Resultado
 */
export async function validateDescription(description) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'Valide descrições de produtos e-commerce.'
      },
      {
        role: 'user',
        content: `
Valide esta descrição:
"${description.substring(0, 1000)}..."

Critérios: >= 150 palavras, HTML estruturado, benefícios claros, CTAs.
Responda: { "valid": true/false, "score": 0-100, "feedback": "..." }
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

/**
 * Valida imagens do produto
 * @param {Array<Object>} images - Imagens do produto
 * @returns {Promise<Object>} Resultado
 */
export async function validateImages(images) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'Valide imagens de produtos e-commerce.'
      },
      {
        role: 'user',
        content: `
Valide ${images?.length || 0} imagem(ns) do produto.

Critérios: No mínimo 3 imagens, boa qualidade, ângulos diversos.
Responda: { "valid": true/false, "score": 0-100, "feedback": "..." }
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

export default {
  validateProduct,
  validateTitle,
  validateDescription,
  validateImages
};