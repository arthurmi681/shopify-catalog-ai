// ========================================
// RATE LIMITER - Controle de rate limiting
// ========================================

/**
 * Rate Limiter em memória
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.windowMs = 60 * 1000; // 1 minuto
    this.maxRequests = 60; // por janela
  }
  
  /**
   * Verifica se pode fazer requisição
   */
  canMakeRequest(key = 'default') {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Limpar entradas antigas
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => t > windowStart);
    
    if (validTimestamps.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((validTimestamps[0] + this.windowMs - now) / 1000)
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Registra requisição
   */
  recordRequest(key = 'default') {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => t > windowStart);
    validTimestamps.push(now);
    
    this.requests.set(key, validTimestamps);
    
    return {
      remaining: this.maxRequests - validTimestamps.length,
      resetIn: Math.ceil(this.windowMs / 1000)
    };
  }
  
  /**
   * Espera até poder fazer requisição
   */
  async waitForSlot(key = 'default', maxWaitMs = 30000) {
    const startWait = Date.now();
    
    while (Date.now() - startWait < maxWaitMs) {
      const { allowed, retryAfter } = this.canMakeRequest(key);
      
      if (allowed) return true;
      
      console.log(`[RateLimit] Aguardando ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
    }
    
    throw new Error('Timeout ao esperar rate limit');
  }
  
  /**
   * Resetar rate limit
   */
  reset(key = 'default') {
    this.requests.delete(key);
  }
  
  /**
   * Resetar todos
   */
  resetAll() {
    this.requests.clear();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// EXPORTS
// ========================================

export const rateLimiter = new RateLimiter();

// ========================================
// SHOPIFY RATE LIMITER
// ========================================

export const shopifyRateLimiter = {
  // API calls/minute: 40 (Shopify Basic)
  maxRequests: 40,
  windowMs: 60 * 1000,
  
  limiter: new RateLimiter(),
  
  canMakeRequest() {
    return this.limiter.canMakeRequest('shopify');
  },
  
  recordRequest() {
    return this.limiter.recordRequest('shopify');
  },
  
  async waitForSlot() {
    return this.limiter.waitForSlot('shopify');
  }
};

// ========================================
// OPENAI RATE LIMITER
// ========================================

export const openaiRateLimiter = {
  // RPM: 500, TPM: 150K (GPT-4)
  maxRequests: 500,
  windowMs: 60 * 1000,
  
  limiter: new RateLimiter(),
  
  canMakeRequest() {
    return this.limiter.canMakeRequest('openai');
  },
  
  recordRequest() {
    return this.limiter.recordRequest('openai');
  },
  
  async waitForSlot() {
    return this.limiter.waitForSlot('openai');
  }
};

export default {
  rateLimiter,
  shopifyRateLimiter,
  openaiRateLimiter
};