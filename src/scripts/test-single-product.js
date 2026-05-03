// ========================================
// TEST SINGLE PRODUCT - Testa processamento de um produto
// ========================================

import 'dotenv/config';
import { processProduct } from '../lib/orchestrator.js';

/**
 * Testa processamento de um produto específico
 */
async function main() {
  const productId = process.argv[2];

  if (!productId) {
    console.error('Uso: node test-single-product.js <product_id>');
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log(`[Test] Processando produto ${productId}...`);
  console.log('='.repeat(50));

  try {
    const result = await processProduct(parseInt(productId));

    console.log('\n✓ Resultado:');
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Erro:', error.message);
    process.exit(1);
  }
}

main();