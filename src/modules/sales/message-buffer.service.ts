import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageBuffer } from './schemas/message-buffer.schema';
import { SalesService } from './sales.service';

@Injectable()
export class MessageBufferService {
  private readonly logger = new Logger(MessageBufferService.name);
  
  constructor(
    @InjectModel(MessageBuffer.name) private bufferModel: Model<MessageBuffer>,
    @Inject(forwardRef(() => SalesService)) private salesService: SalesService,
  ) {}

  private get debounceMs(): number {
    return parseInt(process.env.CHAT_MESSAGE_DEBOUNCE_MS || '2000', 10);
  }

  private get maxWaitMs(): number {
    return parseInt(process.env.CHAT_MESSAGE_MAX_WAIT_MS || '6000', 10);
  }

  async addMessage(
    tenantId: Types.ObjectId,
    customerId: Types.ObjectId,
    conversationId: Types.ObjectId,
    msgId: string,
    text: string,
    rawMsg: any
  ) {
    const now = new Date();
    
    // Upsert atómico para meter el mensaje en el buffer actual (si existe) o crear uno nuevo
    const turn = await this.bufferModel.findOneAndUpdate(
      { conversationId, status: 'BUFFERING' },
      {
        $setOnInsert: { 
          firstMessageAt: now, 
          tenantId, 
          customerId 
        },
        $set: { lastMessageAt: now },
        $push: { messages: { messageId: msgId, text, raw: rawMsg, timestamp: now } }
      },
      { upsert: true, new: true }
    );

    this.logger.debug(`[Debounce] Mensaje ${msgId} agregado al buffer ${turn._id} (Conv: ${conversationId})`);

    // Iniciar el trigger local
    this.scheduleCheck(conversationId, turn._id);
  }

  private scheduleCheck(conversationId: Types.ObjectId, turnId: Types.ObjectId, delayMs?: number) {
    const delay = delayMs ?? this.debounceMs;
    setTimeout(() => {
      this.evaluateTurn(conversationId, turnId).catch(err => {
        this.logger.error(`Error evaluando turno ${turnId}`, err);
      });
    }, delay);
  }

  async evaluateTurn(conversationId: Types.ObjectId, turnId: Types.ObjectId) {
    const turn = await this.bufferModel.findById(turnId);
    if (!turn || turn.status !== 'BUFFERING') {
      return; // Ya fue procesado o está procesándose
    }

    const now = Date.now();
    const timeSinceLast = now - turn.lastMessageAt.getTime();
    const timeSinceFirst = now - turn.firstMessageAt.getTime();

    // ¿Se cumplió la condición para procesar? (2s de silencio o 6s de espera máxima)
    if (timeSinceLast >= this.debounceMs || timeSinceFirst >= this.maxWaitMs) {
      
      // Concurrencia: Verificar si esta conversación YA tiene un turno en PROCESSING
      // Esto evita que "Worker 1" y "Worker 2" procesen turnos de la MISMA conversación simultáneamente
      const isProcessing = await this.bufferModel.findOne({ 
        conversationId, 
        status: 'PROCESSING',
        lockUntil: { $gt: new Date() } // Ignorar locks expirados (seguridad TTL)
      });
      
      if (isProcessing) {
        this.logger.debug(`[Debounce] Conversación ${conversationId} ocupada. Re-encolando turno ${turnId}`);
        // Volvemos a chequear en 1 segundo
        this.scheduleCheck(conversationId, turnId, 1000);
        return;
      }

      // Adquirir Distributed Lock Atómicamente
      const lockUntil = new Date(now + 5 * 60000); // 5 min TTL
      const lockedTurn = await this.bufferModel.findOneAndUpdate(
        { _id: turnId, status: 'BUFFERING' },
        { $set: { status: 'PROCESSING', lockUntil } },
        { new: true }
      );

      // Si lockedTurn es null, significa que otro Worker nos ganó de mano y ya cambió el status a PROCESSING
      if (lockedTurn) {
        this.logger.log(`[Debounce] Turno ${turnId} bloqueado para procesamiento. (${lockedTurn.messages?.length || 0} mensajes agrupados)`);
        
        try {
          // Ejecutar lógica de negocio
          await this.salesService.processUserTurn(lockedTurn);
          
          // Marcar como completado
          await this.bufferModel.updateOne({ _id: turnId }, { $set: { status: 'COMPLETED', lockUntil: null } });
          this.logger.log(`[Debounce] Turno ${turnId} procesado exitosamente.`);
        } catch (error) {
          this.logger.error(`[Debounce] Error al procesar turno ${turnId}`, error);
          // Liberar el lock y marcar como ERROR para permitir reintentos manuales o automáticos
          await this.bufferModel.updateOne({ _id: turnId }, { $set: { status: 'ERROR', lockUntil: null } });
        }
      }
    } else {
      // Falta tiempo para cumplir la ventana
      const waitTime = Math.min(this.debounceMs - timeSinceLast, this.maxWaitMs - timeSinceFirst);
      // Evitar programar un setTimeout de 0 o negativo
      this.scheduleCheck(conversationId, turnId, Math.max(waitTime, 100));
    }
  }
}
