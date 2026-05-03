// ========================================
// ORCHESTRATOR - Coordena todos os 6 agentes
// ========================================

import { fetchProduct } from '../agents/fetcher.js';
import { analyzeProduct } from '../agents/analyzer.js';
import { rewriteContent } from '../agents/copywriter.js';
import { categorizeProduct } from '../agents/categorizer.js';
import { validateProduct } from '../agents/validator.js';
import { updateShopify } from '../agents/executor.js';
import { logEvent } from '../lib/logger.js';
import { supabaseClient } from '../lib/supabase.js';
import { getSystemConfig } from '../lib/supabase.js';

/**
 * Processa um produto através de todos os agentes
 * @param {number} productId - ID do produto na Shopify
 * @returns {Promise<Object>} Resultado do processamento
 */
export async function processProduct(productId) {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[Orchestrator] Processando produto ${productId}`);
    console.log('='.repeat(50));

    // ==================== ETAPA 1: BUSCAR ====================
    logEvent('orchestrator', 'stage_1_fetch', 'success', { product_id: productId });
    
    const product = await fetchProduct(productId);
    console.log(`  ✓ Produto bus${'='.repeat(10)}: ${product.title}`);

    // ==================== ETAPA 2: ANALISAR ====================
    logEvent('orchestrator', 'stage_2_analyze', 'success', { product_id: productId });
    
    const analysis = await analyzeProduct(product);
    console.log(`  ✓ Análise concluída: ${analysis.insights?.length || 0} insights`);

    // ==================== ETAPA 3: REESCREVER ====================
    logEvent('orchestrator', 'stage_3_rewrite', 'success', { product_id: productId });
    
    let optimizedContent = await rewriteContent(product, analysis);
    console.log(`  ✓ Conteúdo reescrito: ${optimizedContent.title?.substring(0, 30)}...`);

    // ==================== ETAPA 4: CATEGORIZAR ====================
    logEvent('orchestrator', 'stage_4_categorize', 'success', { product_id: productId });
    
    const categories = await categorizeProduct(product, analysis);
    console.log(`  ✓ Categorizado: ${categories.primary_category}`);

    // ==================== ETAPA 5: VALIDAR ====================
    logEvent('orchestrator', 'stage_5_validate', 'success', { product_id: productId });
    
    let validation = await validateProduct({
      id: product.id,
      title: optimizedContent.title,
      description: optimizedContent.description,
      meta_description: optimizedContent.meta_description,
      tags: optimizedContent.tags,
      categories
    });

    // Se não passou na validação, tentar reescrever até 3 vezes
    let retries = 0;
    const maxRetries = 3;
    
    while (validation.score < validation.pass_threshold && retries < maxRetries) {
      console.log(`  ↻ Retry ${retries + 1}: Score ${validation.score} < ${validation.pass_threshold}`);
      
      // Obter feedback
      const feedback = {
        score: validation.score,
        feedback: validation.suggestions || []
      };
      
      // Reescrever com feedback
      optimizedContent = await rewriteContent(product, analysis, feedback);
      validation = await validateProduct({
        id: product.id,
        title: optimizedContent.title,
        description: optimizedContent.description,
        meta_description: optimizedContent.meta_description,
        tags: optimizedContent.tags,
        categories
      });
      
      retries++;
    }

    if (validation.score < validation.pass_threshold) {
      throw new Error(`Produto não atingiu qualidade mínima. Score: ${validation.score}`);
    }

    console.log(`  ✓ Validado: Score ${validation.score}/${validation.pass_threshold}`);

    // ==================== ETAPA 6: ATUALIZAR SHOPIFY ====================
    logEvent('orchestrator', 'stage_6_update', 'success', { product_id: productId });
    
    // Unir dados otimizados
    const finalData = {
      ...optimizedContent,
      ...categories
    };
    
    const updateResult = await updateShopify(productId, finalData);
    console.log(`  ✓ Atualizado na Shopify`);

    // ==================== FINALIZAR ====================
    const duration = Date.now() - startTime;

    // Salvar no cache
    await supabaseClient.cacheProduct(
      productId,
      product,
      analysis,
      finalData,
      validation.score
    );

    logEvent('orchestrator', 'completed', 'success', {
      product_id: productId,
      score: validation.score,
      duration_ms: duration
    });

    console.log(`\n✓ Concluído em ${duration}ms | Score: ${validation.score}\n`);

    return {
      success: true,
      product_id: productId,
      score: validation.score,
      duration_ms: duration,
      stages: {
        fetch: true,
        analyze: true,
        rewrite: true,
        categorize: true,
        validate: true,
        update: true
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logEvent('orchestrator', 'error', 'error', {
      product_id: productId,
      error: error.message
    });

    console.error(`\n✗ Erro: ${error.message}\n`);

    throw error;
  }
}

/**
 * Processa múltiplos produtos
 * @param {Array<number>} productIds - Array de IDs
 * @returns {Promise<Array<Object>>} Resultados
 */
export async function processProducts(productIds) {
  const results = await Promise.allSettled(
    productIds.map(id => processProduct(id))
  );

  return results.map((r, i) => ({
    product_id: productIds[i],
    success: r.status === 'fulfilled',
    result: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason?.message : null
  }));
}

export default {
  processProduct,
  processProducts
};