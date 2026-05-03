// ========================================
// AGENT 2: ANALYZER - Analisa produtos para otimização
// ========================================

import { openAIClient } from '../lib/openai.js';
import { logEvent } from '../lib/logger.js';
import { getSystemConfig } from '../lib/supabase.js';

/**
 * Analisa um produto e extrai insights para otimização
 * @param {Object} product - Dados do produto
 * @returns {Promise<Object>} Análise completa
 */
export async function analyzeProduct(product) {
  const startTime = Date.now();
  
  try {
    console.log(`[Analyzer] Analisando produto ${product.id}...`);
    
    // Obter configurações
    const config = await getSystemConfig('brand_voice');
    const audience = await getSystemConfig('target_audience');
    
    // Criar prompt de análise
    const analysisPrompt = createAnalysisPrompt(product, config, audience);
    
    // Chamar OpenAI para análise
    const analysis = await openAIClient.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em e-commerce e marketing de produtos. 
Analise produtos de loja virtual e sugira otimizações baseadas no público-alvo e voz da marca.`
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(analysis.choices[0].message.content);
    
    const duration = Date.now() - startTime;
    
    await logEvent('analyzer', 'analyze_product', 'success', {
      product_id: product.id,
      insights: result.insights || []
    }, duration);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('analyzer', 'analyze_product', 'error', {
      product_id: product.id,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Cria o prompt de análise
 */
function createAnalysisPrompt(product, config, audience) {
  return `
Analise o seguinte produto e forneça insights para otimização:

## INFORMAÇÕES DO PRODUTO
- Título: ${product.title}
- Descrição: ${product.body_html || product.description || 'Não disponível'}
- Tipo: ${product.product_type || 'Não definido'}
- Vendor: ${product.vendor || 'Não definido'}
- Tags: ${product.tags?.join(', ') || 'Nenhuma'}

## VARIANTES
${product.variants?.map(v => `
- ${v.title}: SKU ${v.sku}, Preço R$ ${v.price}, Estoque ${v.inventory_quantity}
`).join('\n') || 'Nenhuma variante'}

## IMAGENS
${product.images?.length || 0} imagem(ns) disponível(is)

## COLEÇÕES
${product.collections?.map(c => c.title).join(', ') || 'Nenhuma'}

## VOZ DA MARCA
- Tom: ${config?.tone || 'profissional'}
- Estilo: ${config?.style || 'elegante'}

## PÚBLICO-ALVO
- Idade: ${audience?.age || '25-40'}
- Gênero: ${audience?.gender || 'feminino'}
- Interesses: ${audience?.interests?.join(', ') || 'moda, beleza'}

## SAÍDA (JSON)
Forneça um JSON com:
{
  "strengths": ["pontos fortes do produto"],
  "weaknesses": ["pontos fracos ou oportunidades"],
  "keywords": ["palavras-chave relevantes"],
  "target_intent": "intenção de compra do público",
  "suggested_improvements": ["sugestões de otimização"],
  "seo_opportunities": ["oportunidades SEO"]
}
`;
}

/**
 * Analisa múltiplos produtos em lote
 * @param {Array<Object>} products - Array de produtos
 * @returns {Promise<Array<Object>>} Análises
 */
export async function analyzeProductsBatch(products) {
  const results = await Promise.allSettled(
    products.slice(0, 5).map(p => analyzeProduct(p)) // Máximo 5 por vez
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Extrai palavras-chave do produto
 * @param {Object} product - Dados do produto
 * @returns {Array<string>} Palavras-chave
 */
export async function extractKeywords(product) {
  const analysis = await analyzeProduct(product);
  return analysis.keywords || [];
}

export default {
  analyzeProduct,
  analyzeProductsBatch,
  extractKeywords
};