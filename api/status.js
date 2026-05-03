// ========================================
// STATUS - Status do sistema
// ========================================

import { supabaseClient } from '../src/lib/supabase.js';

/**
 * Handler do status
 */
export default async function handler(req, res) {
  try {
    // Obter status do banco
    const status = await supabaseClient.getSystemStatus();

    // Obter configurações
    const config = {
      brand_voice: await supabaseClient.getConfig('brand_voice'),
      target_audience: await supabaseClient.getConfig('target_audience'),
      processing_settings: await supabaseClient.getConfig('processing_settings')
    };

    // Obter últimas sincronizações
    let recentSyncs = [];
    if (supabaseClient.client) {
      const { data } = await supabaseClient.client
        .from('sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);
      recentSyncs = data || [];
    }

    return res.status(200).json({
      status: 'running',
      timestamp: new Date().toISOString(),
      queue: {
        pending: status?.pending_products || 0,
        processing: status?.processing_products || 0,
        completed: status?.completed_products || 0,
        failed: status?.failed_products || 0
      },
      cache: {
        total_products: status?.total_cached_products || 0,
        last_sync: status?.last_successful_sync
      },
      config,
      recent_syncs: recentSyncs.map(s => ({
        type: s.sync_type,
        status: s.status,
        products_total: s.products_total,
        products_processed: s.products_processed,
        products_failed: s.products_failed,
        started_at: s.started_at,
        completed_at: s.completed_at
      }))
    });

  } catch (error) {
    console.error('[Status] Erro:', error);

    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}