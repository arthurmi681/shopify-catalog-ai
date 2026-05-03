// ========================================
// OPENAI CLIENT - Cliente da API da OpenAI
// ========================================

import OpenAI from 'openai';

/**
 * Cria cliente da OpenAI API
 */
class OpenAIClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('[OpenAI] API key não configurada');
      return;
    }
    
    this.client = new OpenAI({
      apiKey: this.apiKey
    });
  }
  
  /**
   *.chat.completions.create wrapper
   */
  async chatCompletions(options) {
    if (!this.client) {
      throw new Error('OpenAI não configurada');
    }
    
    return this.client.chat.completions.create(options);
  }
  
  /**
   * Gera texto com GPT
   */
  async generate(prompt, options = {}) {
    const response = await this.chatCompletions({
      model: options.model || 'gpt-4o',
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
      model: 'gpt-4o',
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

export const openAIClient = new OpenAIClient();
export default openAIClient;