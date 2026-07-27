import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class SynonymEntry {
  @Prop({ required: true })
  canonical: string;

  @Prop({ type: [String], required: true })
  patterns: string[];

  @Prop({ required: false })
  category?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const SynonymEntrySchema = SchemaFactory.createForClass(SynonymEntry);

@Schema({ timestamps: true })
export class SynonymDictionary extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [SynonymEntrySchema], default: [] })
  entries: SynonymEntry[];

  @Prop({ default: true })
  isActive: boolean;
}

export const SynonymDictionarySchema =
  SchemaFactory.createForClass(SynonymDictionary);
