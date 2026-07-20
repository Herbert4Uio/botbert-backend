export enum Intent {
  GREETING = 'GREETING',
  HANDOFF = 'HANDOFF',
  FAQ = 'FAQ',
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  ORDER_INQUIRY = 'ORDER_INQUIRY',
  UNKNOWN = 'UNKNOWN',
}

export enum ConversationPhase {
  GREETING = 'GREETING',
  CITY_REQUIRED = 'CITY_REQUIRED',
  DISCOVERY = 'DISCOVERY',
  SEARCH_READY = 'SEARCH_READY',
  RECOMMENDATION = 'RECOMMENDATION',
  LOGISTICS = 'LOGISTICS',
  ORDER_READY = 'ORDER_READY',
  COMPLETED = 'COMPLETED',
}

export interface ExtractedEntities {
  city?: string;
  budget?: { min?: number; max?: number };
  keywords?: string[];
  quantity?: number;
  hasAddress?: boolean;
}

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  extractedEntities?: ExtractedEntities;
  matchedFaq?: { question: string; answer: string };
}

export interface FaqItem {
  question: string;
  answer: string;
  keywords: string[];
}
