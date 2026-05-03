// ========================================
// WEBHOOK - Recebe eventos da Shopify
// ========================================

import crypto from 'crypto';
import { supabaseClient } from '../src/lib/supabase.js';

/**
 * Handler do webhook
 */
export default async function handler(req, res) {
  // Validar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validar webhook da Shopify
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];

    if (!topic) {
      console.warn('[Webhook] Headers não contém topic - possível chamada não oficial');
      // Em desenvolvimento, permitir sem validação
      if (process.env.NODE_ENV === 'development') {
        return handleWebhook(req.body);
      }
      return res.status(401).json({ error: 'Headers inválidos' });
    }

    // Validar HMAC em produção
    if (process.env.NODE_ENV === 'production' && hmac) {
      const body_str = JSON.stringify(req.body);
      const hash = crypto
        .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(body_str)
        .digest('base64');

      if (hash !== hmac) {
        return res.status(401).json({ error: 'Webhook inválido' });
      }
    }

    return handleWebhook(req.body, topic);

  } catch (error) {
    console.error('[Webhook] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Processa webhook
 */
async function handleWebhook(body, topic) {
  console.log(`[Webhook] Recebido: ${topic || 'unknown'}`);

  const { product } = body;

  if (!product || !product.id) {
    return { received: true, processed: false };
  }

  // Mapping de tópicos
  const topicActions = {
    'products/create': { action: 'create', priority: 10 },
    'products/update': { action: 'update', priority: 5 },
    'products/delete': { action: 'delete', priority: 0 },
    'products/activated': { action: 'activate', priority: 8 },
    'products/deactivated': { action: 'deactivate', priority: 1 }
  };

  const config = topicActions[topic] || { action: 'unknown', priority: 0 };

  // Processar conforme ação
  switch (config.action) {
    case 'create':
    case 'update':
    case 'activate':
      // Adicionar na fila
      await supabaseClient.addToQueue(product.id, config.priority);
      console.log(`[Webhook] Produto ${product.id} adicionado à fila (${config.action})`);
      break;

    case 'delete':
      // Remover do cache se existir
      if (supabaseClient.client) {
        await supabaseClient.client
          .from('products_cache')
          .delete()
          .eq('shopify_product_id', product.id);
        console.log(`[Webhook] Produto ${product.id} removido do cache`);
      }
      break;

    case 'deactivate':
      // Atualizar cache
      await supabaseClient.cacheProduct(product.id, { ...product, status: 'deactivated' });
      console.log(`[Webhook] Produto ${product.id} marcado como inativo`);
      break;
  }

  return { received: true, processed: true };
}