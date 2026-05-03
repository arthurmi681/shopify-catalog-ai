// ========================================
// SYNC PRODUCTS - Script de sincronização
// ========================================

import 'dotenv/config';
import { shopifyClient } from '../lib/shopify.js';
import { supabaseClient } from '../lib/supabase.js';
import { logEvent } from '../lib/logger.js';

/**
 * Script principal de sincronização
 */
async function main() {
  console.log('='.repeat(50));
  console.log('[Sync] Iniciando sincronização de produtos...');
  console.log('='.repeat(50));

  const startTime = Date.now();

  try {
    // Buscar último sync
    let lastSync = null;
    if (supabaseClient.client) {
      const { data } = await supabaseClient.client
        .from('sync_history')
        .select('started_at')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1);
      
      lastSync = data?.[0]?.started_at;
    }

    // Criar registro de sync
    const syncRecord = await supabaseClient.createSync('full', 0);

    // Buscar produtos da Shopify
    console.log('[Sync] Buscando produtos da Shopify...');
    const result = await shopifyClient.list({ limit: 250 });
    
    const products = result.products || [];
    console.log(`[Sync] ${products.length} produtos encontrados`);

    if (lastSync) {
      console.log(`[Sync] Última sincronização: ${lastSync}`);
    }

    // Adicionar todos à fila
    let added = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        // Verificar se já está na fila
        const existing = await supabaseClient.client
          ?.from('products_queue')
          .select('id')
          .eq('shopify_product_id', product.id)
          .in('status', ['pending', 'processing'])
          .single();

        if (existing?.data) {
          skipped++;
          continue;
        }

        await supabaseClient.addToQueue(product.id, 3);
        added++;
      } catch (err) {
        console.error(`[Sync] Erro ao adicionar ${product.id}:`, err.message);
      }
    }

    console.log(`[Sync] ${added} produtos adicionados, ${skipped} ignorados`);

    // Atualizar registro
    if (syncRecord) {
      await supabaseClient.completeSync(syncRecord.id, 'completed', added, 0);
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync] Concluído em ${duration}ms`);

    return { added, skipped, duration };

  } catch (error) {
    console.error('[Sync] Erro:', error);

    if (syncRecord) {
      await supabaseClient.completeSync(syncRecord.id, 'failed', 0, 1);
    }

    throw error;
  }
}

// Executar
main()
  .then(result => {
    console.log('\n✓ Sincronização concluída com sucesso');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Falha na sincronização:', error.message);
    process.exit(1);
  });