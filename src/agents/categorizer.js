// ========================================
// AGENT 4: CATEGORIZER - Categoriza produtos
// ========================================

import { openAIClient } from '../lib/openai.js';
import { logEvent } from '../lib/logger.js';

/**
 * Determina categorias ótimas para o produto
 * @param {Object} product - Dados do produto
 * @param {Object} analysis - Análise do produto
 * @returns {Promise<Object>} Categorias recomendadas
 */
export async function categorizeProduct(product, analysis) {
  const startTime = Date.now();
  
  try {
    console.log(`[Categorizer] Categorizando produto ${product.id}...`);
    
    // Chamar OpenAI para categorização
    const response = await openAIClient.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em categorização de produtos e-commerce.
Determine as melhores categorias, tags e coleções para um produto.`
        },
        {
          role: 'user',
          content: `
Categorize este produto:

## PRODUTO
- Título: ${product.title}
- Tipo: ${product.product_type || 'Não definido'}
- Vendor: ${product.vendor || 'Não definido'}
- Tags atuais: ${product.tags?.join(', ') || 'Nenhuma'}

## ANÁLISE
- Keywords: ${analysis?.keywords?.join(', ') || 'N/A'}
- Intenção de compra: ${analysis?.target_intent || 'N/A'}

## SAÍDA (JSON)
{
  "primary_category": "categoria principal",
  "secondary_categories": ["categoria 2", "categoria 3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  ".collections": ["coleção 1"],
  "product_type": "tipo personalizado",
  "vendor": "vendor sugerido"
}
`
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    const duration = Date.now() - startTime;
    
    await logEvent('categorizer', 'categorize_product', 'success', {
      product_id: product.id,
      primary_category: result.primary_category,
      tags_count: result.tags?.length || 0
    }, duration);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('categorizer', 'categorize_product', 'error', {
      product_id: product.id,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Sugere tags baseadas em tendências
 * @param {Object} product - Dados do produto
 * @returns {Promise<Array<string>>} Tags sugeridas
 */
export async function suggestTags(product) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'Sugira tags relevantes para produtos baseadas em tendências de mercado.'
      },
      {
        role: 'user',
        content: `
Sugira 10 tags para:
- Produto: ${product.title}
- Tipo: ${product.product_type || 'generic'}

Considere: SEO, tendências, palavras-chave de busca.
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result.tags || [];
}

/**
 * Mapeia produto para coleções existentes
 * @param {Object} product - Dados do produto
 * @param {Array<Object>} collections - Coleções disponíveis
 * @returns {Promise<Array<string>>} Coleções compatíveis
 */
export async function mapToCollections(product, collections) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'Mapeie produtos para coleções relevantes.'
      },
      {
        role: 'user',
        content: `
Qual(is) coleção(ões) este produto pertence?

## PRODUTO
- Título: ${product.title}
- Tipo: ${product.product_type || 'generic'}
- Tags: ${product.tags?.join(', ') || 'none'}

## COLEÇÕES DISPONÍVEIS
${collections.map(c => `- ${c.title}`).join('\n')}

Responda em JSON: { "collections": ["coleção 1", "coleção 2"] }
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result.collections || [];
}

export default {
  categorizeProduct,
  suggestTags,
  mapToCollections
};