// ========================================
// AGENT 1: FETCHER - Busca produtos da Shopify
// ========================================

import { shopifyClient } from '../lib/shopify.js';
import { logEvent } from '../lib/logger.js';

/**
 * Busca um produto específico da Shopify
 * @param {number} productId - ID do produto na Shopify
 * @returns {Promise<Object>} Dados completos do produto
 */
export async function fetchProduct(productId) {
  const startTime = Date.now();
  
  try {
    console.log(`[Fetcher] Buscando produto ${productId}...`);
    
    // Buscar produto da Shopify
    const product = await shopifyClient.get(productId);
    
    if (!product) {
      throw new Error(`Produto ${productId} não encontrado`);
    }
    
    // Buscar variantes (variações do produto)
    const variants = await shopifyClient.getVariants(productId);
    
    // Buscar imagens
    const images = await shopifyClient.getImages(productId);
    
    // Buscar collections
    const collections = await shopifyClient.getCollections(productId);
    
    const duration = Date.now() - startTime;
    
    await logEvent('fetcher', 'fetch_product', 'success', {
      product_id: productId,
      variants_count: variants?.length || 0,
      images_count: images?.length || 0
    }, duration);
    
    return {
      ...product,
      variants: variants || [],
      images: images || [],
      collections: collections || []
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logEvent('fetcher', 'fetch_product', 'error', {
      product_id: productId,
      error: error.message
    }, duration);
    
    throw error;
  }
}

/**
 * Busca múltiplos produtos da Shopify
 * @param {Array<number>} productIds - Array de IDs dos produtos
 * @returns {Promise<Array<Object>>} Array de produtos
 */
export async function fetchProducts(productIds) {
  const results = await Promise.allSettled(
    productIds.map(id => fetchProduct(id))
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Busca todos os produtos da loja
 * @param {Object} options - Opções de paginação
 * @returns {Promise<Array<Object>>} Lista de produtos
 */
export async function fetchAllProducts(options = {}) {
  const { limit = 250, cursor = null } = options;
  
  const products = await shopifyClient.list({ limit, cursor });
  
  return products;
}

/**
 * Busca produtos atualizados desde uma data
 * @param {Date} since - Data de referência
 * @returns {Promise<Array<Object>>} Produtos atualizados
 */
export async function fetchUpdatedProducts(since) {
  const products = await shopifyClient.list({
    updated_at_min: since.toISOString()
  });
  
  return products;
}

export default {
  fetchProduct,
  fetchProducts,
  fetchAllProducts,
  fetchUpdatedProducts
};