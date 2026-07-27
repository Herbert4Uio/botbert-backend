import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class AttributeDefinition {
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
}

const AttributeDefinitionSchema = SchemaFactory.createForClass(AttributeDefinition);

@Schema({ _id: false })
class GuardrailRule {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ required: true, enum: ['block', 'sanitize', 'warn', 'replace'] })
  action: string;

  @Prop({ type: [String], default: [] })
  patterns: string[];

  @Prop({ default: '' })
  replacement: string;

  @Prop({ default: 'medium', enum: ['low', 'medium', 'high', 'critical'] })
  severity: string;

  @Prop({ type: [String], default: [] })
  appliesToPhases: string[];
}

const GuardrailRuleSchema = SchemaFactory.createForClass(GuardrailRule);

@Schema({ _id: false })
class ToneRule {
  @Prop({ required: true })
  pattern: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: 'medium', enum: ['low', 'medium', 'high'] })
  severity: string;

  @Prop({ default: 'block', enum: ['block', 'sanitize', 'warn'] })
  action: string;

  @Prop({ default: '' })
  suggestion: string;
}

const ToneRuleSchema = SchemaFactory.createForClass(ToneRule);

@Schema({ _id: false })
class ResponseTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  trigger: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: [String], default: [] })
  phases: string[];
}

const ResponseTemplateSchema = SchemaFactory.createForClass(ResponseTemplate);

@Schema({ _id: false })
class GuardrailPreset {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Object, default: {} })
  config: Record<string, any>;
}

const GuardrailPresetSchema = SchemaFactory.createForClass(GuardrailPreset);

@Schema({ timestamps: true })
export class VerticalConfig extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'productos' })
  industryType: string;

  @Prop({ default: 'casual', enum: ['formal', 'casual', 'technical'] })
  tone: string;

  @Prop({ type: [String], default: [] })
  requiredAttributes: string[];

  @Prop({ type: [String], default: [] })
  legalDisclaimers: string[];

  @Prop({ type: [String], default: [] })
  prohibitedTerms: string[];

  @Prop({ type: Types.ObjectId, ref: 'SynonymDictionary', required: false })
  synonymDictionaryId?: Types.ObjectId;

  @Prop({
    default: 'LOW_CONSIDERATION',
    enum: ['HIGH_CONSIDERATION', 'LOW_CONSIDERATION', 'RECURRING'],
  })
  conversationPlaybook: string;

  @Prop({ default: 3 })
  maxRecommendations: number;

  @Prop({ default: true })
  requirePriceDisplay: boolean;

  @Prop({ type: [String], default: [] })
  forbiddenPatterns: string[];

  @Prop({ type: [AttributeDefinitionSchema], default: [] })
  attributeDefinitions: AttributeDefinition[];

  // ── Guardrails Configurable desde Frontend ──

  @Prop({ default: true })
  guardrailsEnabled: boolean;

  @Prop({ default: 1500 })
  maxResponseLength: number;

  @Prop({ default: 10 })
  minResponseLength: number;

  @Prop({ default: true })
  priceDisclaimerRequired: boolean;

  @Prop({ default: true })
  productValidationEnabled: boolean;

  @Prop({ default: true })
  requireGreeting: boolean;

  @Prop({ default: false })
  requireClosing: boolean;

  @Prop({ default: 'block', enum: ['block', 'sanitize', 'warn', 'replace'] })
  defaultAction: string;

  @Prop({ default: '' })
  fallbackMessage: string;

  @Prop({ type: [String], default: [] })
  blockedTopics: string[];

  @Prop({ type: [String], default: [] })
  requiredTopics: string[];

  @Prop({ type: [String], default: [] })
  prohibitedPatterns: string[];

  @Prop({ type: [GuardrailRuleSchema], default: [] })
  customRules: GuardrailRule[];

  @Prop({ type: [ToneRuleSchema], default: [] })
  toneRules: ToneRule[];

  @Prop({ type: [ResponseTemplateSchema], default: [] })
  responseTemplates: ResponseTemplate[];

  @Prop({ type: [GuardrailPresetSchema], default: [] })
  availablePresets: GuardrailPreset[];

  @Prop({ default: '' })
  activePreset: string;

  // ── Prompt Parametrizado (override de secciones del system prompt) ──

  @Prop({ default: '' })
  customSystemPrompt: string;

  @Prop({ default: '' })
  welcomeMessage: string;

  @Prop({ default: '' })
  closingMessage: string;

  @Prop({ default: '' })
  productDescriptionStyle: string;

  @Prop({ default: '' })
  customInstructions: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const VerticalConfigSchema = SchemaFactory.createForClass(VerticalConfig);
