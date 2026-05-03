// ========================================
// QUEUE MANAGER - Gerenciador de fila de processamento
// ========================================

import { supabaseClient } from '../lib/supabase.js';
import { logEvent } from '../lib/logger.js';

/**
 * Obter próximo produto da fila
 */
export async function getNextFromQueue() {
  const products = await supabaseClient.getPendingProducts(1);
  return products[0] || null;
}

/**
 * Obter produtos pendentes
 */
export async function getPendingProducts(limit = 5) {
  return supabaseClient.getPendingProducts(limit);
}

/**
 * Adicionar produto na fila
 */
export async function addToQueue(productId, priority = 0) {
  return supabaseClient.addToQueue(productId, priority);
}

/**
 * Atualizar status do produto
 */
export async function updateQueueStatus(id, status, errorMessage = null) {
  return supabaseClient.updateQueueStatus(id, status, errorMessage);
}

/**
 * Marcar como processando
 */
export async function markAsProcessing(id) {
  return supabaseClient.updateQueueStatus(id, 'processing');
}

/**
 * Marcar como concluído
 */
export async function markAsCompleted(id) {
  return supabaseClient.updateQueueStatus(id, 'completed');
}

/**
 * Marcar como falhou
 */
export async function markAsFailed(id, errorMessage) {
  return supabaseClient.updateQueueStatus(id, 'failed', errorMessage);
}

/**
 * Reiniciar produtos falhados
 */
export async function retryFailedProducts() {
  if (!supabaseClient.client) return 0;
  
  // Buscar produtos falhados
  const { data, error } = await supabaseClient.client
    .from('products_queue')
    .select('*')
    .eq('status', 'failed')
    .lt('attempts', 3);
  
  if (error || !data) return 0;
  
  // Resetar para pending
  for (const item of data) {
    await supabaseClient.updateQueueStatus(item.id, 'pending');
  }
  
  await logEvent('queue', 'retry_failed', 'success', {
    count: data.length
  });
  
  return data.length;
}

/**
 * Limpar produtos antigos
 */
export async function cleanOldQueue(daysToKeep = 30) {
  if (!supabaseClient.client) return 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const { error } = await supabaseClient.client
    .from('products_queue')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .eq('status', 'completed');
  
  if (error) {
    console.error('Erro ao limpar fila:', error);
    return 0;
  }
  
  return 1;
}

/**
 * Obter estatísticas da fila
 */
export async function getQueueStats() {
  if (!supabaseClient.client) return null;
  
  const { data, error } = await supabaseClient.client
    .from('products_queue')
    .select('status')
    .in('status', ['pending', 'processing', 'completed', 'failed']);
  
  if (error) return null;
  
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  for (const item of data || []) {
    stats[item.status] = (stats[item.status] || 0) + 1;
  }
  
  return stats;
}

export default {
  getNextFromQueue,
  getPendingProducts,
  addToQueue,
  updateQueueStatus,
  markAsProcessing,
  markAsCompleted,
  markAsFailed,
  retryFailedProducts,
  cleanOldQueue,
  getQueueStats
};