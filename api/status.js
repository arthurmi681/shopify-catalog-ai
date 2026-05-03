// ========================================
// STATUS - Status do sistema
// ========================================

import { supabaseClient } from '../src/lib/supabase.js';

/**
 * Handler do status
 */
export default async function handler(req, res) {
  try {
    // Contagem da fila
    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    if (supabaseClient.client) {
      // Pending
      const { count: pending } = await supabaseClient.client
        .from('products_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      counts.pending = pending || 0;
      
      // Processing
      const { count: processing } = await supabaseClient.client
        .from('products_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');
      counts.processing = processing || 0;
      
      // Completed
      const { count: completed } = await supabaseClient.client
        .from('products_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
      counts.completed = completed || 0;
      
      // Failed
      const { count: failed } = await supabaseClient.client
        .from('products_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      counts.failed = failed || 0;
    }

    // Obter configurações
    const config = {
      brand_voice: await supabaseClient.getConfig('brand_voice'),
      target_audience: await supabaseClient.getConfig('target_audience'),
      processing_settings: await supabaseClient.getConfig('processing_settings')
    };

    return res.status(200).json({
      status: 'running',
      timestamp: new Date().toISOString(),
      queue: counts,
      config
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