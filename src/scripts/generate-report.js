// ========================================
// GENERATE REPORT - Gera relatório de sincronização
// ========================================

import 'dotenv/config';
import { supabaseClient } from '../lib/supabase.js';

/**
 * Gera relatório de sincronização
 */
async function main() {
  console.log('[Report] Gerando relatório...');

  try {
    // Buscar dados
    const { data: logs } = await supabaseClient.client
      ?.from('processing_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    const { data: queue } = await supabaseClient.client
      ?.from('products_queue')
      .select('status');

    const { data: sync } = await supabaseClient.client
      ?.from('sync_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    // Calcular estatísticas
    const stats = {
      total: queue?.length || 0,
      pending: queue?.filter(q => q.status === 'pending').length || 0,
      processing: queue?.filter(q => q.status === 'processing').length || 0,
      completed: queue?.filter(q => q.status === 'completed').length || 0,
      failed: queue?.filter(q => q.status === 'failed').length || 0
    };

    const agentStats = {};
    for (const log of logs || []) {
      agentStats[log.agent_name] = (agentStats[log.agent_name] || 0) + 1;
    }

    console.log('\n' + '='.repeat(50));
    console.log('RELATÓRIO DE SINCRONIZAÇÃO');
    console.log('='.repeat(50));
    console.log(`\nFila:`);
    console.log(`  Pendentes: ${stats.pending}`);
    console.log(`  Processando: ${stats.processing}`);
    console.log(`  Concluídos: ${stats.completed}`);
    console.log(`  Falhados: ${stats.failed}`);
    console.log(`\nAgentes:`);
    for (const [agent, count] of Object.entries(agentStats)) {
      console.log(`  ${agent}: ${count}`);
    }
    console.log('\n' + '='.repeat(50));

    return { stats, agentStats };

  } catch (error) {
    console.error('[Report] Erro:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));