// ========================================
// PROCESS QUEUE - Processa produtos pendentes
// Roda a cada 10 minutos via Vercel Cron
// ========================================

import { supabaseClient } from '../../lib/supabase.js';
import { processProduct } from '../lib/orchestrator.js';

/**
 * Handler do process-queue
 */
export default async function handler(req, res) {
  // Validar método
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar secret (proteção)
  if (process.env.CRON_SECRET) {
    const secret = req.headers['x-cron-secret'] || req.query.secret;
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();

  try {
    console.log('[Process Queue] Iniciando processamento...');

    // Configurações
    const config = await supabaseClient.getConfig('processing_settings');
    const batchSize = config?.batch_size || 5;
    const concurrentJobs = config?.concurrent_jobs || 3;

    // Buscar produtos pendentes
    const pendingProducts = await supabaseClient.getPendingProducts(batchSize);

    if (!pendingProducts || pendingProducts.length === 0) {
      return res.status(200).json({
        message: 'Nenhum produto na fila',
        processed: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`[Process Queue] ${pendingProducts.length} produtos encontrados`);

    // Processar produtos
    const results = await Promise.allSettled(
      pendingProducts.map(async (item) => {
        // Marcar como processando
        await supabaseClient.updateQueueStatus(item.id, 'processing');

        try {
          // Processar produto
          const result = await processProduct(item.shopify_product_id);

          // Marcar como concluído
          await supabaseClient.updateQueueStatus(item.id, 'completed');

          return { success: true, product_id: item.shopify_product_id, result };

        } catch (error) {
          // Incrementar tentativas
          await supabaseClient.client
            .from('products_queue')
            .update({
              attempts: item.attempts + 1,
              status: item.attempts >= 2 ? 'failed' : 'pending',
              error_message: error.message
            })
            .eq('id', item.id);

          return {
            success: false,
            product_id: item.shopify_product_id,
            error: error.message
          };
        }
      })
    );

    // Calcular resultados
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.filter(r => !r.value?.success).length;

    const duration = Date.now() - startTime;

    console.log(`[Process Queue] Concluído: ${successful} ok, ${failed} erros em ${duration}ms`);

    return res.status(200).json({
      processed: results.length,
      successful,
      failed,
      duration_ms: duration,
      results: results.map(r => r.value).flat()
    });

  } catch (error) {
    console.error('[Process Queue] Erro:', error);

    return res.status(500).json({
      error: error.message,
      duration_ms: Date.now() - startTime
    });
  }
}