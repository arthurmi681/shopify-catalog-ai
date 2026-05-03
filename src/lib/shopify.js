// ========================================
// SHOPIFY CLIENT - Cliente da API da Shopify
// ========================================

import crypto from 'crypto';

/**
 * Cria cliente da Shopify API
 */
class ShopifyClient {
  constructor() {
    this.storeUrl = process.env.SHOPIFY_STORE_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-01';
    
    if (!this.storeUrl || !this.accessToken) {
      console.warn('[Shopify] Credenciais não configuradas');
    }
  }
  
  /**
   * Faz requisição para a API
   */
  async request(endpoint, options = {}) {
    if (!this.storeUrl || !this.accessToken) {
      throw new Error('Credenciais Shopify não configuradas');
    }
    
    const url = `https://${this.storeUrl}/admin/api/${this.apiVersion}/${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Shopify API Error: ${error.errors || response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Busca um produto pelo ID
   */
  async get(productId) {
    const data = await this.request(`products/${productId}.json`);
    return data.product;
  }
  
  /**
   * Lista produtos
   */
  async list(options = {}) {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit);
    if (options.cursor) params.append('page_info', options.cursor);
    if (options.updated_at_min) params.append('updated_at_min', options.updated_at_min);
    
    const endpoint = `products.json${params.toString() ? '?' + params : ''}`;
    const data = await this.request(endpoint);
    
    return {
      products: data.products,
      nextPageInfo: data.products?.length >= options.limit ? 'has_more' : null
    };
  }
  
  /**
   * Busca variantes de um produto
   */
  async getVariants(productId) {
    const product = await this.get(productId);
    return product.variants || [];
  }
  
  /**
   * Busca imagens de um produto
   */
  async getImages(productId) {
    const product = await this.get(productId);
    return product.images || [];
  }
  
  /**
   * Busca coleções de um produto
   */
  async getCollections(productId) {
    const data = await this.request(`products/${productId}/collections.json`);
    return data.collections || [];
  }
  
  /**
   * Atualiza um produto
   */
  async update(productId, productData) {
    const data = await this.request(`products/${productId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ product: productData })
    });
    
    return data.product;
  }
  
  /**
   * Atualiza uma variante
   */
  async updateVariant(variantId, variantData) {
    const data = await this.request(`variants/${variantId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ variant: variantData })
    });
    
    return data.variant;
  }
  
  /**
   * Adiciona produto a coleções
   */
  async addToCollections(productId, collectionIds) {
    const results = await Promise.all(
      collectionIds.map(collectionId =>
        this.request(`collections/${collectionId}/products.json`, {
          method: 'POST',
          body: JSON.stringify({ product_id: productId })
        })
      )
    );
    
    return results;
  }
  
  /**
   * Busca coleção por título
   */
  async getCollectionByTitle(title) {
    const data = await this.request(`smart_collections.json?title=${encodeURIComponent(title)}`);
    return data.smart_collections?.[0];
  }
  
  /**
   * Lista todas as coleções
   */
  async listCollections() {
    const data = await this.request('custom_collections.json');
    return data.custom_collections || [];
  }
  
  /**
   * Cria webhook
   */
  async createWebhook(address, topic) {
    const data = await this.request('webhooks.json', {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          address,
          format: 'json',
          topic
        }
      })
    });
    
    return data.webhook;
  }
  
  /**
   * Valida webhook
   */
  validateWebhook(body, hmac) {
    if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
      return true;
    }
    
    const hash = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('base64');
    
    return hash === hmac;
  }
}

// ========================================
// EXPORTS
// ========================================

export const shopifyClient = new ShopifyClient();
export default shopifyClient;