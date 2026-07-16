import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  longCode: string;

  @Prop({ required: true })
  shortCode: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: false })
  weight?: string;

  @Prop({ type: [{ cityId: { type: Types.ObjectId, ref: 'City' }, price: Number }], default: [] })
  prices: { cityId: Types.ObjectId, price: number }[];

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  occasions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Índice de texto para búsqueda semántica / por palabras clave
ProductSchema.index({ name: 'text', keywords: 'text' });
