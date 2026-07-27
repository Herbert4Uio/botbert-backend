import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Playbook } from './schemas/playbook.schema';
import {
  PlaybookPhase,
  PlaybookResolution,
  PlaybookExecutionContext,
  TransitionTrigger,
  GoalType,
} from './playbook.types';

@Injectable()
export class PlaybookRegistry {
  private readonly logger = new Logger(PlaybookRegistry.name);

  private defaultPlaybook: Playbook;

  constructor(
    @InjectModel(Playbook.name)
    private playbookModel: Model<Playbook>,
  ) {
    this.defaultPlaybook = this.buildDefaultPlaybook();
  }

  /**
   * Resuelve la fase actual de una conversación y retorna las instrucciones,
   * herramientas permitidas, y comportamiento esperado.
   */
  resolve(
    playbook: any | null,
    context: PlaybookExecutionContext,
  ): PlaybookResolution {
    const activePlaybook = playbook || this.defaultPlaybook;
    const phase = this.findPhase(activePlaybook, context.currentPhase);

    if (!phase) {
      this.logger.warn(
        `⚠️ Fase "${context.currentPhase}" no encontrada en playbook "${activePlaybook.name}". Usando fallback.`,
      );
      const fallbackPhase = this.findPhase(
        activePlaybook,
        activePlaybook.fallbackPhase || 'DISCOVERY',
      );
      return this.buildResolution(fallbackPhase || this.getDefaultPhase('DISCOVERY'), context);
    }

    if (!phase.enabled) {
      this.logger.warn(
        `⚠️ Fase "${context.currentPhase}" deshabilitada en playbook. Saltando...`,
      );
      const nextPhase = this.findNextEnabledPhase(activePlaybook, phase.order);
      if (nextPhase) {
        return this.buildResolution(nextPhase, context);
      }
    }

    return this.buildResolution(phase, context);
  }

  /**
   * Determina si la fase actual debe transicionar a la siguiente.
   */
  shouldTransition(
    playbook: any | null,
    context: PlaybookExecutionContext,
  ): { shouldTransition: boolean; targetPhase?: string; trigger?: string } {
    const activePlaybook = playbook || this.defaultPlaybook;
    const phase = this.findPhase(activePlaybook, context.currentPhase);

    if (!phase) return { shouldTransition: false };

    // 1. Verificar maxTurns
    if (phase.maxTurns && context.phaseTurnCount >= phase.maxTurns) {
      const autoTransition = phase.transitions.find(
        (t: any) => t.trigger === TransitionTrigger.PHASE_MAX_TURNS,
      );
      if (autoTransition) {
        return {
          shouldTransition: true,
          targetPhase: autoTransition.targetPhase,
          trigger: TransitionTrigger.PHASE_MAX_TURNS,
        };
      }
      return {
        shouldTransition: true,
        targetPhase: activePlaybook.fallbackPhase || 'DISCOVERY',
        trigger: TransitionTrigger.PHASE_MAX_TURNS,
      };
    }

    // 2. Verificar timeout
    if (phase.timeoutMinutes && phase.handoffOnTimeout) {
      return { shouldTransition: false };
    }

    // 3. Verificar maxConversationTurns global
    if (
      activePlaybook.maxConversationTurns &&
      context.turnCount >= activePlaybook.maxConversationTurns
    ) {
      return {
        shouldTransition: true,
        targetPhase: 'COMPLETED',
        trigger: TransitionTrigger.PHASE_MAX_TURNS,
      };
    }

    return { shouldTransition: false };
  }

  /**
   * Obtiene la respuesta automática para una fase, si existe.
   */
  getAutoResponse(
    playbook: any | null,
    context: PlaybookExecutionContext,
    trigger: string,
  ): string | null {
    const activePlaybook = playbook || this.defaultPlaybook;
    const phase = this.findPhase(activePlaybook, context.currentPhase);

    if (!phase?.autoResponses?.length) return null;

    const match = phase.autoResponses.find((ar: any) => ar.trigger === trigger);
    return match?.message || null;
  }

  /**
   * Verifica si una herramienta está bloqueada en la fase actual.
   */
  isToolBlocked(
    playbook: any | null,
    context: PlaybookExecutionContext,
    toolName: string,
  ): boolean {
    const activePlaybook = playbook || this.defaultPlaybook;
    const phase = this.findPhase(activePlaybook, context.currentPhase);

    if (!phase) return false;

    if (phase.blockedTools?.length) {
      return phase.blockedTools.includes(toolName);
    }

    if (phase.requiredTools?.length) {
      return !phase.requiredTools.includes(toolName);
    }

    return false;
  }

  /**
   * Obtiene el prompt del sistema override para una fase.
   */
  getSystemPromptOverride(
    playbook: any | null,
    context: PlaybookExecutionContext,
  ): string | null {
    const activePlaybook = playbook || this.defaultPlaybook;
    const phase = this.findPhase(activePlaybook, context.currentPhase);
    return phase?.systemPromptOverride || null;
  }

  /**
   * Crea un playbook por defecto basado en el tipo de vertical.
   */
  static createForVertical(verticalType: string, tenantId: string): any {
    const templates: Record<string, any> = {
      retail: {
        name: 'Playbook Retail',
        description: 'Flujo estándar para tiendas de retail',
        verticalType: 'retail',
        phases: PlaybookRegistry.getRetailPhases(),
      },
      restaurante: {
        name: 'Playbook Restaurante',
        description: 'Flujo para restaurantes con énfasis en menú y pedidos',
        verticalType: 'restaurante',
        phases: PlaybookRegistry.getRestaurantPhases(),
      },
      inmobiliaria: {
        name: 'Playbook Inmobiliaria',
        description: 'Flujo para inmobiliarias con calificación de leads',
        verticalType: 'inmobiliaria',
        phases: PlaybookRegistry.getRealEstatePhases(),
      },
      servicios: {
        name: 'Playbook Servicios',
        description: 'Flujo para negocios de servicios (salón, taller, etc.)',
        verticalType: 'servicios',
        phases: PlaybookRegistry.getServicePhases(),
      },
    };

    const template = templates[verticalType] || templates.retail;

    return {
      ...template,
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
      isDefault: true,
      maxConversationTurns: 50,
      timeoutMinutes: 120,
      handoffMessage: 'Te estoy transfiriendo con un asesor. Un momento por favor.',
      fallbackPhase: 'DISCOVERY',
    };
  }

  // ── Plantillas de fases por vertical ──

  private static getRetailPhases(): PlaybookPhase[] {
    return [
      {
        id: 'greeting',
        name: 'Saludo',
        phaseType: 'GREETING' as any,
        order: 0,
        enabled: true,
        instructions: 'Saluda al cliente de forma breve y cálida. Pregúntale en qué puedes ayudar.',
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.MESSAGE_RECEIVED, targetPhase: 'discovery' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'discovery',
        name: 'Descubrimiento',
        phaseType: 'DISCOVERY' as any,
        order: 1,
        enabled: true,
        instructions: 'Haz preguntas abiertas para entender qué busca el cliente. NO menciones productos aún.',
        goal: {
          type: GoalType.COLLECT_INFO,
          description: 'Recopilar necesidades del cliente',
          requiredEntities: ['keywords'],
          maxTurns: 5,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.CITY_DETECTED, targetPhase: 'search_ready' },
          { trigger: TransitionTrigger.PHASE_MAX_TURNS, targetPhase: 'search_ready' },
        ],
        autoResponses: [],
        maxTurns: 5,
        handoffOnTimeout: false,
      },
      {
        id: 'search_ready',
        name: 'Listo para buscar',
        phaseType: 'SEARCH_READY' as any,
        order: 2,
        enabled: true,
        instructions: 'Tienes suficiente información. Ejecuta buscar_productos con los datos recopilados.',
        skipAI: false,
        requiredTools: ['buscar_productos'],
        transitions: [
          { trigger: TransitionTrigger.TOOL_CALLED, targetPhase: 'recommendation' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'recommendation',
        name: 'Recomendación',
        phaseType: 'RECOMMENDATION' as any,
        order: 3,
        enabled: true,
        instructions: 'Presenta entre 1 y 3 productos reales CON SU PRECIO. Espera que el cliente elija.',
        goal: {
          type: GoalType.RECOMMEND,
          description: 'Presentar productos y que el cliente elija',
          maxTurns: 5,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PRODUCT_CHOSEN, targetPhase: 'logistics' },
        ],
        autoResponses: [],
        maxTurns: 5,
        handoffOnTimeout: false,
      },
      {
        id: 'logistics',
        name: 'Logística',
        phaseType: 'LOGISTICS' as any,
        order: 4,
        enabled: true,
        instructions: 'Pregunta detalles de entrega: dirección, horario de preferencia, método de pago.',
        goal: {
          type: GoalType.CLOSE_SALE,
          description: 'Recopilar datos de entrega y pago',
          requiredEntities: ['hasAddress'],
          maxTurns: 4,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.AUTO_ADVANCE, targetPhase: 'order_ready' },
        ],
        autoResponses: [],
        maxTurns: 4,
        handoffOnTimeout: false,
      },
      {
        id: 'order_ready',
        name: 'Listo para orden',
        phaseType: 'ORDER_READY' as any,
        order: 5,
        enabled: true,
        instructions: 'Tienes toda la información. Usa generar_orden para crear el pedido.',
        skipAI: false,
        requiredTools: ['generar_orden'],
        transitions: [
          { trigger: TransitionTrigger.ORDER_GENERATED, targetPhase: 'completed' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'completed',
        name: 'Completado',
        phaseType: 'COMPLETED' as any,
        order: 6,
        enabled: true,
        instructions: 'La interacción ha terminado. Agradece al cliente.',
        skipAI: false,
        transitions: [],
        autoResponses: [],
        maxTurns: 1,
        handoffOnTimeout: false,
      },
    ];
  }

  private static getRestaurantPhases(): PlaybookPhase[] {
    return [
      {
        id: 'greeting',
        name: 'Saludo',
        phaseType: 'GREETING' as any,
        order: 0,
        enabled: true,
        instructions: 'Saluda al cliente. Pregunta si desea ver el menú del día o tiene una preferencia.',
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.MESSAGE_RECEIVED, targetPhase: 'discovery' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'discovery',
        name: 'Descubrimiento',
        phaseType: 'DISCOVERY' as any,
        order: 1,
        enabled: true,
        instructions: 'Pregunta qué tipo de comida busca, si tiene alergias, y para cuántas personas es.',
        goal: {
          type: GoalType.COLLECT_INFO,
          description: 'Recopilar preferencias alimentarias y cantidad',
          requiredEntities: ['keywords', 'quantity'],
          maxTurns: 4,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PHASE_MAX_TURNS, targetPhase: 'search_ready' },
        ],
        autoResponses: [],
        maxTurns: 4,
        handoffOnTimeout: false,
      },
      {
        id: 'search_ready',
        name: 'Buscar platos',
        phaseType: 'SEARCH_READY' as any,
        order: 2,
        enabled: true,
        instructions: 'Busca platos en el catálogo que coincidan con las preferencias.',
        skipAI: false,
        requiredTools: ['buscar_productos'],
        transitions: [
          { trigger: TransitionTrigger.TOOL_CALLED, targetPhase: 'recommendation' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'recommendation',
        name: 'Recomendar platos',
        phaseType: 'RECOMMENDATION' as any,
        order: 3,
        enabled: true,
        instructions: 'Presenta máximo 3 platos con precio. Recuerda preguntar por alergias si no lo hizo.',
        goal: {
          type: GoalType.RECOMMEND,
          description: 'Que el cliente elija su plato',
          maxTurns: 4,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PRODUCT_CHOSEN, targetPhase: 'logistics' },
        ],
        autoResponses: [],
        maxTurns: 4,
        handoffOnTimeout: false,
      },
      {
        id: 'logistics',
        name: 'Detalles del pedido',
        phaseType: 'LOGISTICS' as any,
        order: 4,
        enabled: true,
        instructions: 'Pregunta: hora de recojo/envío, dirección si es delivery, método de pago.',
        goal: {
          type: GoalType.CLOSE_SALE,
          description: 'Confirmar detalles del pedido',
          maxTurns: 3,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.AUTO_ADVANCE, targetPhase: 'order_ready' },
        ],
        autoResponses: [],
        maxTurns: 3,
        handoffOnTimeout: false,
      },
      {
        id: 'order_ready',
        name: 'Confirmar pedido',
        phaseType: 'ORDER_READY' as any,
        order: 5,
        enabled: true,
        instructions: 'Usa generar_orden para registrar el pedido.',
        skipAI: false,
        requiredTools: ['generar_orden'],
        transitions: [
          { trigger: TransitionTrigger.ORDER_GENERATED, targetPhase: 'completed' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'completed',
        name: 'Completado',
        phaseType: 'COMPLETED' as any,
        order: 6,
        enabled: true,
        instructions: 'Pedido registrado. Agradece y confirma los detalles.',
        skipAI: false,
        transitions: [],
        autoResponses: [],
        maxTurns: 1,
        handoffOnTimeout: false,
      },
    ];
  }

  private static getRealEstatePhases(): PlaybookPhase[] {
    return [
      {
        id: 'greeting',
        name: 'Saludo formal',
        phaseType: 'GREETING' as any,
        order: 0,
        enabled: true,
        instructions: 'Saluda de forma formal. Preséntate como asesor inmobiliario.',
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.MESSAGE_RECEIVED, targetPhase: 'qualification' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'qualification',
        name: 'Calificación',
        phaseType: 'CUSTOM' as any,
        order: 1,
        enabled: true,
        instructions: 'Califica al lead: presupuesto, zona deseada, tipo de propiedad, urgencia.',
        goal: {
          type: GoalType.COLLECT_INFO,
          description: 'Calificar al lead inmobiliario',
          requiredEntities: ['budget', 'city', 'keywords'],
          maxTurns: 5,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PHASE_MAX_TURNS, targetPhase: 'search_ready' },
        ],
        autoResponses: [],
        maxTurns: 5,
        handoffOnTimeout: false,
      },
      {
        id: 'search_ready',
        name: 'Buscar propiedades',
        phaseType: 'SEARCH_READY' as any,
        order: 2,
        enabled: true,
        instructions: 'Busca propiedades que coincidan con el perfil del lead.',
        skipAI: false,
        requiredTools: ['buscar_productos'],
        transitions: [
          { trigger: TransitionTrigger.TOOL_CALLED, targetPhase: 'recommendation' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'recommendation',
        name: 'Mostrar propiedades',
        phaseType: 'RECOMMENDATION' as any,
        order: 3,
        enabled: true,
        instructions: 'Presenta máximo 2 propiedades con precio referencial. Enfócate en beneficios.',
        goal: {
          type: GoalType.RECOMMEND,
          description: 'Generar interés en una propiedad',
          maxTurns: 6,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PRODUCT_CHOSEN, targetPhase: 'logistics' },
        ],
        autoResponses: [],
        maxTurns: 6,
        handoffOnTimeout: false,
      },
      {
        id: 'logistics',
        name: 'Coordinar visita',
        phaseType: 'LOGISTICS' as any,
        order: 4,
        enabled: true,
        instructions: 'Ofrece coordinar una visita presencial o virtual. Pregunta disponibilidad horaria.',
        goal: {
          type: GoalType.CLOSE_SALE,
          description: 'Coordinar visita o contacto directo',
          maxTurns: 3,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.AUTO_ADVANCE, targetPhase: 'order_ready' },
        ],
        autoResponses: [],
        maxTurns: 3,
        handoffOnTimeout: false,
      },
      {
        id: 'order_ready',
        name: 'Agendar visita',
        phaseType: 'ORDER_READY' as any,
        order: 5,
        enabled: true,
        instructions: 'Registra la visita/coordinación como orden.',
        skipAI: false,
        requiredTools: ['generar_orden'],
        transitions: [
          { trigger: TransitionTrigger.ORDER_GENERATED, targetPhase: 'completed' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'completed',
        name: 'Completado',
        phaseType: 'COMPLETED' as any,
        order: 6,
        enabled: true,
        instructions: 'Visita agendada. Confirma detalles y agradece.',
        skipAI: false,
        transitions: [],
        autoResponses: [],
        maxTurns: 1,
        handoffOnTimeout: false,
      },
    ];
  }

  private static getServicePhases(): PlaybookPhase[] {
    return [
      {
        id: 'greeting',
        name: 'Saludo',
        phaseType: 'GREETING' as any,
        order: 0,
        enabled: true,
        instructions: 'Saluda al cliente. Pregunta qué servicio necesita.',
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.MESSAGE_RECEIVED, targetPhase: 'discovery' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'discovery',
        name: 'Descubrimiento',
        phaseType: 'DISCOVERY' as any,
        order: 1,
        enabled: true,
        instructions: 'Pregunta sobre el servicio requerido, fecha/hora preferida, y duración estimada.',
        goal: {
          type: GoalType.COLLECT_INFO,
          description: 'Recopilar detalles del servicio',
          requiredEntities: ['keywords'],
          maxTurns: 4,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PHASE_MAX_TURNS, targetPhase: 'search_ready' },
        ],
        autoResponses: [],
        maxTurns: 4,
        handoffOnTimeout: false,
      },
      {
        id: 'search_ready',
        name: 'Buscar servicios',
        phaseType: 'SEARCH_READY' as any,
        order: 2,
        enabled: true,
        instructions: 'Busca servicios disponibles en el catálogo.',
        skipAI: false,
        requiredTools: ['buscar_productos'],
        transitions: [
          { trigger: TransitionTrigger.TOOL_CALLED, targetPhase: 'recommendation' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'recommendation',
        name: 'Recomendar servicio',
        phaseType: 'RECOMMENDATION' as any,
        order: 3,
        enabled: true,
        instructions: 'Presenta opciones de servicio con precio y duración estimada.',
        goal: {
          type: GoalType.RECOMMEND,
          description: 'Que el cliente elija el servicio',
          maxTurns: 4,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.PRODUCT_CHOSEN, targetPhase: 'logistics' },
        ],
        autoResponses: [],
        maxTurns: 4,
        handoffOnTimeout: false,
      },
      {
        id: 'logistics',
        name: 'Agendar cita',
        phaseType: 'LOGISTICS' as any,
        order: 4,
        enabled: true,
        instructions: 'Pregunta fecha, hora y datos de contacto para agendar.',
        goal: {
          type: GoalType.CLOSE_SALE,
          description: 'Agendar la cita del servicio',
          maxTurns: 3,
        },
        skipAI: false,
        transitions: [
          { trigger: TransitionTrigger.AUTO_ADVANCE, targetPhase: 'order_ready' },
        ],
        autoResponses: [],
        maxTurns: 3,
        handoffOnTimeout: false,
      },
      {
        id: 'order_ready',
        name: 'Confirmar cita',
        phaseType: 'ORDER_READY' as any,
        order: 5,
        enabled: true,
        instructions: 'Registra la cita como orden.',
        skipAI: false,
        requiredTools: ['generar_orden'],
        transitions: [
          { trigger: TransitionTrigger.ORDER_GENERATED, targetPhase: 'completed' },
        ],
        autoResponses: [],
        maxTurns: 2,
        handoffOnTimeout: false,
      },
      {
        id: 'completed',
        name: 'Completado',
        phaseType: 'COMPLETED' as any,
        order: 6,
        enabled: true,
        instructions: 'Cita confirmada. Confirma detalles y agradece.',
        skipAI: false,
        transitions: [],
        autoResponses: [],
        maxTurns: 1,
        handoffOnTimeout: false,
      },
    ];
  }

  // ── Helpers privados ──

  private findPhase(playbook: any, phaseId: string): any | undefined {
    return playbook.phases?.find(
      (p: any) => p.id === phaseId || p.phaseType === phaseId,
    );
  }

  private findNextEnabledPhase(
    playbook: any,
    currentOrder: number,
  ): any | undefined {
    return playbook.phases
      ?.filter((p: any) => p.enabled && p.order > currentOrder)
      .sort((a: any, b: any) => a.order - b.order)[0];
  }

  private buildResolution(
    phase: any,
    context: PlaybookExecutionContext,
  ): PlaybookResolution {
    return {
      phase,
      instructions: phase.instructions,
      systemPromptOverride: phase.systemPromptOverride || undefined,
      shouldSkipAI: phase.skipAI,
      autoResponse: undefined,
      requiredTools: phase.requiredTools || [],
      blockedTools: phase.blockedTools || [],
      goal: phase.goal,
      handoffOnTimeout: phase.handoffOnTimeout || false,
      maxTurns: phase.maxTurns,
    };
  }

  private getDefaultPhase(phaseType: string): PlaybookPhase {
    return {
      id: phaseType.toLowerCase(),
      name: phaseType,
      phaseType: phaseType as any,
      order: 0,
      enabled: true,
      instructions: '',
      skipAI: false,
      transitions: [],
      autoResponses: [],
      maxTurns: 10,
      handoffOnTimeout: false,
    };
  }

  private buildDefaultPlaybook(): Playbook {
    return {
      name: 'Playbook Default',
      description: 'Flujo estándar de ventas',
      tenantId: new Types.ObjectId('000000000000000000000000'),
      verticalType: 'general',
      isActive: true,
      isDefault: true,
      phases: PlaybookRegistry.getRetailPhases(),
      maxConversationTurns: 50,
      timeoutMinutes: 120,
      handoffMessage: 'Te estoy transfiriendo con un asesor.',
      fallbackPhase: 'DISCOVERY',
    } as Playbook;
  }
}
