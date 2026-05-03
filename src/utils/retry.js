// ========================================
// RETRY SYSTEM - Sistema de retry com backoff exponencial
// ========================================

/**
 * Retry com backoff exponencial
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options;
  
  let lastError;
  let delay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} falhou: ${error.message}`);
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      // Aguardar antes de retry
      console.log(`[Retry] Aguardando ${delay}ms antes do próximo attempt...`);
      await sleep(delay);
      
      // Backoff exponencial
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }
  
  throw lastError;
}

/**
 * Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorador
 */
export function retryable(fn, options = {}) {
  return (...args) => withRetry(() => fn(...args), options);
}

/**
 * Retry com retryable errors
 */
const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  '503',
  '502',
  '429',
  'rate_limit'
];

/**
 * Verifica se erro é retryable
 */
export function isRetryableError(error, retryableErrors = DEFAULT_RETRYABLE_ERRORS) {
  const message = error.message || error.code || String(error);
  return retryableErrors.some(e => message.includes(e));
}

/**
 * Retry com verificação de erros
 */
export async function withSmartRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    ...rest
  } = options;
  
  return withRetry(fn, {
    maxAttempts,
    shouldRetry: (error) => isRetryableError(error, retryableErrors),
    ...rest
  });
}

export default {
  withRetry,
  withSmartRetry,
  retryable,
  isRetryableError
};