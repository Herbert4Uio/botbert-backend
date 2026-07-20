import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiService {
  constructor(private configService: ConfigService) {}

  private getProviderConfig() {
    const provider = this.configService.get<string>('AI_PROVIDER') || 'GROQ';

    if (provider === 'OPENAI') {
      return {
        provider,
        apiKey: this.configService.get<string>('OPENAI_API_KEY') || '',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        modelName: 'gpt-4o-mini',
      };
    }

    return {
      provider,
      apiKey: this.configService.get<string>('GROQ_API_KEY') || '',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      modelName: 'llama-3.3-70b-versatile',
    };
  }

  async generateStructuredPrompt(businessDescription: string): Promise<string> {
    const { apiKey, apiUrl, modelName } = this.getProviderConfig();

    const metaPrompt = `Eres un experto en ingeniería de prompts para chatbots de ventas por WhatsApp. Tu tarea es tomar una DESCRIPCIÓN DEL NEGOCIO y convertirla en un System Prompt estructurado y optimizado para un chatbot de ventas que funciona con la siguiente arquitectura interna.

========================================
DESCRIPCIÓN DEL NEGOCIO:
========================================
${businessDescription}

========================================
ARQUITECTURA DEL SISTEMA (OBLIGATORIA):
========================================
El chatbot tiene las siguientes herramientas (tools) disponibles que DEBES referenciar correctamente en el prompt:

1. buscar_productos: Busca productos en la base de datos del tenant.
   - Parámetros: query (string), minPrice (number), maxPrice (number), customerCity (string - OBLIGATORIO)
   - Se usa DESPUÉS de conocer la ciudad del cliente.

2. generar_orden: Cierra la venta y genera una orden.
   - Parámetros: paymentType, paymentTiming, deliveryType, customerCity, branchId, shippingDate, shippingTimeRange, shippingAddress, shippingInstructions, billingName, billingNit, items (array con productId, quantity, modifications)
   - Se usa SOLO cuando se recolectó toda la información.

3. actualizar_resumen_venta: Guarda información importante del cliente.
   - Parámetros: resumen (string)
   - Se usa para no olvidar detalles en conversaciones largas.

El sistema tiene un embudo de ventas obligatorio con estas fases:
- GREETING → CITY_REQUIRED → DISCOVERY → SEARCH_READY → RECOMMENDATION → LOGISTICS → ORDER_READY → COMPLETED

========================================
INSTRUCCIONES:
========================================
Genera un System Prompt que incluya:

1. [CONTEXTO DEL SISTEMA]: Un bloque que diga EXACTAMENTE:
   "Información de tu Empresa: {NOMBRE_DEL_NEGOCIO}"
   "Sucursales disponibles:" (dejar un placeholder)
    "RESUMEN DE DATOS OBTENIDOS HASTA AHORA" (dejar el placeholder exacto: \${conversation.summary || 'Aún no hay datos guardados.'})
   "FECHA ACTUAL:" (dejar el placeholder: ${new Date().toISOString().split('T')[0]})

2. [INSTRUCCIONES DEL TENANT]: La personalidad, tono y comportamiento específico del negocio descrito. Incluye:
   - Qué vende el negocio
   - Cómo debe comportarse el asistente (formal, casual, etc.)
   - Reglas específicas del negocio (ej. "siempre pregunta el tamaño", "ofrecer complementos")
   - Qué hacer y qué NO hacer

3. [OBJETIVO PRINCIPAL]: Instrucciones de cómo facilitar la decisión del cliente.

4. [REGLAS PARA DISMINUIR EL DOLOR DE DECIDIR]: Máximo 3 productos, una pregunta por mensaje, etc.

5. [EMBUDO DE VENTAS]: Instrucciones para cada fase del embudo adaptadas al negocio.

6. [CLASIFICACIÓN DE LA INTENCIÓN]: Escenarios del cliente (producto específico, no sabe qué quiere, etc.)

7. [LOGÍSTICA Y CIERRE]: Cómo cerrar la venta.

========================================
REGLAS DE GENERACIÓN:
========================================
- El prompt DEBE contener el placeholder exacto: \${conversation.summary || 'Aún no hay datos guardados.'}
- El prompt DEBE contener el placeholder: \${new Date().toISOString().split('T')[0]}
- El prompt DEBE ser escrito en español.
- El prompt NO debe mencionar herramientas técnicas como "tool calling", "API", "endpoints". Solo describe el comportamiento.
- El prompt DEBE mantener las instrucciones de las fases del embudo (GREETING → COMPLETED).
- El prompt debe ser conciso pero completo. Máximo 2000 tokens.
- NO incluyas el bloque [ORQUESTADOR DE HERRAMIENTAS Y SEGURIDAD] ni las reglas anti-alucinación, ya que el sistema las inyecta automáticamente.
- NO incluyas la sección de PERSONALIZACIÓN DE PRODUCTOS, el sistema la inyecta si el tenant la activa.

Responde SOLO con el prompt generado, sin explicaciones adicionales, sin bloques de código markdown, sin "Aquí está tu prompt:". Solo el texto plano del prompt.`;

    const payload = {
      messages: [{ role: 'user', content: metaPrompt }],
      model: modelName,
      temperature: 0.7,
      max_tokens: 4000,
    };

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.choices[0].message.content.trim();
    } catch (error: any) {
      console.error(
        `Error generating structured prompt:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async generateResponse(messages: any[], tools?: any[]): Promise<any> {
    const { apiKey, apiUrl, modelName } = this.getProviderConfig();

    const payload: any = {
      messages,
      model: modelName,
      temperature: 0.2,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.choices[0].message;
    } catch (error: any) {
      console.error(
        `Error with provider API:`,
        error.response?.data || error.message,
      );
      return {
        role: 'assistant',
        content:
          'Lo siento, en este momento estoy teniendo problemas para procesar la información. Por favor intenta en unos minutos.',
      };
    }
  }
}
