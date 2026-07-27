export enum PlaybookPhaseType {
  GREETING = 'GREETING',
  CITY_REQUIRED = 'CITY_REQUIRED',
  DISCOVERY = 'DISCOVERY',
  SEARCH_READY = 'SEARCH_READY',
  RECOMMENDATION = 'RECOMMENDATION',
  LOGISTICS = 'LOGISTICS',
  ORDER_READY = 'ORDER_READY',
  COMPLETED = 'COMPLETED',
  CUSTOM = 'CUSTOM',
}

export enum TransitionTrigger {
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  TOOL_CALLED = 'TOOL_CALLED',
  CITY_DETECTED = 'CITY_DETECTED',
  PRODUCT_CHOSEN = 'PRODUCT_CHOSEN',
  ORDER_GENERATED = 'ORDER_GENERATED',
  TIMEOUT = 'TIMEOUT',
  USER_REQUEST = 'USER_REQUEST',
  AUTO_ADVANCE = 'AUTO_ADVANCE',
  PHASE_MAX_TURNS = 'PHASE_MAX_TURNS',
}

export enum GoalType {
  COLLECT_INFO = 'COLLECT_INFO',
  RECOMMEND = 'RECOMMEND',
  CLOSE_SALE = 'CLOSE_SALE',
  HANDOFF = 'HANDOFF',
  INFORM = 'INFORM',
  CUSTOM = 'CUSTOM',
}

export interface PhaseTransition {
  trigger: TransitionTrigger;
  targetPhase: string;
  condition?: string;
  delayMs?: number;
}

export interface PhaseGoal {
  type: GoalType;
  description: string;
  requiredEntities?: string[];
  maxTurns?: number;
  fallbackAction?: string;
}

export interface PhaseAutoResponse {
  trigger: string;
  message: string;
  condition?: string;
}

export interface PlaybookPhase {
  id: string;
  name: string;
  phaseType: PlaybookPhaseType;
  order: number;
  enabled: boolean;
  instructions: string;
  systemPromptOverride?: string;
  goal?: PhaseGoal;
  transitions: PhaseTransition[];
  autoResponses: PhaseAutoResponse[];
  skipAI: boolean;
  requiredTools?: string[];
  blockedTools?: string[];
  maxTurns?: number;
  timeoutMinutes?: number;
  handoffOnTimeout?: boolean;
  customData?: Record<string, any>;
}

export interface Playbook {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
  verticalType: string;
  isActive: boolean;
  isDefault: boolean;
  phases: PlaybookPhase[];
  globalInstructions?: string;
  maxConversationTurns?: number;
  timeoutMinutes?: number;
  handoffMessage?: string;
  fallbackPhase?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlaybookExecutionContext {
  currentPhase: string;
  turnCount: number;
  phaseTurnCount: number;
  contextSummary: any;
  lastToolCall?: string;
  lastUserMessage?: string;
  timeoutOccurred?: boolean;
}

export interface PlaybookResolution {
  phase: PlaybookPhase;
  instructions: string;
  systemPromptOverride?: string;
  shouldSkipAI: boolean;
  autoResponse?: string;
  requiredTools: string[];
  blockedTools: string[];
  goal?: PhaseGoal;
  handoffOnTimeout: boolean;
  maxTurns?: number;
}
