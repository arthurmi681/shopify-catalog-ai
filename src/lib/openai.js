// ========================================
// GROQ CLIENT - Cliente da API da Groq (gratuito)
// ========================================

import OpenAI from 'openai';

/**
 * Cria cliente da Groq API
 */
class GroqClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('[Groq] API key não configurada');
      return;
    }
    
    // Groq usa a mesma lib OpenAI, mas com endpoint diferente
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }
  
  /**
   *.chat.completions.create wrapper
   */
  async chatCompletions(options) {
    if (!this.client) {
      throw new Error('Groq não configurada');
    }
    
    return this.client.chat.completions.create(options);
  }
  
  /**
   * Gera texto com Groq (Llama ou Mixtral)
   */
  async generate(prompt, options = {}) {
    const response = await this.chatCompletions({
      model: options.model || 'llama-3.3-70b-versatile',
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    return response.choices[0].message.content;
  }
  
  /**
   * Análise de produto
   */
  async analyzeProduct(productData) {
    const response = await this.chatCompletions({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em e-commerce.'
        },
        {
          role: 'user',
          content: `Analise: ${JSON.stringify(productData)}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}

// ========================================
// EXPORTS
// ========================================

export const openAIClient = new GroqClient();
export default openAIClient;