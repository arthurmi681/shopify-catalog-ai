// ========================================
// MANUAL SYNC - Sincronização manual
// ========================================

import { supabaseClient } from '../../lib/supabase.js';
import { shopifyClient } from '../../lib/shopify.js';
import { processProduct } from '../lib/orchestrator.js';

/**
 * Handler do manual-sync
 */
export default async function handler(req, res) {
  // Validar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar API key
  if (process.env.API_SECRET) {
    const apiKey = req.headers['x-api-key'] || req.body.api_key;
    if (apiKey !== process.env.API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();

  try {
    const { product_ids, product_type, vendor, since, limit = 50 } = req.body;

    console.log('[Manual Sync] Iniciando sincronização manual...');

    // Criar registro de sincronização
    const syncRecord = await supabaseClient.createSync('manual', 0);

    let products = [];

    // Buscar produtos
    if (product_ids && product_ids.length > 0) {
      // IDs específicos
      console.log(`[Manual Sync] Buscando ${product_ids.length} produtos específicos...`);
      products = product_ids;
    } else if (since) {
      // Desde uma data
      console.log(`[Manual Sync] Buscando produtos desde ${since}...`);
      const result = await shopifyClient.list({
        updated_at_min: since,
        limit
      });
      products = result.products.map(p => p.id);
    } else if (product_type || vendor) {
      // Por tipo ou vendor
      console.log(`[Manual Sync] Buscando por tipo=${product_type}, vendor=${vendor}...`);
      const result = await shopifyClient.list({ limit });
      products = result.products
        .filter(p => {
          if (product_type && p.product_type !== product_type) return false;
          if (vendor && p.vendor !== vendor) return false;
          return true;
        })
        .map(p => p.id);
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

    // Atualizar registro
    if (syncRecord) {
      await supabaseClient.completeSync(syncRecord.id, 'completed', added, 0);
    }

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

    if (syncRecord) {
      await supabaseClient.completeSync(syncRecord.id, 'failed', 0, 1);
    }

    return res.status(500).json({
      error: error.message,
      duration_ms: Date.now() - startTime
    });
  }
}

// Variável para controlar sync record
let syncRecord = null;