import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  plan: string;

  @Prop({ required: false })
  whatsappNumber?: string;

  @Prop({ default: 'Eres el Asistente de Ventas Inteligente. Tu objetivo es ayudar al cliente a encontrar el producto ideal y cerrar la venta.' })
  systemPrompt: string;

  @Prop({ default: 'productos' })
  industryType: string;

  @Prop({ type: Boolean, default: false })
  useCustomSystemPrompt: boolean;

  @Prop({ type: Number, default: 10 })
  aiMemoryLimit: number;

  @Prop({ required: false })
  qrImageBase64?: string;

  @Prop({ type: Number, default: 24 })
  conversationExpirationHours: number;

  @Prop({ type: Number, default: 5 })
  maxOrdersPerDay: number;

  @Prop({ type: Number, default: 20 })
  maxItemsPerOrder: number;

  @Prop({ required: false })
  catalogUrl?: string;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
