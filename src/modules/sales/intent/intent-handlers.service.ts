import { Injectable, Logger } from '@nestjs/common';
import { ConversationPhase } from './intent.types';
import { PlaybookRegistry } from '../playbook/playbook-registry';

@Injectable()
export class IntentHandlers {
  private readonly logger = new Logger(IntentHandlers.name);

  constructor(private readonly playbookRegistry: PlaybookRegistry) {}

  handleGreeting(tenant: any, customer: any): string {
    const name = customer?.profileName || 'Cliente';
    const hour = new Date().getHours();

    let saludo = '';
    if (hour >= 5 && hour < 12) saludo = 'Buenos días';
    else if (hour >= 12 && hour < 19) saludo = 'Buenas tardes';
    else saludo = 'Buenas noches';

    const greetingSuffix =
      tenant.greetingKeywords?.length > 0
        ? ` ${tenant.greetingKeywords.join(' ')}`
        : '';

    return `${saludo}${greetingSuffix} ${name}! Bienvenido(a) a *${tenant.name}*. ¿En qué te puedo ayudar hoy?`;
  }

  handleFaq(matchedFaq: { question: string; answer: string }): string {
    return matchedFaq.answer;
  }

  handleHandoff(conversation: any, playbook?: any | null): string {
    conversation.isAiPaused = true;
    conversation.status = 'HUMAN_HANDOFF';
    conversation.conversationPhase = ConversationPhase.COMPLETED;

    const handoffMessage =
      playbook?.handoffMessage ||
      'Te estoy transfiriendo con un asesor humano. En breve se pondrán en contacto contigo. Por favor, espera un momento.';

    return handoffMessage;
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

  /**
   * Obtiene las instrucciones de fase — primero intenta desde el playbook,
   * luego usa el fallback hardcodeado.
   */
  getPhaseInstructions(
    phase: ConversationPhase,
    tenant?: any,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): string {
    if (playbook) {
      const resolution = this.playbookRegistry.resolve(playbook, {
        currentPhase: phase,
        turnCount: 0,
        phaseTurnCount: phaseTurnCount || 0,
        contextSummary: {},
      });

      if (resolution.instructions) {
        let instructions = resolution.instructions;

        if (resolution.goal) {
          instructions += `\nOBJETIVO DE LA FASE: ${resolution.goal.description}`;
          if (resolution.goal.requiredEntities?.length) {
            instructions += `\nEntidades requeridas: ${resolution.goal.requiredEntities.join(', ')}`;
          }
        }

        if (resolution.maxTurns) {
          instructions += `\nMáximo de turnos en esta fase: ${resolution.maxTurns}`;
        }

        return instructions;
      }
    }

    return this.getDefaultPhaseInstructions(phase, tenant);
  }

  /**
   * Verifica si la fase actual debe hacer skip de la IA.
   */
  shouldSkipAI(
    phase: ConversationPhase,
    contextSummary: any,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): boolean {
    if (phase === ConversationPhase.CITY_REQUIRED && contextSummary?.city) {
      return true;
    }

    if (playbook) {
      const resolution = this.playbookRegistry.resolve(playbook, {
        currentPhase: phase,
        turnCount: 0,
        phaseTurnCount: phaseTurnCount || 0,
        contextSummary,
      });
      return resolution.shouldSkipAI;
    }

    return false;
  }

  /**
   * Obtiene la respuesta automática — primero desde el playbook, luego fallback.
   */
  getAutoResponse(
    phase: ConversationPhase,
    contextSummary: any,
    tenant: any,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): string | null {
    if (phase === ConversationPhase.CITY_REQUIRED && contextSummary?.city) {
      const playbookAuto = playbook
        ? this.playbookRegistry.getAutoResponse(playbook, {
            currentPhase: phase,
            turnCount: 0,
            phaseTurnCount: phaseTurnCount || 0,
            contextSummary,
          }, 'CITY_DETECTED')
        : null;

      return playbookAuto || `¡Perfecto! Detecté que estás en *${contextSummary.city}*. ¿Qué estás buscando hoy?`;
    }

    return null;
  }

  /**
   * Verifica si una herramienta está bloqueada en la fase actual del playbook.
   */
  isToolBlocked(
    phase: ConversationPhase,
    toolName: string,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): boolean {
    if (!playbook) return false;

    return this.playbookRegistry.isToolBlocked(playbook, {
      currentPhase: phase,
      turnCount: 0,
      phaseTurnCount: phaseTurnCount || 0,
      contextSummary: {},
    }, toolName);
  }

  /**
   * Obtiene el prompt override del playbook para la fase actual.
   */
  getSystemPromptOverride(
    phase: ConversationPhase,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): string | null {
    if (!playbook) return null;

    return this.playbookRegistry.getSystemPromptOverride(playbook, {
      currentPhase: phase,
      turnCount: 0,
      phaseTurnCount: phaseTurnCount || 0,
      contextSummary: {},
    });
  }

  /**
   * Verifica si la conversación debe hacer handoff por timeout del playbook.
   */
  shouldHandoffOnTimeout(
    phase: ConversationPhase,
    playbook?: any | null,
    phaseTurnCount?: number,
  ): boolean {
    if (!playbook) return false;

    const resolution = this.playbookRegistry.resolve(playbook, {
      currentPhase: phase,
      turnCount: 0,
      phaseTurnCount: phaseTurnCount || 0,
      contextSummary: {},
    });

    return resolution.handoffOnTimeout;
  }

  /**
   * Instrucciones por defecto (fallback cuando no hay playbook).
   */
  private getDefaultPhaseInstructions(
    phase: ConversationPhase,
    tenant?: any,
  ): string {
    const instructions: Record<ConversationPhase, string> = {
      [ConversationPhase.GREETING]:
        'FASE ACTUAL: SALUDO. Saluda al cliente de forma breve y pregúntale desde qué ciudad contacta.',
      [ConversationPhase.CITY_REQUIRED]:
        'FASE ACTUAL: CIUDAD REQUERIDA. El cliente debe indicar su ciudad. Si aún no la tienes, solicítala de forma amable.',
      [ConversationPhase.DISCOVERY]:
        'FASE ACTUAL: DESCUBRIMIENTO. Haz preguntas abiertas para entender qué busca el cliente. NO menciones productos específicos aún.',
      [ConversationPhase.SEARCH_READY]:
        'FASE ACTUAL: LISTO PARA BUSCAR. Tienes suficiente información. Ejecuta buscar_productos con los datos recopilados.',
      [ConversationPhase.RECOMMENDATION]: tenant?.isProductsModifiable
        ? 'FASE ACTUAL: RECOMENDACIÓN. Presenta entre 1 y 3 productos reales CON SU PRECIO. Después de que el cliente elija, PREGUNTA cuántas unidades desea.'
        : 'FASE ACTUAL: RECOMENDACIÓN. Presenta entre 1 y 3 productos reales CON SU PRECIO.',
      [ConversationPhase.LOGISTICS]:
        'FASE ACTUAL: LOGÍSTICA. El cliente eligió un producto. Pregunta detalles de entrega y pago.',
      [ConversationPhase.ORDER_READY]:
        'FASE ACTUAL: LISTO PARA ORDEN. Tienes toda la información. Usa generar_orden para crear el pedido.',
      [ConversationPhase.COMPLETED]:
        'FASE ACTUAL: COMPLETADA. La interacción ha terminado.',
    };
    return instructions[phase] || instructions[ConversationPhase.DISCOVERY];
  }
}
