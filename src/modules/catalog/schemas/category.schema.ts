import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class AttributeDefinition {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['string', 'number', 'enum', 'boolean'] })
  type: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ default: '' })
  unit: string;

  @Prop({ default: true })
  searchable: boolean;

  @Prop({ default: false })
  askBeforeRecommend: boolean;
}

export const AttributeDefinitionSchema =
  SchemaFactory.createForClass(AttributeDefinition);

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [AttributeDefinitionSchema], default: [] })
  attributesSchema: AttributeDefinition[];

  @Prop({ default: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
