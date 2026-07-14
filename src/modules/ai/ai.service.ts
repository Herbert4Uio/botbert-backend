import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiService {
  constructor(private configService: ConfigService) {}

  async generateResponse(messages: any[], tools?: any[]): Promise<any> {
    const provider = this.configService.get<string>('AI_PROVIDER') || 'GROQ';
    
    let apiKey = '';
    let apiUrl = '';
    let modelName = '';

    if (provider === 'OPENAI') {
      apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      modelName = 'gpt-4o-mini';
    } else {
      apiKey = this.configService.get<string>('GROQ_API_KEY') || '';
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      modelName = 'llama-3.3-70b-versatile';
    }

    const payload: any = {
      messages,
      model: modelName,
      temperature: 0.2 // Reducido para mayor precisión en la extracción de datos (tool calling)
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message; // Retornamos el objeto message completo (content + tool_calls)
    } catch (error: any) {
      console.error(`Error with ${provider} API:`, error.response?.data || error.message);
      return { role: 'assistant', content: 'Lo siento, en este momento estoy teniendo problemas para procesar la información. Por favor intenta en unos minutos.' };
    }
  }
}
