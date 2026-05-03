// ========================================
// SUPABASE CLIENT - Cliente do Supabase
// ========================================

import { createClient } from '@supabase/supabase-js';

/**
 * Cria cliente do Supabase
 */
class SupabaseClient {
  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_KEY;
    
    if (!this.url || !this.key) {
      console.warn('[Supabase] Credenciais não configuradas');
      return;
    }
    
    this.client = createClient(this.url, this.key);
  }
  
  // ========================================
  // PRODUCTS QUEUE
  // ========================================
  
  /**
   * Adiciona produto na fila
   */
  async addToQueue(productId, priority = 0) {
    if (!this.client) return null;
    
    // Verificar se já não está na fila
    const existing = await this.client
      .from('products_queue')
      .select('id, status')
      .eq('shopify_product_id', productId)
      .in('status', ['pending', 'processing'])
      .single();
    
    if (existing.data) {
      return existing.data.id;
    }
    
    const { data, error } = await this.client
      .from('products_queue')
      .insert({
        shopify_product_id: productId,
        priority,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data?.id;
  }
  
  /**
   * Busca produtos pendentes
   */
  async getPendingProducts(limit = 5) {
    if (!this.client) return [];
    
    const { data, error } = await this.client
      .from('products_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Atualiza status do produto na fila
   */
  async updateQueueStatus(id, status, errorMessage = null) {
    if (!this.client) return;
    
    const update = { status };
    if (errorMessage) update.error_message = errorMessage;
    if (status === 'completed') update.processed_at = new Date().toISOString();
    if (status === 'processing') {
      update.status = 'processing';
    }
    
    const { error } = await this.client
      .from('products_queue')
      .update(update)
      .eq('id', id);
    
    if (error) throw error;
  }
  
  /**
   * Incrementa tentativas
   */
  async incrementAttempts(id) {
    if (!this.client) return;
    
    const { error } = await this.client
      .from('products_queue')
      .update({ attempts: this.client.raw('attempts + 1') })
      .eq('id', id);
    
    if (error) throw error;
  }
  
  // ========================================
  // PRODUCTS CACHE
  // ========================================
  
  /**
   * Salva produto no cache
   */
  async cacheProduct(productId, originalData, analyzedData = null, optimizedData = null, validationScore = null) {
    if (!this.client) return;
    
    const { error } = await this.client
      .from('products_cache')
      .upsert({
        shopify_product_id: productId,
        original_data: originalData,
        analyzed_data: analyzedData,
        optimized_data: optimizedData,
        validation_score: validationScore,
        last_synced_at: new Date().toISOString()
      }, { onConflict: 'shopify_product_id' });
    
    if (error) throw error;
  }
  
  /**
   * Busca produto do cache
   */
  async getCachedProduct(productId) {
    if (!this.client) return null;
    
    const { data, error } = await this.client
      .from('products_cache')
      .select('*')
      .eq('shopify_product_id', productId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  /**
   * Lista produtos em cache
   */
  async listCachedProducts(limit = 100) {
    if (!this.client) return [];
    
    const { data, error } = await this.client
      .from('products_cache')
      .select('*')
      .order('last_synced_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
  
  // ========================================
  // PROCESSING LOGS
  // ========================================
  
  /**
   * Log de evento
   */
  async log(agentName, action, status, details = {}, durationMs = null) {
    if (!this.client) return;
    
    const { error } = await this.client
      .from('processing_logs')
      .insert({
        agent_name: agentName,
        action,
        status,
        details,
        duration_ms: durationMs
      });
    
    if (error) throw error;
  }
  
  /**
   * Busca logs de um produto
   */
  async getProductLogs(productId) {
    if (!this.client) return [];
    
    const { data, error } = await this.client
      .from('processing_logs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
  
  // ========================================
  // SYSTEM CONFIG
  // ========================================
  
  /**
   * Obtém configuração
   */
  async getConfig(key) {
    if (!this.client) return null;
    
    const { data, error } = await this.client
      .from('system_config')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value;
  }
  
  /**
   * Atualiza configuração
   */
  async setConfig(key, value) {
    if (!this.client) return;
    
    const { error } = await this.client
      .from('system_config')
      .upsert({ key, value }, { onConflict: 'key' });
    
    if (error) throw error;
  }
  
  // ========================================
  // SYSTEM STATUS
  // ========================================
  
  /**
   * Obtém status do sistema
   */
  async getSystemStatus() {
    if (!this.client) return null;
    
    const { data, error } = await this.client
      .from('system_status')
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }
  
  // ========================================
  // SYNC HISTORY
  // ========================================
  
  /**
   * Cria registro de sincronização
   */
  async createSync(syncType, productsTotal) {
    if (!this.client) return null;
    
    const { data, error } = await this.client
      .from('sync_history')
      .insert({
        sync_type: syncType,
        products_total: productsTotal,
        status: 'running'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Finaliza sincronização
   */
  async completeSync(id, status, productsProcessed, productsFailed) {
    if (!this.client) return;
    
    const { error } = await this.client
      .from('sync_history')
      .update({
        status,
        products_processed: productsProcessed,
        products_failed: productsFailed,
        completed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
  }
}

// ========================================
// EXPORTS
// ========================================

export const supabaseClient = new SupabaseClient();

// Aliases para compatibilidade
export const queueProduct = (id, priority) => supabaseClient.addToQueue(id, priority);
export const getPending = (limit) => supabaseClient.getPendingProducts(limit);
export const updateStatus = (id, status, err) => supabaseClient.updateQueueStatus(id, status, err);
export const cacheProduct = (id, orig, anal, opt, score) => supabaseClient.cacheProduct(id, orig, anal, opt, score);
export const logEvent = (agent, action, status, details, ms) => supabaseClient.log(agent, action, status, details, ms);
export const getSystemConfig = (key) => supabaseClient.getConfig(key);
export const getStatus = () => supabaseClient.getSystemStatus();

export default supabaseClient;