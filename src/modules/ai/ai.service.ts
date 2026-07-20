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

    const metaPrompt = `Eres un ingeniero de prompts experto en chatbots de ventas por WhatsApp. Tu ÚNICA tarea es tomar una DESCRIPCIÓN DE NEGOCIO de un usuario y ADAPTARLA para que funcione correctamente con un sistema de chatbot automatizado.

El usuario te pegará el prompt tal cual lo escribió para su negocio. Tu trabajo es:
1. PRESERVAR al 100% la lógica de negocio, productos, precios, reglas y estilo del usuario.
2. INTEGRAR instrucciones que le digan al chatbot CUÁNDO y CÓMO usar las herramientas del sistema.
3. ASEGURAR que el chatbot sepa cuándo cambiar de fase en la conversación.

========================================
DESCRIPCIÓN DEL NEGOCIO (PROMPT DEL USUARIO):
========================================
${businessDescription}

========================================
HERRAMIENTAS DEL SISTEMA QUE EL CHATBOT PUEDE USAR:
========================================

El chatbot tiene estas herramientas internas. DEBES instruir al asistente para que las use en los momentos correctos:

1. BUSCAR PRODUCTOS
   - QUÉ HACE: Busca productos reales en la base de datos del negocio.
   - CUÁNDO USARLA: Cuando el cliente ya indicó qué busca y necesitas encontrar opciones reales para mostrarle. SIEMPRE usa esta herramienta antes de recomendar productos. NUNCA inventes productos, precios ni disponibilidad.
   - QUÉ NECESITA: La ciudad del cliente (obligatorio) y palabras clave de lo que busca.
   - QUÉ HACE EL SISTEMA: Busca en la base de datos, filtra por ciudad y precio, y devuelve las opciones reales con sus precios exactos.

2. GENERAR ORDEN
   - QUÉ HACE: Registra el pedido oficial del cliente en el sistema.
   - CUÁNDO USARLA: SOLO cuando ya tienes TODA la información: producto elegido, cantidad, logística (envío/recojo), pago, facturación (nombre y NIT si aplica). NUNCA generes una orden con datos incompletos.
   - QUÉ NECESITA: Todo lo que el cliente confirmó a lo largo de la conversación.
   - QUÉ HACE EL SISTEMA: Crea la orden, notifica al equipo y al cliente.

3. ACTUALIZAR RESUMEN
   - QUÉ HACE: Guarda datos importantes que el cliente mencionó para no olvidarlos.
   - CUÁNDO USARLA: Cuando la conversación se alarga y el cliente dio datos clave (ciudad, preferencias, presupuesto, dirección, etc.). Llámala para persistir esa información.
   - QUÉ NECESITA: Un texto resumen con los datos confirmados.

========================================
INSTRUCCIONES DE INTEGRACIÓN (AGREGA ESTAS SECCIONES AL PROMPT):
========================================

Después de las secciones de lógica de negocio del usuario, AGREGA las siguientes secciones EXACTAMENTE así:

---SECCIÓN: CONEXIÓN CON EL SISTEMA DE BÚSQUEDA---

Agrega un bloque que le diga al asistente:

"Cuando el cliente haya indicado qué producto o tipo de producto busca, DEBES buscar en el catálogo del negocio antes de recomendar algo. Para hacerlo, necesitas conocer la ciudad del cliente.

Si ya conoces la ciudad y el cliente describió lo que busca, ejecuta la búsqueda interna con la ciudad y las palabras clave del cliente.

Si aún no conoces la ciudad, pregúntala primero antes de buscar.

NUNCA recomiendes productos de memoria. SIEMPRE busca en el catálogo real. Los resultados que obtengas son los ÚNICOS productos que puedes ofrecer."

---SECCIÓN: FLUJO DE CONVERSACIÓN Y CAMBIO DE FASES---

Agrega un bloque que describa el embudo de ventas:

"El asistente debe guiar al cliente por este flujo paso a paso:

1. FASE SALUDO: Bienvenida breve. Si el cliente no dice qué busca, preguntar por qué necesita ayuda.

2. FASE CIUDAD: Si la ciudad no fue mencionada, preguntar '¿Desde qué ciudad nos contactas?' (Es obligatoria para buscar disponibilidad y precios).

3. FASE DESCUBRIMIENTO: Haz preguntas abiertas para entender qué busca el cliente. NO menciones productos específicos aún. Pregunta por ocasión, preferencias, frecuencia, presupuesto, etc.

4. FASE BÚSQUEDA: Cuando tengas suficiente información (ciudad + lo que busca), ejecuta la búsqueda en el catálogo.

5. FASE RECOMENDACIÓN: Presenta entre 1 y 3 opciones REALES de la base de datos. Explica por qué cada una se ajusta al cliente. Espera que elija.

6. FASE LOGÍSTICA: Una vez elegido el producto, define: envío o recojo, forma de pago, facturación (nombre y NIT).

7. FASE ORDEN: Cuando tengas toda la información, registra el pedido."

---SECCIÓN: CUÁNDO USAR CADA ACCIÓN---

Agrega un bloque con reglas claras:

"REGLAS DE ACCIÓN:

- El cliente menciona lo que busca + ya tienes la ciudad → Busca en el catálogo inmediatamente.
- El cliente elige un producto → Avanza a logística (envío/recojo, pago).
- El cliente pregunta por precios o disponibilidad → Busca en el catálogo con la ciudad.
- La conversación es larga y se mencionaron datos importantes → Guarda un resumen.
- Tienes producto + logística + pago + facturación → Registra la orden.
- El cliente menciona alergias o restricciones → Anótalo como nota en la orden. No confirmes que un producto es apto sin verificar.
- No sabes algo (precio, disponibilidad, ingrediente) → Di 'Prefiero confirmarlo con el equipo' y no inventes."

========================================
REGLAS DE GENERACIÓN:
========================================
- PRESERVA el 100% del contenido del usuario: productos, precios, planes, reglas, tono, ejemplos, descripciones. No modifiques ni elimines nada de su lógica de negocio.
- AGREGA las secciones de integración del sistema DESPUÉS de la lógica del usuario, no antes.
- NO expongas nombres técnicos como "tool calling", "API", "buscar_productos", "generar_orden". Describe el COMPORTAMIENTO en lenguaje natural (ej. "busca en el catálogo", "registra el pedido").
- NO incluyas placeholders como \${conversation.summary} ni \${new Date()}. El sistema los maneja automáticamente.
- NO incluyas secciones como [CONTEXTO DEL SISTEMA] o [RESUMEN DE DATOS]. El sistema las inyecta solo.
- NO incluyas reglas de seguridad anti-alucinación ni anti-jailbreak. El sistema las inyecta solo.
- Escribe TODO en español.
- Sé completo. Un prompt largo y detallado es mejor que uno corto y vago.
- Responde SOLO con el prompt generado. Sin explicaciones, sin bloques markdown, sin "Aquí está tu prompt:". Solo texto plano.`;

    const payload = {
      messages: [{ role: 'user', content: metaPrompt }],
      model: modelName,
      temperature: 0.7,
      max_tokens: 8000,
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
