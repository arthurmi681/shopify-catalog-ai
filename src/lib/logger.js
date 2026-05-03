// ========================================
// LOGGER - Sistema de logs
// ========================================

import { supabaseClient } from './supabase.js';

/**
 * Log de evento
 * @param {string} agentName - Nome do agente
 * @param {string} action - Ação realizada
 * @param {string} status - Status (success, error, warning)
 * @param {Object} details - Detalhes adicionais
 * @param {number} durationMs - Duração em milissegundos
 */
export async function logEvent(agentName, action, status, details = {}, durationMs = null) {
  const log = {
    agent: agentName,
    action,
    status,
    details,
    durationMs,
    timestamp: new Date().toISOString()
  };
  
  // Log no console
  const color = status === 'error' ? '\x1b[31m' : status === 'warning' ? '\x1b[33m' : '\x1b[32m';
  console.log(`${color}[${agentName}]${'\x1b[0m'} ${action} - ${status} ${durationMs ? `(${durationMs}ms)` : ''}`);
  
  // Salvar no Supabase
  try {
    if (supabaseClient) {
      await supabaseClient.log(agentName, action, status, details, durationMs);
    }
  } catch (err) {
    console.error('[Logger] Erro ao salvar no Supabase:', err.message);
  }
  
  return log;
}

/**
 * Log de erro
 */
export function logError(agentName, action, error) {
  return logEvent(agentName, action, 'error', {
    error: error.message || error,
    stack: error.stack
  });
}

/**
 * Log de warning
 */
export function logWarning(agentName, action, message) {
  return logEvent(agentName, action, 'warning', { message });
}

/**
 * Log de info
 */
export function logInfo(message) {
  console.log(`\x1b[36m[INFO]${'\x1b[0m'} ${message}`);
}

/**
 * Log de debug
 */
export function logDebug(message) {
  if (process.env.DEBUG) {
    console.log(`\x1b[90m[DEBUG]${'\x1b[0m'} ${message}`);
  }
}

export default {
  logEvent,
  logError,
  logWarning,
  logInfo,
  logDebug
};