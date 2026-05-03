// ========================================
// AGENT 3: COPYWRITER - Reescreve textos para otimização
// ========================================

import { openAIClient } from '../lib/openai.js';
import { logEvent } from '../lib/logger.js';
import { getSystemConfig } from '../lib/supabase.js';

/**
 * Reescreve o conteúdo do produto para melhor conversão
 * @param {Object} product - Dados do produto
 * @param {Object} analysis - Análise do produto
 * @param {Object} feedback - Feedback de validação (opcional)
 * @returns {Promise<Object>} Conteúdo otimizado
 */
export async function rewriteContent(product, analysis, feedback = null) {
  const startTime = Date.now();
  
  try {
    console.log(`[Copywriter] Reescrevendo produto ${product.id}...`);
    
    // Obter configurações
    const config = await getSystemConfig('brand_voice');
    const settings = await getSystemConfig('openai_settings');
    
    // Criar prompt de reescrita
    const rewritePrompt = createRewritePrompt(product, analysis, config, feedback);
    
    // Chamar OpenAI
    const response = await openAIClient.chat.completions.create({
      model: settings?.model || 'gpt-4o',
      temperature: settings?.temperature || 0.7,
      max_tokens: settings?.max_tokens || 2000,
      messages: [
        {
          role: 'system',
          content: `Você é um copywriter especializado em e-commerce.
Escreva descrições de produtos persuasivas, em português brasileiro, 
que conversem diretamente com o público-alvo e impulsionem vendas.`
        },
        {
          role: 'user',
          content: rewritePrompt
        }
      ],
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    const duration = Date.now() - startTime;
    
    await logEvent('copywriter', 'rewrite_content', 'success', {
      product_id: product.id,
      title_length: result.title?.length || 0,
      description_length: result.description?.length || 0
    }, duration);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('copywriter', 'rewrite_content', 'error', {
      product_id: product.id,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Cria o prompt de reescrita
 */
function createRewritePrompt(product, analysis, config, feedback) {
  const feedbackSection = feedback ? `
## FEEDBACK DE VALIDAÇÃO (ajuste conforme necessário)
- Score atual: ${feedback.score}
- Observações: ${feedback.feedback?.join(', ') || 'Nenhuma'}
` : '';
  
  return `
Reescreva o conteúdo do produto para torná-lo mais atrativo e persuasivo:

## PRODUTO ORIGINAL
- Título atual: ${product.title}
- Descrição atual: ${product.body_html || product.description || 'Não disponível'}

## ANÁLISE DO PRODUTO
- Pontos fortes: ${analysis?.strengths?.join(', ') || 'N/A'}
- Intenção de compra: ${analysis?.target_intent || 'N/A'}
- Sugestões: ${analysis?.suggested_improvements?.join(', ') || 'N/A'}
- Keywords: ${analysis?.keywords?.join(', ') || 'N/A'}
${feedbackSection}

## VOZ DA MARCA
- Tom: ${config?.tone || 'profissional e acolhedor'}
- Estilo: ${config?.style || 'elegante'}

## REQUISITOS
1. Título: Máximo 60 caracteres, direto e.keyword rich
2. Descrição: Mínimo 150 palavras, estrutura HTML (<p>, <ul>, <li>)
3. Inclua benefícios, características Técnicas e CTA
4. Use HTML semântico para melhor indexação

## SAÍDA (JSON)
{
  "title": "Novo título otimizado",
  "description": "Nova descrição HTML",
  "meta_description": "Meta description para SEO (até 160 caracteres)",
  "tags": ["tag1", "tag2", "tag3"]
}
`;
}

/**
 * Reescreve titles para testes A/B
 * @param {Object} product - Dados do produto
 * @param {number} variants - Número de variações
 * @returns {Promise<Array<string>>} Titles alternativos
 */
export async function rewriteTitles(product, variants = 3) {
  const analysis = await analyzeProductWrapper(product);
  
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.9,
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em marketing. Crie títulos alternativos para produtos.'
      },
      {
        role: 'user',
        content: `
Crie ${variants} títulos alternativos para:
- Produto: ${product.title}
- Keywords relevantes: ${analysis?.keywords?.join(', ') || ''}
- Tom: profissional

Cada título deve ter no máximo 60 caracteres.
`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result.titles || [];
}

async function analyzeProductWrapper(product) {
  // Função auxiliar simplificada
  return { keywords: [], strengths: [] };
}

/**
 * Gera bullet points para variações
 * @param {Object} variant - Dados da variante
 * @returns {Promise<string>} Bullet points
 */
export async function rewriteVariantbullets(variant) {
  const response = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'Crie bullet points persuasivos para variações de produtos.'
      },
      {
        role: 'user',
        content: `
Crie bullet points para:
- Título: ${variant.title}
- SKU: ${variant.sku}
- Preço: R$ ${variant.price}

Liste 3-5 bullets focados em benefícios.
`
      }
    ]
  });
  
  return response.choices[0].message.content;
}

export default {
  rewriteContent,
  rewriteTitles,
  rewriteVariantbullets
};