# 🤖 Shopify Catalog AI

Sistema de IA para automatizar e otimizar catálogos Shopify usando **OpenAI** + **Supabase** + **Vercel**.

---

## 🚀 Funcionalidades

- **6 Agentes IA especializados:**
  1. 🔍 **Fetcher** - Busca produtos da Shopify
  2. 📊 **Analyzer** - Analisa para otimização
  3. ✍️ **Copywriter** - Reescreve descrições
  4. 🏷️ **Categorizer** - Categoriza produtos
  5. ✅ **Validator** - Valida qualidade
  6. 💾 **Executor** - Atualiza Shopify

- **Automação 24/7** sem seu PC ligado
- **Webhook** em tempo real
- **Fila de processamento** com retry
- **Historico completo** no Supabase

---

## 📂 Estrutura

```
shopify-catalog-ai/
├── src/
│   ├── agents/           # 6 agentes de IA
│   ├── lib/             # Bibliotecas (Shopify, OpenAI, Supabase)
│   ├── api/             # Endpoints Vercel
│   ├── utils/           # Utilitários (queue, retry, rate-limit)
│   └── scripts/          # Scripts de execução
├── supabase/
│   └── migrations/       # Schema do banco
├── .github/
│   └── workflows/       # GitHub Actions
├── vercel.json
└── package.json
```

---

## ⚙️ Configuração

### 1. Criar projeto Supabase

```bash
# Criar projeto em supabase.com
# Copiar URL e API Key (Settings > API)
```

### 2. Executar migrations

```bash
# No SQL Editor do Supabase
# Copiar conteúdo de supabase/migrations/001_initial_schema.sql
```

### 3. Configurar Vercel

```bash
npm install -g vercel
vercel login
vercel

# Adicionar variáveis de ambiente:
# - SHOPIFY_STORE_URL
# - SHOPIFY_ACCESS_TOKEN
# - SHOPIFY_WEBHOOK_SECRET
# - OPENAI_API_KEY
# - SUPABASE_URL
# - SUPABASE_KEY
```

### 4. Configurar GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/shopify-catalog-ai.git
git push -u origin main

# Adicionar Secrets em Settings > Secrets:
# - SHOPIFY_STORE_URL
# - SHOPIFY_ACCESS_TOKEN
# - OPENAI_API_KEY
# - SUPABASE_URL
# - SUPABASE_KEY
# - EMAIL_USERNAME
# - EMAIL_PASSWORD
# - NOTIFY_EMAIL
```

### 5. Configurar Webhooks Shopify

```
Dashboard Shopify > Settings > Notifications > Webhooks
URL: https://seu-projeto.vercel.app/api/webhook
Tópicos:
- products/create
- products/update
- products/delete
```

---

## ▶️ Comandos

```bash
# Desenvolvimento
npm run dev

# Deploy
npm run deploy

# Sincronizar todos os produtos
npm run sync

# Testar produto específico
npm run test <product_id>

# Processar fila
npm run queue

# Gerar relatório
npm run generate-report
```

---

## 📡 API Endpoints

| Endpoint | Descrição |
|----------|----------|
| `POST /api/webhook` | Recebe webhooks Shopify |
| `POST /api/process-queue` | Processa fila (cron) |
| `GET /api/status` | Status do sistema |
| `POST /api/manual-sync` | Sincronização manual |

---

## 🔐 Variáveis de Ambiente

```env
SHOPIFY_STORE_URL=sua-loja.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=xxxxx
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx
```

---

## 📊 Monitoramento

**Dashboard:** `GET /api/status`

```json
{
  "status": "running",
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 100,
    "failed": 3
  },
  "cache": {
    "total_products": 150
  }
}
```

---

## 🎯 Fluxo de Processamento

```
produto criado/atualizado
        ↓
  webhook_received
        ↓
  adiciona_fila [priority: 5-10]
        ↓
  process_queue (a cada 10min)
        ↓
  [1] fetcher → busca produto
  [2] analyzer → analisa
  [3] copywriter → reescreve
  [4] categorizer → categoriza
  [5] validator → valida (score >= 70)
  [6] executor → atualiza Shopify
        ↓
  cache_produto
```

---

## 📄 Licença

MIT