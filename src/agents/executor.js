// ========================================
// AGENT 6: EXECUTOR - Atualiza produtos na Shopify
// ========================================

import { shopifyClient } from '../lib/shopify.js';
import { logEvent } from '../lib/logger.js';
import { cacheProduct } from '../lib/supabase.js';

/**
 * Atualiza um produto na Shopify com conteúdo otimizado
 * @param {number} productId - ID do produto
 * @param {Object} optimizedData - Dados otimizados
 * @returns {Promise<Object>} Resultado da atualização
 */
export async function updateShopify(productId, optimizedData) {
  const startTime = Date.now();
  
  try {
    console.log(`[Executor] Atualizando produto ${productId} na Shopify...`);
    
    // Preparar dados para atualização
    const updateData = prepareUpdateData(optimizedData);
    
    // Atualizar produto na Shopify
    const updated = await shopifyClient.update(productId, updateData);
    
    // Atualizar cache no Supabase
    await cacheProduct(productId, optimizedData);
    
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_shopify', 'success', {
      product_id: productId,
      title: optimizedData.title,
      tags_count: optimizedData.tags?.length || 0
    }, duration);
    
    return {
      success: true,
      product_id: productId,
      updated_fields: Object.keys(updateData),
      duration_ms: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_shopify', 'error', {
      product_id: productId,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Prepara dados para atualização
 */
function prepareUpdateData(data) {
  const update = {};
  
  if (data.title) {
    update.title = data.title;
  }
  
  if (data.description) {
    update.body_html = data.description;
  }
  
  if (data.meta_description) {
    update.meta = {
      ...update.meta,
      description: data.meta_description
    };
  }
  
  if (data.tags) {
    update.tags = data.tags.join(', ');
  }
  
  if (data.product_type) {
    update.product_type = data.product_type;
  }
  
  if (data.vendor) {
    update.vendor = data.vendor;
  }
  
  return update;
}

/**
 * Atualiza apenas o título
 * @param {number} productId - ID do produto
 * @param {string} title - Novo título
 * @returns {Promise<Object>} Resultado
 */
export async function updateTitle(productId, title) {
  return updateShopify(productId, { title });
}

/**
 * Atualiza apenas a descrição
 * @param {number} productId - ID do produto
 * @param {string} description - Nova descrição
 * @returns {Promise<Object>} Resultado
 */
export async function updateDescription(productId, description) {
  return updateShopify(productId, { description });
}

/**
 * Atualiza tags
 * @param {number} productId - ID do produto
 * @param {Array<string>} tags - Novas tags
 * @returns {Promise<Object>} Resultado
 */
export async function updateTags(productId, tags) {
  return updateShopify(productId, { tags });
}

/**
 * Atualiza categorias/collections
 * @param {number} productId - ID do produto
 * @param {Array<string>} collections - Coleções
 * @returns {Promise<Object>} Resultado
 */
export async function updateCollections(productId, collections) {
  const startTime = Date.now();
  
  try {
    console.log(`[Executor] Atualizando coleções do produto ${productId}...`);
    
    // Buscar IDs das coleções
    const collectionIds = await Promise.all(
      collections.map(async (title) => {
        const collection = await shopifyClient.getCollectionByTitle(title);
        return collection?.id;
      })
    );
    
    // Atualizar produto com novas coleções
    const updated = await shopifyClient.addToCollections(
      productId,
      collectionIds.filter(Boolean)
    );
    
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_collections', 'success', {
      product_id: productId,
      collections: collections
    }, duration);
    
    return { success: true, product_id: productId, collections };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_collections', 'error', {
      product_id: productId,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Atualiza variante específica
 * @param {number} variantId - ID da variante
 * @param {Object} data - Dados a atualizar
 * @returns {Promise<Object>} Resultado
 */
export async function updateVariant(variantId, data) {
  const startTime = Date.now();
  
  try {
    const updated = await shopifyClient.updateVariant(variantId, data);
    
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_variant', 'success', {
      variant_id: variantId
    }, duration);
    
    return { success: true, variant_id: variantId };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('executor', 'update_variant', 'error', {
      variant_id: variantId,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Desativa produto
 * @param {number} productId - ID do produto
 * @returns {Promise<Object>} Resultado
 */
export async function deactivateProduct(productId) {
  return updateShopify(productId, { status: 'draft' });
}

/**
 * Ativa produto
 * @param {number} productId - ID do produto
 * @returns {Promise<Object>} Resultado
 */
export async function activateProduct(productId) {
  return updateShopify(productId, { status: 'active' });
}

export default {
  updateShopify,
  updateTitle,
  updateDescription,
  updateTags,
  updateCollections,
  updateVariant,
  deactivateProduct,
  activateProduct
};