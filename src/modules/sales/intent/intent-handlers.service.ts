import { Injectable, Logger } from '@nestjs/common';
import { ConversationPhase } from './intent.types';

@Injectable()
export class IntentHandlers {
  private readonly logger = new Logger(IntentHandlers.name);

  handleGreeting(tenant: any, customer: any): string {
    const name = customer?.profileName || 'Cliente';
    const hour = new Date().getHours();

    let saludo = '';
    if (hour >= 5 && hour < 12) saludo = 'Buenos días';
    else if (hour >= 12 && hour < 19) saludo = 'Buenas tardes';
    else saludo = 'Buenas noches';

    // Usar keywords de saludo personalizadas (todas concatenadas)
    const greetingSuffix =
      tenant.greetingKeywords?.length > 0
        ? ` ${tenant.greetingKeywords.join(' ')}`
        : '';

    return `${saludo}${greetingSuffix} ${name}! Bienvenido(a) a *${tenant.name}*. ¿En qué te puedo ayudar hoy?`;
  }

  handleFaq(matchedFaq: { question: string; answer: string }): string {
    return matchedFaq.answer;
  }

  handleHandoff(conversation: any): string {
    conversation.isAiPaused = true;
    conversation.status = 'HUMAN_HANDOFF';
    conversation.conversationPhase = ConversationPhase.COMPLETED;
    return 'Te estoy transfiriendo con un asesor humano. En breve se pondrán en contacto contigo. Por favor, espera un momento.';
  }

  updatePhaseAfterGreeting(conversation: any): void {
    if (conversation.conversationPhase === ConversationPhase.GREETING) {
      conversation.conversationPhase = ConversationPhase.CITY_REQUIRED;
    }
  }

  updatePhaseAfterCity(conversation: any, city: string): void {
    if (conversation.contextSummary) {
      conversation.contextSummary.city = city;
    } else {
      conversation.contextSummary = { city };
    }
    conversation.conversationPhase = ConversationPhase.DISCOVERY;
  }

  updatePhaseAfterSearch(conversation: any): void {
    conversation.conversationPhase = ConversationPhase.RECOMMENDATION;
  }

  // Llamar cuando el cliente CONFIRMA la elección de un producto (ej. "me quedo con el option 2")
  updatePhaseAfterProductChosen(conversation: any): void {
    conversation.conversationPhase = ConversationPhase.LOGISTICS;
  }

  updatePhaseAfterOrder(conversation: any): void {
    conversation.conversationPhase = ConversationPhase.COMPLETED;
  }

  shouldAutoAskCity(conversation: any): boolean {
    return (
      conversation.conversationPhase === ConversationPhase.CITY_REQUIRED &&
      !conversation.contextSummary?.city
    );
  }

  shouldAutoRecommend(conversation: any): boolean {
    return (
      conversation.conversationPhase === ConversationPhase.DISCOVERY &&
      conversation.contextSummary?.city &&
      conversation.lastSearchResults?.length > 0
    );
  }

  getPhaseInstructions(phase: ConversationPhase, tenant?: any): string {
    const instructions: Record<ConversationPhase, string> = {
      [ConversationPhase.GREETING]:
        'FASE ACTUAL: SALUDO. Saluda al cliente de forma breve y pregúntale desde qué ciudad contacta.',
      [ConversationPhase.CITY_REQUIRED]:
        'FASE ACTUAL: CIUDAD REQUERIDA. El cliente debe indicar su ciudad. Si aún no la tienes, solicítala de forma amable. Si ya la tienes, confírmala y avanza a descubrimiento.',
      [ConversationPhase.DISCOVERY]:
        'FASE ACTUAL: DESCUBRIMIENTO. Haz preguntas abiertas para entender qué busca el cliente (ocasión, preferencias, destinatario). NO menciones productos específicos aún.',
      [ConversationPhase.SEARCH_READY]:
        'FASE ACTUAL: LISTO PARA BUSCAR. Tienes suficiente información. Ejecuta buscar_productos con los datos recopilados.',
      [ConversationPhase.RECOMMENDATION]: tenant?.isProductsModifiable
        ? 'FASE ACTUAL: RECOMENDACIÓN. Presenta entre 1 y 3 productos reales de la base de datos CON SU PRECIO. Después de que el cliente elija, PREGUNTA cuántas unidades desea. Luego USA la pregunta de personalización configurada para ofrecerle notas o modificaciones. Espera su respuesta antes de avanzar a logística.'
        : 'FASE ACTUAL: RECOMENDACIÓN. Presenta entre 1 y 3 productos reales de la base de datos CON SU PRECIO. Después de que el cliente elija, PREGUNTA cuántas unidades desea ANTES de avanzar a logística.',
      [ConversationPhase.LOGISTICS]:
        'FASE ACTUAL: LOGÍSTICA. El cliente eligió un producto y confirmó la cantidad. PRIMERO verifica cuál es la sucursal disponible en la ciudad del cliente (revisa la lista de sucursales en el contexto). Luego define las opciones de entrega: si la sucursal tiene [Solo Envío a Domicilio], solo ofrece envío. Si no tiene esa etiqueta, ofrece envío o recojo. Después pregunta pago y facturación (nombre completo y NIT).',
      [ConversationPhase.ORDER_READY]:
        'FASE ACTUAL: LISTO PARA ORDEN. Tienes toda la información. Usa generar_orden para crear el pedido.',
      [ConversationPhase.COMPLETED]:
        'FASE ACTUAL: COMPLETADA. La interacción ha terminado. Si el cliente inicia una nueva conversación, reinicia el flujo.',
    };
    return instructions[phase] || instructions[ConversationPhase.DISCOVERY];
  }

  shouldSkipAI(phase: ConversationPhase, contextSummary: any): boolean {
    if (phase === ConversationPhase.CITY_REQUIRED && contextSummary?.city) {
      return true;
    }
    return false;
  }

  getAutoResponse(
    phase: ConversationPhase,
    contextSummary: any,
    tenant: any,
  ): string | null {
    if (phase === ConversationPhase.CITY_REQUIRED && contextSummary?.city) {
      return `¡Perfecto! Detecté que estás en *${contextSummary.city}*. ¿Qué estás buscando hoy?`;
    }
    return null;
  }
}
