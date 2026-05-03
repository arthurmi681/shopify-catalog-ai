-- ========================================
-- SHOPIFY CATALOG AI - Schema do Banco de Dados
-- Criado: 2026-05-03
-- ========================================

-- ========================================
-- EXTENSÃO: UUID
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABELA: products_queue
-- Guarda produtos que precisam ser processados
-- ========================================
CREATE TABLE products_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id BIGINT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- TABELA: products_cache
-- Cache dos produtos processados
-- ========================================
CREATE TABLE products_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id BIGINT UNIQUE NOT NULL,
  original_data JSONB NOT NULL,
  analyzed_data JSONB,
  optimized_data JSONB,
  validation_score INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: processing_logs
-- Histórico de tudo que acontece
-- ========================================
CREATE TABLE processing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id BIGINT,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: system_config
-- Configurações do sistema
-- ========================================
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: webhooks_log
-- Log de webhooks recebidos
-- ========================================
CREATE TABLE webhooks_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_topic TEXT NOT NULL,
  product_id BIGINT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABELA: sync_history
-- Histórico de sincronizações
-- ========================================
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'partial', 'manual', 'scheduled')),
  products_total INTEGER,
  products_processed INTEGER,
  products_failed INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- ========================================
-- ÍNDICES para performance
-- ========================================
CREATE INDEX idx_queue_status ON products_queue(status);
CREATE INDEX idx_queue_priority ON products_queue(priority DESC);
CREATE INDEX idx_queue_created ON products_queue(created_at ASC);
CREATE INDEX idx_queue_attempts ON products_queue(attempts);
CREATE INDEX idx_cache_product ON products_cache(shopify_product_id);
CREATE INDEX idx_cache_last_synced ON products_cache(last_synced_at DESC);
CREATE INDEX idx_logs_product ON processing_logs(product_id);
CREATE INDEX idx_logs_agent ON processing_logs(agent_name);
CREATE INDEX idx_logs_created ON processing_logs(created_at DESC);
CREATE INDEX idx_webhooks_product ON webhooks_log(product_id);
CREATE INDEX idx_webhooks_processed ON webhooks_log(processed);
CREATE INDEX idx_sync_started ON sync_history(started_at DESC);

-- ========================================
-- FUNÇÃO: Atualizar timestamp automaticamente
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_products_queue_updated_at 
BEFORE UPDATE ON products_queue 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at 
BEFORE UPDATE ON system_config 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CONFIGURAÇÕES PADRÃO
-- ========================================
INSERT INTO system_config (key, value) VALUES
('brand_voice', '{"tone": "profissional e acolhedor", "style": "elegante", "description": "Tom friendly mas profissional, direto e inspirador"}'),
('target_audience', '{"age": "25-40", "gender": "feminino", "interests": ["moda", "beleza", "lifestyle"]}'),
('processing_settings', '{"batch_size": 5, "concurrent_jobs": 3, "retry_delay_ms": 5000, "timeout_ms": 30000}'),
('quality_thresholds', '{"min_score": 70, "max_retries": 3, "validation_required": true}'),
('openai_settings', '{"model": "gpt-4o", "temperature": 0.7, "max_tokens": 2000}');

-- ========================================
-- VIEW: Status do Sistema
-- ========================================
CREATE OR REPLACE VIEW system_status AS
SELECT 
  (SELECT COUNT(*)::INTEGER FROM products_queue WHERE status = 'pending') AS pending_products,
  (SELECT COUNT(*)::INTEGER FROM products_queue WHERE status = 'processing') AS processing_products,
  (SELECT COUNT(*)::INTEGER FROM products_queue WHERE status = 'completed') AS completed_products,
  (SELECT COUNT(*)::INTEGER FROM products_queue WHERE status = 'failed') AS failed_products,
  (SELECT COUNT(*)::INTEGER FROM products_cache) AS total_cached_products,
  (SELECT MAX(created_at) FROM processing_logs WHERE agent_name = 'orchestrator' AND action = 'completed') AS last_successful_sync;

-- ========================================
-- VIEW: Estatísticas de Processamento
-- ========================================
CREATE OR REPLACE VIEW processing_stats AS
SELECT 
  DATE(created_at) AS date,
  agent_name,
  COUNT(*)::INTEGER AS total_actions,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INTEGER AS successful,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::INTEGER AS errors,
  AVG(duration_ms)::INTEGER AS avg_duration_ms,
  MAX(duration_ms)::INTEGER AS max_duration_ms
FROM processing_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), agent_name
ORDER BY date DESC, agent_name;

-- ========================================
-- FUNÇÃO: Obter produto do cache
-- ========================================
CREATE OR REPLACE FUNCTION get_cached_product(p_product_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'shopify_product_id', shopify_product_id,
    'original_data', original_data,
    'analyzed_data', analyzed_data,
    'optimized_data', optimized_data,
    'validation_score', validation_score,
    'last_synced_at', last_synced_at
  ) INTO result
  FROM products_cache
  WHERE shopify_product_id = p_product_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FUNÇÃO: Adicionar produto na fila
-- ========================================
CREATE OR REPLACE_FUNCTION add_to_queue(p_product_id BIGINT, p_priority INTEGER DEFAULT 0)
RETURNS UUID AS $$
DECLARE
  queue_id UUID;
BEGIN
  -- Verificar se já não está na fila
  IF EXISTS (SELECT 1 FROM products_queue WHERE shopify_product_id = p_product_id AND status IN ('pending', 'processing')) THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO products_queue (shopify_product_id, priority)
  VALUES (p_product_id, p_priority)
  RETURNING id INTO queue_id;
  
  RETURN queue_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ========================================
-- RLS - Row Level Security
-- ========================================
ALTER TABLE products_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (ajustar conforme necessidade)
CREATE POLICY "Allow all for authenticated" ON products_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON products_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON processing_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON webhooks_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sync_history FOR ALL USING (true) WITH CHECK (true);