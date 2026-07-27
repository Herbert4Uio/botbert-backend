import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class PhaseTransition {
  @Prop({ required: true, enum: [
    'MESSAGE_RECEIVED', 'TOOL_CALLED', 'CITY_DETECTED',
    'PRODUCT_CHOSEN', 'ORDER_GENERATED', 'TIMEOUT',
    'USER_REQUEST', 'AUTO_ADVANCE', 'PHASE_MAX_TURNS',
  ]})
  trigger: string;

  @Prop({ required: true })
  targetPhase: string;

  @Prop({ default: '' })
  condition: string;

  @Prop({ default: 0 })
  delayMs: number;
}

const PhaseTransitionSchema = SchemaFactory.createForClass(PhaseTransition);

@Schema({ _id: false })
class PhaseGoal {
  @Prop({ required: true, enum: ['COLLECT_INFO', 'RECOMMEND', 'CLOSE_SALE', 'HANDOFF', 'INFORM', 'CUSTOM'] })
  type: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  requiredEntities: string[];

  @Prop({ default: 10 })
  maxTurns: number;

  @Prop({ default: '' })
  fallbackAction: string;
}

const PhaseGoalSchema = SchemaFactory.createForClass(PhaseGoal);

@Schema({ _id: false })
class PhaseAutoResponse {
  @Prop({ required: true })
  trigger: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: '' })
  condition: string;
}

const PhaseAutoResponseSchema = SchemaFactory.createForClass(PhaseAutoResponse);

@Schema({ _id: false })
class PlaybookPhase {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: [
    'GREETING', 'CITY_REQUIRED', 'DISCOVERY', 'SEARCH_READY',
    'RECOMMENDATION', 'LOGISTICS', 'ORDER_READY', 'COMPLETED', 'CUSTOM',
  ]})
  phaseType: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ required: true })
  instructions: string;

  @Prop({ default: '' })
  systemPromptOverride: string;

  @Prop({ type: PhaseGoalSchema })
  goal: PhaseGoal;

  @Prop({ type: [PhaseTransitionSchema], default: [] })
  transitions: PhaseTransition[];

  @Prop({ type: [PhaseAutoResponseSchema], default: [] })
  autoResponses: PhaseAutoResponse[];

  @Prop({ default: false })
  skipAI: boolean;

  @Prop({ type: [String], default: [] })
  requiredTools: string[];

  @Prop({ type: [String], default: [] })
  blockedTools: string[];

  @Prop({ default: 10 })
  maxTurns: number;

  @Prop({ default: 60 })
  timeoutMinutes: number;

  @Prop({ default: false })
  handoffOnTimeout: boolean;

  @Prop({ type: Object, default: {} })
  customData: Record<string, any>;
}

const PlaybookPhaseSchema = SchemaFactory.createForClass(PlaybookPhase);

@Schema({ timestamps: true })
export class Playbook extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'general' })
  verticalType: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: [PlaybookPhaseSchema], default: [] })
  phases: PlaybookPhase[];

  @Prop({ default: '' })
  globalInstructions: string;

  @Prop({ default: 50 })
  maxConversationTurns: number;

  @Prop({ default: 120 })
  timeoutMinutes: number;

  @Prop({ default: 'Te estoy transfiriendo con un asesor. Un momento por favor.' })
  handoffMessage: string;

  @Prop({ default: 'DISCOVERY' })
  fallbackPhase: string;
}

export const PlaybookSchema = SchemaFactory.createForClass(Playbook);
