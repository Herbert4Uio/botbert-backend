import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { buildSalesPrompt } from './prompts/sales.prompt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AiService } from '../ai/ai.service';
import { SalesToolsService } from './sales-tools.service';
import { Conversation } from './schemas/conversation.schema';
import { Tenant } from '../tenant/schemas/tenant.schema';
import { Branch } from '../branch/schemas/branch.schema';
import { Customer } from '../customer/schemas/customer.schema';
import { AiAudit } from './schemas/ai-audit.schema';
import { Product } from '../catalog/schemas/product.schema';
import { Category } from '../catalog/schemas/category.schema';
import { IntentClassifier } from './intent/intent-classifier.service';
import { IntentHandlers } from './intent/intent-handlers.service';
import { Intent, ConversationPhase } from './intent/intent.types';

@Injectable()
export class SalesService implements OnModuleInit {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AiService,
    private readonly salesToolsService: SalesToolsService,
    private readonly intentClassifier: IntentClassifier,
    private readonly intentHandlers: IntentHandlers,
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(AiAudit.name) private aiAuditModel: Model<AiAudit>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  private locks = new Map<string, boolean>();
  private rateLimits = new Map<string, number[]>();

  async onModuleInit() {
    this.whatsappService.registerMessageHandler(
      this.handleIncomingMessage.bind(this),
    );
    console.log(
      'SalesOrchestratorService suscrito a los mensajes de WhatsApp.',
    );

    const tenants = await this.tenantModel.find({ isActive: true });
    const uniqueTenants = [...new Set(tenants.map((t) => t._id.toString()))];

    console.log(
      `Encontrados ${uniqueTenants.length} tenants activos. Iniciando WhatsApp...`,
    );
    for (const tenantId of uniqueTenants) {
      await this.whatsappService.startSession(tenantId);
    }
  }

  async handleIncomingMessage(tenantId: string, msg: any, jid: string) {
    const textContent =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!textContent) return;

    const messageId = msg.key?.id || 'unknown';

    this.logger.log(
      `📥 Recibiendo mensaje de ${jid} (Tenant: ${tenantId}): "${textContent}"`,
    );

    if (await this.checkRateLimitAndSendWarning(tenantId, jid)) return;
    if (this.checkConcurrencyLock(jid)) return;

    try {
      const tenantObjectId = new Types.ObjectId(tenantId);

      const tenant = await this.tenantModel.findOne({
        _id: tenantObjectId,
        isActive: true,
      });
      if (!tenant) {
        this.logger.warn(
          `❌ No hay un Tenant activo para el ID ${tenantId}. Abortando...`,
        );
        return;
      }

      const branches = await this.branchModel
        .find({ tenantId: tenantObjectId, isActive: true })
        .populate('cityId');

      const jidAlt = msg.key.remoteJidAlt || msg.participant || null;
      let phoneNumber = '';
      if (jidAlt && jidAlt.includes('@s.whatsapp.net')) {
        phoneNumber = jidAlt.split('@')[0];
      } else if (jid.includes('@s.whatsapp.net')) {
        phoneNumber = jid.split('@')[0];
      }

      const customer = await this.getOrCreateCustomer(
        tenantObjectId,
        jid,
        msg.pushName,
        phoneNumber,
      );
      const conversation = await this.getOrCreateConversation(
        tenantObjectId,
        customer._id,
        tenant.conversationExpirationHours || 24,
      );

      if (this.isDuplicateMessage(conversation, messageId)) return;

      this.recordMessageId(conversation, messageId);
      conversation.messages.push({
        role: 'user',
        content: textContent,
        timestamp: new Date(),
      });

      if (conversation.isAiPaused) {
        this.logger.log(
          `⏸️ IA pausada para esta conversación. Ignorando mensaje.`,
        );
        await conversation.save();
        return;
      }

      // FASE 1: Intent Router - Clasificar intención ANTES de llamar a IA
      const classification = this.intentClassifier.classify(
        textContent,
        conversation,
        tenant,
        branches,
      );

      // Manejar intenciones que NO requieren IA
      if (classification.intent === Intent.HANDOFF) {
        const response = this.intentHandlers.handleHandoff(conversation);
        await this.sendAssistantResponse(tenantId, jid, conversation, response);
        return;
      }

      if (classification.intent === Intent.GREETING) {
        this.intentHandlers.updatePhaseAfterGreeting(conversation);
        const response = this.intentHandlers.handleGreeting(tenant, customer);
        await this.sendAssistantResponse(tenantId, jid, conversation, response);
        return;
      }

      if (classification.intent === Intent.FAQ && classification.matchedFaq) {
        const response = this.intentHandlers.handleFaq(
          classification.matchedFaq,
        );
        await this.sendAssistantResponse(tenantId, jid, conversation, response);
        return;
      }

      // Enriquecer contextSummary con entidades extraídas de CUALquier mensaje
      if (classification.extractedEntities) {
        const e = classification.extractedEntities;
        if (!conversation.contextSummary) conversation.contextSummary = {};
        if (e.city && !conversation.contextSummary.city) {
          conversation.contextSummary.city = e.city;
        }
        if (e.budget && !conversation.contextSummary.budget) {
          conversation.contextSummary.budget = e.budget;
        }
        if (e.keywords?.length) {
          const existing = conversation.contextSummary.keywords || [];
          conversation.contextSummary.keywords = [
            ...new Set([...existing, ...e.keywords]),
          ];
        }
        if (e.hasAddress) {
          conversation.contextSummary.hasAddress = true;
        }
      }

      // FASE 2: Auto-transición de fase: CITY_REQUIRED → DISCOVERY si se detectó ciudad
      if (
        conversation.conversationPhase === 'CITY_REQUIRED' &&
        conversation.contextSummary?.city
      ) {
        this.intentHandlers.updatePhaseAfterCity(
          conversation,
          conversation.contextSummary.city,
        );
      }

      // FASE 2: Verificar si debemos omitir IA y enviar respuesta automática
      const currentPhase = conversation.conversationPhase || 'DISCOVERY';
      const phaseInstructions = this.intentHandlers.getPhaseInstructions(
        currentPhase,
        tenant,
      );

      if (
        this.intentHandlers.shouldSkipAI(
          currentPhase,
          conversation.contextSummary,
        )
      ) {
        const autoResponse = this.intentHandlers.getAutoResponse(
          currentPhase,
          conversation.contextSummary,
          tenant,
        );
        if (autoResponse) {
          this.logger.log(
            `🤖 FASE 2: Enviando respuesta automática para fase ${currentPhase}`,
          );
          await this.sendAssistantResponse(
            tenantId,
            jid,
            conversation,
            autoResponse,
          );
          return;
        }
      }

      const occasions = await this.productModel.distinct('occasions', {
        tenantId: tenantObjectId,
        isActive: true,
      });
      const keywords = await this.productModel.distinct('keywords', {
        tenantId: tenantObjectId,
        isActive: true,
      });
      const categoriesDb = await this.categoryModel.find({
        tenantId: tenantObjectId,
        isActive: true,
      });
      const categories = categoriesDb.map((c) => c.name);

      // Algoritmo de Sugerencia Dinámica (Backend)
      const allSuggestions = [
        ...new Set([...occasions, ...keywords, ...categories]),
      ].filter(Boolean);
      const shuffledSuggestions = allSuggestions.sort(
        () => 0.5 - Math.random(),
      );
      const selectedSuggestions = shuffledSuggestions.slice(0, 3);

      const fullSystemPrompt = buildSalesPrompt(
        tenant,
        branches,
        conversation,
        selectedSuggestions,
        phaseInstructions,
      );
      const tools = this.salesToolsService.getAiTools(tenant);

      // Construcción del Historial
      const MAX_HISTORY_MESSAGES = tenant.aiMemoryLimit || 10;
      const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);

      this.logger.debug(
        `Construyendo contexto con ${recentMessages.length} mensajes previos.`,
      );

      const messages: any[] = [
        { role: 'system', content: fullSystemPrompt },
        ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      let assistantResponse = '';
      let iterations = 0;
      let currentTools = [...tools];

      while (iterations < 5) {
        iterations++;
        this.logger.log(
          `🤖 Iniciando iteración ${iterations} con la API de Groq...`,
        );
        const aiMessage = await this.aiService.generateResponse(
          messages,
          currentTools,
        );

        this.logger.debug(
          `🤖 Respuesta Raw de IA recibida: \n${JSON.stringify(aiMessage, null, 2)}`,
        );

        await this.auditAiResponse(
          tenantObjectId,
          customer._id,
          messages,
          tools,
          aiMessage,
        );

        assistantResponse = aiMessage.content;

        // 🛑 INTERCEPTOR ANTI-CATÁLOGO (ALGORÍTMICO) 🛑
        if (
          assistantResponse &&
          (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0)
        ) {
          const listMatches = assistantResponse.match(/^\d+[\.)]\s/gm) || [];
          const containsMenuKeywords =
            /categorías disponibles|nuestro catálogo|menú/i.test(
              assistantResponse,
            );

          if (listMatches.length >= 4 || containsMenuKeywords) {
            this.logger.warn(
              `🛑 INTERCEPTOR: La IA intentó enviar un catálogo/menú largo (${listMatches.length} items). Bloqueando y forzando reintento...`,
            );

            messages.push({ role: 'assistant', content: assistantResponse });
            messages.push({
              role: 'system',
              content:
                "SISTEMA ERROR CRÍTICO: Acabas de intentar enlistar un catálogo o mostrar un menú con más de 3 elementos. ESTO ESTÁ ESTRICTAMENTE PROHIBIDO. Corrige tu respuesta INMEDIATAMENTE. Borra la lista larga. Haz solo una pregunta abierta (ej. '¿Para qué ocasión buscas?') o usa la herramienta 'buscar_productos'. NO te disculpes, solo escribe la respuesta correcta.",
            });
            continue;
          }
        }

        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          messages.push(aiMessage);

          let orderGenerated = false;

          for (const toolCall of aiMessage.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(
              `🛠️ IA invocó la herramienta: ${toolCall.function.name}`,
            );

            if (toolCall.function.name === 'buscar_productos') {
              const resultText =
                await this.salesToolsService.handleProductSearch(
                  args,
                  tenantObjectId,
                  conversation,
                );
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: resultText,
              });
              this.intentHandlers.updatePhaseAfterSearch(conversation);
            } else if (toolCall.function.name === 'actualizar_resumen_venta') {
              const resultText =
                await this.salesToolsService.handleUpdateSummary(
                  args,
                  conversation,
                );
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: resultText,
              });
              currentTools = currentTools.filter(
                (t) => t.function.name !== 'actualizar_resumen_venta',
              );
            } else if (toolCall.function.name === 'generar_orden') {
              const result = await this.salesToolsService.handleGenerateOrder(
                args,
                tenantObjectId,
                tenant,
                branches,
                customer,
                conversation,
                jid,
              );
              assistantResponse = result.message;
              if (result.success) {
                this.intentHandlers.updatePhaseAfterOrder(conversation);
              }
              orderGenerated = true;
              break;
            }
          }

          if (orderGenerated) {
            break;
          } else {
            continue;
          }
        } else {
          break;
        }
      }

      // Auto-advance: RECOMMENDATION → LOGISTICS cuando la IA pregunta sobre logística
      if (
        conversation.conversationPhase === ConversationPhase.RECOMMENDATION &&
        assistantResponse
      ) {
        const logisticsKeywords =
          /envío|envio|recojo|pago|factura|facturación|NIT|nombre\s+completo|transferencia|QR|efectivo/i;
        if (logisticsKeywords.test(assistantResponse)) {
          this.logger.log(
            `🔄 Auto-avanzando fase: RECOMMENDATION → LOGISTICS (IA preguntó sobre logística)`,
          );
          this.intentHandlers.updatePhaseAfterProductChosen(conversation);
        }
      }

      // Auto-advance: LOGISTICS → ORDER_READY cuando la IA tiene toda la info
      if (
        conversation.conversationPhase === ConversationPhase.LOGISTICS &&
        assistantResponse
      ) {
        const orderReadyKeywords =
          /registra|genera|crea|confirmar.*orden|confirmar.*pedido|proceder.*pedido|proceder.*orden/i;
        if (orderReadyKeywords.test(assistantResponse)) {
          this.logger.log(
            `🔄 Auto-avanzando fase: LOGISTICS → ORDER_READY`,
          );
          conversation.conversationPhase = ConversationPhase.ORDER_READY;
        }
      }

      await this.sendAssistantResponse(
        tenantId,
        jid,
        conversation,
        assistantResponse,
      );
    } catch (error: any) {
      this.logger.error(
        `🚨 Error CRÍTICO procesando mensaje en SalesOrchestrator:`,
        error.stack || error,
      );
    } finally {
      this.locks.delete(jid);
    }
  }

  // --- Private Helper Methods ---

  private async checkRateLimitAndSendWarning(
    tenantId: string,
    jid: string,
  ): Promise<boolean> {
    const now = Date.now();
    const minuteAgo = now - 60000;
    let timestamps = this.rateLimits.get(jid) || [];
    timestamps = timestamps.filter((t) => t > minuteAgo);
    timestamps.push(now);
    this.rateLimits.set(jid, timestamps);

    if (timestamps.length > 10) {
      this.logger.warn(
        `🛑 Rate limit excedido para ${jid}. Ignorando mensaje.`,
      );
      if (timestamps.length === 11) {
        await this.whatsappService.sendMessage(
          tenantId,
          jid,
          'Por favor, no envíes mensajes tan rápido. Espera un momento antes de continuar.',
        );
      }
      return true;
    }
    return false;
  }

  private checkConcurrencyLock(jid: string): boolean {
    if (this.locks.get(jid)) {
      this.logger.warn(
        `🔒 Bloqueo de concurrencia activo para ${jid}. Mensaje ignorado o en espera.`,
      );
      return true;
    }
    this.locks.set(jid, true);
    return false;
  }

  private async getOrCreateCustomer(
    tenantObjectId: Types.ObjectId,
    jid: string,
    pushName: string,
    phoneNumber: string,
  ) {
    let customer = await this.customerModel.findOne({
      tenantId: tenantObjectId,
      whatsappId: jid,
    });
    if (!customer) {
      customer = await this.customerModel.create({
        tenantId: tenantObjectId,
        whatsappId: jid,
        phoneNumber: phoneNumber || undefined,
        profileName: pushName || 'Cliente',
      });
    } else if (phoneNumber && !customer.phoneNumber) {
      customer.phoneNumber = phoneNumber;
      await customer.save();
    }
    return customer;
  }

  private async getOrCreateConversation(
    tenantObjectId: Types.ObjectId,
    customerId: Types.ObjectId,
    expirationHours: number,
  ) {
    let conversation = await this.conversationModel.findOne({
      tenantId: tenantObjectId,
      customerId: customerId,
      status: 'ACTIVE',
    });

    if (conversation) {
      const now = new Date();
      const updatedAt = (conversation as any).updatedAt || new Date();
      const diffHours = Math.abs(now.getTime() - updatedAt.getTime()) / 36e5;
      if (diffHours > expirationHours) {
        this.logger.log(
          `⏰ Conversación expiró tras ${expirationHours} horas de inactividad.`,
        );
        conversation.status = 'CLOSED';
        await conversation.save();
        conversation = null;
      }
    }

    if (!conversation) {
      conversation = await this.conversationModel.create({
        tenantId: tenantObjectId,
        customerId: customerId,
        messages: [],
        processedMessageIds: [],
      });
    }
    return conversation;
  }

  private isDuplicateMessage(conversation: any, messageId: string): boolean {
    if (
      messageId !== 'unknown' &&
      conversation.processedMessageIds.includes(messageId)
    ) {
      this.logger.warn(
        `🔁 Mensaje duplicado detectado (${messageId}). Ignorando.`,
      );
      return true;
    }
    return false;
  }

  private recordMessageId(conversation: any, messageId: string) {
    if (messageId !== 'unknown') {
      conversation.processedMessageIds.push(messageId);
      if (conversation.processedMessageIds.length > 50) {
        conversation.processedMessageIds.shift();
      }
    }
  }

  private async auditAiResponse(
    tenantObjectId: Types.ObjectId,
    customerId: Types.ObjectId,
    messages: any[],
    tools: any[],
    aiMessage: any,
  ) {
    try {
      await this.aiAuditModel.create({
        tenantId: tenantObjectId,
        customerId: customerId,
        promptTokens: 0,
        completionTokens: 0,
        requestPayload: { messages, tools },
        responsePayload: aiMessage,
      });
    } catch (e) {
      this.logger.error('Error guardando auditoría de IA', e);
    }
  }

  private async sendAssistantResponse(
    tenantId: string,
    jid: string,
    conversation: any,
    assistantResponse: string,
  ) {
    if (assistantResponse) {
      this.logger.debug(
        `📤 Enviando respuesta final al cliente (${assistantResponse.length} caracteres)`,
      );
      await this.whatsappService.sendMessage(tenantId, jid, assistantResponse);
      conversation.messages.push({
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      });
    } else {
      this.logger.warn(`⚠️ assistantResponse vacío. Enviando fallback.`);
      const fallbackMsg =
        'Estoy procesando tu solicitud, dame un momento por favor...';
      await this.whatsappService.sendMessage(tenantId, jid, fallbackMsg);
      conversation.messages.push({
        role: 'assistant',
        content: fallbackMsg,
        timestamp: new Date(),
      });
    }
    await conversation.save();
  }

  // --- Admin API Methods ---

  async clearHistory(tenantId: string) {
    const result = await this.conversationModel.deleteMany({
      tenantId: new Types.ObjectId(tenantId),
    });
    return { success: true, message: 'Historial de ventas borrado' };
  }

  async getConversations(tenantId: string) {
    return this.conversationModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('customerId')
      .populate('branchId')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async toggleAiPause(
    tenantId: string,
    conversationId: string,
    isAiPaused: boolean,
  ) {
    return this.conversationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(conversationId),
        tenantId: new Types.ObjectId(tenantId),
      },
      { isAiPaused },
      { new: true },
    );
  }

  async generatePrompt(businessDescription: string): Promise<string> {
    return this.aiService.generateStructuredPrompt(businessDescription);
  }
}
