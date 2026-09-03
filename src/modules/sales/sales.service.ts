import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { MessageBufferService } from './message-buffer.service';

@Injectable()
export class SalesService implements OnModuleInit {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @Inject(forwardRef(() => MessageBufferService))
    private readonly messageBufferService: MessageBufferService,
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
    let textContent =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    // Soporte para ubicaciÃƒÂ³n enviada por WhatsApp
    if (!textContent && msg.message?.locationMessage) {
      const loc = msg.message.locationMessage;
      const addr = loc.address ? ` - DirecciÃƒÂ³n: ${loc.address}` : '';
      textContent = `[El cliente ha compartido una ubicaciÃƒÂ³n GPS por WhatsApp (Lat: ${loc.degreesLatitude}, Lng: ${loc.degreesLongitude})${addr}. Asume que esta es su direcciÃƒÂ³n de entrega.]`;
    }

    if (!textContent) return;

    const messageId = msg.key?.id || 'unknown';

    this.logger.log(
      `Ã°Å¸â€œÂ¥ Recibiendo mensaje de ${jid} (Tenant: ${tenantId}): "${textContent}"`,
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
          `Ã¢ÂÅ’ No hay un Tenant activo para el ID ${tenantId}. Abortando...`,
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

      await this.messageBufferService.addMessage(
        tenantObjectId,
        customer._id,
        conversation._id,
        messageId,
        textContent,
        msg
      );
      this.locks.delete(jid);
      return;
    } catch (error: any) {
      this.logger.error(
        `ðŸš¨ Error procesando mensaje entrante en SalesOrchestrator:`,
        error.stack || error,
      );
      this.locks.delete(jid);
    }
  }

  async processUserTurn(lockedTurn: any) {
    const tenantObjectId = lockedTurn.tenantId;
    const conversationId = lockedTurn.conversationId;
    const customerId = lockedTurn.customerId;

    try {
      const tenant = await this.tenantModel.findById(tenantObjectId);
      if (!tenant) return;
      const tenantId = tenant._id.toString();

      const customer = await this.customerModel.findById(customerId);
      const conversation = await this.conversationModel.findById(conversationId);
      if (!customer || !conversation) return;

      const jid = customer.whatsappId;

      const branches = await this.branchModel
        .find({ tenantId: tenantObjectId, isActive: true })
        .populate('cityId');

      // Unir todos los mensajes del turno
      const textContent = lockedTurn.messages.map((m: any) => m.text).join('\n');
      
      // Registrar IDs para idempotencia
      for (const m of lockedTurn.messages) {
        this.recordMessageId(conversation, m.messageId);
      }

      conversation.messages.push({
        role: 'user',
        content: textContent,
        timestamp: new Date(),
      });

      if (conversation.isAiPaused) {
        this.logger.log(
          `Ã¢ÂÂ¸Ã¯Â¸Â IA pausada para esta conversaciÃƒÂ³n. Ignorando mensaje.`,
        );
        await conversation.save();
        return;
      }

      // FASE 1: Intent Router - Clasificar intenciÃƒÂ³n ANTES de llamar a IA
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

      // Enriquecer contextSummary con entidades extraÃƒÂ­das de CUALquier mensaje
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

      // FASE 2: Auto-transiciÃƒÂ³n de fase: CITY_REQUIRED Ã¢â€ â€™ DISCOVERY si se detectÃƒÂ³ ciudad
      if (
        conversation.conversationPhase === 'CITY_REQUIRED' &&
        conversation.contextSummary?.city
      ) {
        this.intentHandlers.updatePhaseAfterCity(
          conversation,
          conversation.contextSummary.city,
        );
      }

      // FASE 2: Verificar si debemos omitir IA y enviar respuesta automÃƒÂ¡tica
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
            `Ã°Å¸Â¤â€“ FASE 2: Enviando respuesta automÃƒÂ¡tica para fase ${currentPhase}`,
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

      // Algoritmo de Sugerencia DinÃƒÂ¡mica (Backend)
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

      // ConstrucciÃƒÂ³n del Historial
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
          `Ã°Å¸Â¤â€“ Iniciando iteraciÃƒÂ³n ${iterations} con la API de Groq...`,
        );
        const aiMessage = await this.aiService.generateResponse(
          messages,
          currentTools,
        );

        this.logger.debug(
          `Ã°Å¸Â¤â€“ Respuesta Raw de IA recibida: \n${JSON.stringify(aiMessage, null, 2)}`,
        );

        await this.auditAiResponse(
          tenantObjectId,
          customer._id,
          messages,
          tools,
          aiMessage,
        );

        assistantResponse = aiMessage.content;

        // Ã°Å¸â€ºâ€˜ INTERCEPTOR ANTI-CATÃƒÂLOGO (ALGORÃƒÂTMICO) Ã°Å¸â€ºâ€˜
        if (
          assistantResponse &&
          (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0)
        ) {
          const listMatches = assistantResponse.match(/^\d+[\.)]\s/gm) || [];
          const containsMenuKeywords =
            /categorÃƒÂ­as disponibles|nuestro catÃƒÂ¡logo|menÃƒÂº/i.test(
              assistantResponse,
            );

          if (listMatches.length >= 4 || containsMenuKeywords) {
            this.logger.warn(
              `Ã°Å¸â€ºâ€˜ INTERCEPTOR: La IA intentÃƒÂ³ enviar un catÃƒÂ¡logo/menÃƒÂº largo (${listMatches.length} items). Bloqueando y forzando reintento...`,
            );

            messages.push({ role: 'assistant', content: assistantResponse });
            messages.push({
              role: 'system',
              content:
                "SISTEMA ERROR CRÃƒÂTICO: Acabas de intentar enlistar un catÃƒÂ¡logo o mostrar un menÃƒÂº con mÃƒÂ¡s de 3 elementos. ESTO ESTÃƒÂ ESTRICTAMENTE PROHIBIDO. Corrige tu respuesta INMEDIATAMENTE. Borra la lista larga. Haz solo una pregunta abierta (ej. 'Ã‚Â¿Para quÃƒÂ© ocasiÃƒÂ³n buscas?') o usa la herramienta 'buscar_productos'. NO te disculpes, solo escribe la respuesta correcta.",
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
              `Ã°Å¸â€ºÂ Ã¯Â¸Â IA invocÃƒÂ³ la herramienta: ${toolCall.function.name}`,
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
            } else if (toolCall.function.name === 'actualizar_contacto') {
              const resultText = await this.salesToolsService.handleUpdateContact(
                args,
                this.customerModel,
                customer._id.toString()
              );
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: resultText,
              });
              // Removemos la herramienta para que no se vicie llamÃƒÂ¡ndola en loop
              currentTools = currentTools.filter(
                (t) => t.function.name !== 'actualizar_contacto',
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
              
              if (result.success) {
                assistantResponse = result.message;
                this.intentHandlers.updatePhaseAfterOrder(conversation);
                orderGenerated = true;
                break;
              } else {
                // Devolver el error tÃƒÂ©cnico a la IA para que pueda razonarlo
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: result.message,
                });
                // No establecemos orderGenerated=true, para que el loop continÃƒÂºe
              }
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

      // Auto-advance: RECOMMENDATION Ã¢â€ â€™ LOGISTICS cuando la IA pregunta sobre logÃƒÂ­stica
      if (
        conversation.conversationPhase === ConversationPhase.RECOMMENDATION &&
        assistantResponse
      ) {
        const logisticsKeywords =
          /envÃƒÂ­o|envio|recojo|pago|factura|facturaciÃƒÂ³n|NIT|nombre\s+completo|transferencia|QR|efectivo/i;
        if (logisticsKeywords.test(assistantResponse)) {
          this.logger.log(
            `Ã°Å¸â€â€ž Auto-avanzando fase: RECOMMENDATION Ã¢â€ â€™ LOGISTICS (IA preguntÃƒÂ³ sobre logÃƒÂ­stica)`,
          );
          this.intentHandlers.updatePhaseAfterProductChosen(conversation);
        }
      }

      // Auto-advance: LOGISTICS Ã¢â€ â€™ ORDER_READY cuando la IA tiene toda la info
      if (
        conversation.conversationPhase === ConversationPhase.LOGISTICS &&
        assistantResponse
      ) {
        const orderReadyKeywords =
          /registra|genera|crea|confirmar.*orden|confirmar.*pedido|proceder.*pedido|proceder.*orden/i;
        if (orderReadyKeywords.test(assistantResponse)) {
          this.logger.log(
            `Ã°Å¸â€â€ž Auto-avanzando fase: LOGISTICS Ã¢â€ â€™ ORDER_READY`,
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
        `ðŸš¨ Error CRÃTICO procesando turno en SalesOrchestrator:`,
        error.stack || error,
      );
      throw error; // Lanzamos para que MessageBufferService maneje el estado de ERROR
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
        `Ã°Å¸â€ºâ€˜ Rate limit excedido para ${jid}. Ignorando mensaje.`,
      );
      if (timestamps.length === 11) {
        await this.whatsappService.sendMessage(
          tenantId,
          jid,
          'Por favor, no envÃƒÂ­es mensajes tan rÃƒÂ¡pido. Espera un momento antes de continuar.',
        );
      }
      return true;
    }
    return false;
  }

  private checkConcurrencyLock(jid: string): boolean {
    if (this.locks.get(jid)) {
      this.logger.warn(
        `Ã°Å¸â€â€™ Bloqueo de concurrencia activo para ${jid}. Mensaje ignorado o en espera.`,
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
          `Ã¢ÂÂ° ConversaciÃƒÂ³n expirÃƒÂ³ tras ${expirationHours} horas de inactividad.`,
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
        `Ã°Å¸â€Â Mensaje duplicado detectado (${messageId}). Ignorando.`,
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
      this.logger.error('Error guardando auditorÃƒÂ­a de IA', e);
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
        `Ã°Å¸â€œÂ¤ Enviando respuesta final al cliente (${assistantResponse.length} caracteres)`,
      );
      await this.whatsappService.sendMessage(tenantId, jid, assistantResponse);
      conversation.messages.push({
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      });
    } else {
      this.logger.warn(`Ã¢Å¡Â Ã¯Â¸Â assistantResponse vacÃƒÂ­o. Enviando fallback.`);
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
  
  async clearHistory(tenantId: string) {
    const result = await this.conversationModel.deleteMany({
      tenantId: new Types.ObjectId(tenantId),
    });
    return { success: true, message: 'Historial de ventas borrado' };
  }

  async resetAiMemory(tenantId: string) {
    const result = await this.conversationModel.updateMany(
      { tenantId: new Types.ObjectId(tenantId), status: 'ACTIVE' },
      { $set: { status: 'CLOSED' } }
    );
    this.logger.log(`Memoria de IA reiniciada para tenant ${tenantId}. ${result.modifiedCount} chats cerrados.`);
    return { success: true, message: 'Memoria de la IA reiniciada correctamente', count: result.modifiedCount };
  }

  async getConversations(tenantId: string) {
    return this.conversationModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .populate({
        path: 'customerId',
        populate: { path: 'tags' }
      })
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

  async sendManualMessage(tenantId: string, conversationId: string, message: string) {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      tenantId: new Types.ObjectId(tenantId),
    }).populate('customerId');

    if (!conversation || !conversation.customerId) {
      throw new Error('ConversaciÃƒÂ³n no encontrada');
    }

    const jid = (conversation.customerId as any).whatsappId;
    
    // Enviamos por whatsapp
    await this.whatsappService.sendMessage(tenantId, jid, message);
    
    // Guardamos en la base de datos simulando que fue el bot (assistant)
    // Le ponemos un prefijo o lo dejamos normal, es indiferente para la IA.
    conversation.messages.push({
      role: 'assistant',
      content: message,
      timestamp: new Date(),
    });
    
    await conversation.save();
    return conversation;
  }

  async injectContextMessage(tenantId: string, conversationId: string, message: string) {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      tenantId: new Types.ObjectId(tenantId),
    }).populate('customerId');

    if (!conversation) {
      throw new Error('ConversaciÃƒÂ³n no encontrada');
    }

    // Guardamos en la base de datos simulando que fue el cliente (user)
    // NO se envÃƒÂ­a nada por WhatsApp.
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });
    
    await conversation.save();
    return conversation;
  }

  async forceAiReply(tenantId: string, conversationId: string) {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      tenantId: new Types.ObjectId(tenantId),
    }).populate('customerId');

    if (!conversation || !conversation.customerId) {
      throw new Error('ConversaciÃƒÂ³n no encontrada');
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const tenant = await this.tenantModel.findOne({ _id: tenantObjectId, isActive: true });
    if (!tenant) throw new Error('Tenant no encontrado');
    
    const branches = await this.branchModel.find({ tenantId: tenantObjectId, isActive: true }).populate('cityId');
    const customer = conversation.customerId as any;
    const jid = customer.whatsappId;

    if (conversation.isAiPaused) {
      conversation.isAiPaused = false;
      await conversation.save();
    }

    const currentPhase = conversation.conversationPhase || 'DISCOVERY';
    const phaseInstructions = this.intentHandlers.getPhaseInstructions(currentPhase, tenant);
    
    const occasions = await this.productModel.distinct('occasions', { tenantId: tenantObjectId, isActive: true });
    const keywords = await this.productModel.distinct('keywords', { tenantId: tenantObjectId, isActive: true });
    const categoriesDb = await this.categoryModel.find({ tenantId: tenantObjectId, isActive: true });
    
    const allSuggestions = [...new Set([...occasions, ...keywords, ...categoriesDb.map(c => c.name)])].filter(Boolean);
    const selectedSuggestions = allSuggestions.sort(() => 0.5 - Math.random()).slice(0, 3);

    const fullSystemPrompt = buildSalesPrompt(tenant, branches, conversation, selectedSuggestions, phaseInstructions);
    const tools = this.salesToolsService.getAiTools(tenant);

    const MAX_HISTORY_MESSAGES = tenant.aiMemoryLimit || 10;
    const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);

    const messages: any[] = [
      { role: 'system', content: fullSystemPrompt },
      ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'system', content: 'SYSTEM INSTRUCTION: El administrador humano ha solicitado que retomes esta conversaciÃƒÂ³n. Por favor lee el historial y responde al cliente de manera proactiva.' }
    ];

    let assistantResponse = '';
    let iterations = 0;
    let currentTools = [...tools];

    while (iterations < 5) {
      iterations++;
      this.logger.log(`Ã°Å¸Â¤â€“ Forzando respuesta de IA para ${jid} (IteraciÃƒÂ³n ${iterations})...`);
      const aiMessage = await this.aiService.generateResponse(messages, currentTools);
      
      assistantResponse = aiMessage.content;

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        messages.push(aiMessage);
        let orderGenerated = false;

        for (const toolCall of aiMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          this.logger.log(`Ã°Å¸â€ºÂ Ã¯Â¸Â IA invocÃƒÂ³ la herramienta al forzar: ${toolCall.function.name}`);

          if (toolCall.function.name === 'buscar_productos') {
            const resultText = await this.salesToolsService.handleProductSearch(args, tenantObjectId, conversation);
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
            this.intentHandlers.updatePhaseAfterSearch(conversation);
          } else if (toolCall.function.name === 'actualizar_resumen_venta') {
            const resultText = await this.salesToolsService.handleUpdateSummary(args, conversation);
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: resultText });
            currentTools = currentTools.filter((t) => t.function.name !== 'actualizar_resumen_venta');
          } else if (toolCall.function.name === 'generar_orden') {
            const result = await this.salesToolsService.handleGenerateOrder(
              args, tenantObjectId, tenant, branches, customer, conversation, jid
            );
            if (result.success) {
              assistantResponse = result.message;
              this.intentHandlers.updatePhaseAfterOrder(conversation);
              orderGenerated = true;
              break;
            } else {
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.message });
            }
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

    if (assistantResponse) {
      await this.sendAssistantResponse(tenantId, jid, conversation, assistantResponse);
    }
    
    return conversation;
  }

  async generatePrompt(businessDescription: string): Promise<string> {
    return this.aiService.generateStructuredPrompt(businessDescription);
  }
}



