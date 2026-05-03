// ========================================
// MANUAL SYNC - Sincronização manual
// ========================================

import { supabaseClient } from '../src/lib/supabase.js';
import { shopifyClient } from '../src/lib/shopify.js';

/**
 * Handler do manual-sync
 */
export default async function handler(req, res) {
  // Validar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { product_ids, limit = 50 } = req.body;

    console.log('[Manual Sync] Iniciando sincronização manual...');

    let products = [];

    // Buscar produtos
    if (product_ids && product_ids.length > 0) {
      // IDs específicos
      console.log(`[Manual Sync] Buscando ${product_ids.length} produtos específicos...`);
      products = product_ids;
    } else {
      // Todos
      console.log('[Manual Sync] Buscando todos os produtos...');
      const result = await shopifyClient.list({ limit });
      products = result.products.map(p => p.id);
    }

    console.log(`[Manual Sync] ${products.length} produtos encontrados`);

    // Adicionar à fila
    let added = 0;
    for (const productId of products) {
      try {
        await supabaseClient.addToQueue(productId, 5); // Prioridade alta
        added++;
      } catch (err) {
        console.error(`[Manual Sync] Erro ao adicionar ${productId}:`, err.message);
      }
    }

    console.log(`[Manual Sync] ${added} produtos adicionados à fila`);

    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      found: products.length,
      added,
      duration_ms: duration,
      message: `${added} produtos adicionados à fila para processamento`
    });

  } catch (error) {
    console.error('[Manual Sync] Erro:', error);

    return res.status(500).json({
      error: error.message,
      duration_ms: Date.now() - startTime
    });
  }
}