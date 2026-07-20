import { Injectable, Logger } from '@nestjs/common';
import {
  Intent,
  ConversationPhase,
  ClassificationResult,
  ExtractedEntities,
  FaqItem,
} from './intent.types';

@Injectable()
export class IntentClassifier {
  private readonly logger = new Logger(IntentClassifier.name);

  private readonly defaultGreetingPatterns =
    /^(hola|hello|hey|buenos?\s*(días?|tardes?|noches?)|saludos|qué\s*tal|como\s*estas?|buenas|hi|holis|holaa|holaaa|que\s*hace|que\s*pasa|que\s*onda|que\s*tal|que\s*hay|que\s*ondda|buenas\s+tarde|buenas\s+noche|buen\s+d[ií]a)[\s!.,?]*$/i;

  private readonly defaultHandoffPatterns =
    /(reclamo|queja|demanda|hablar\s+con\s+.*(humano|persona|asesor|soporte|alguien)|necesito\s+ayuda\s+humana|atención\s+al\s+cliente|cancelar\s+orden|problema\s+con\s+mi\s+pedido|soporte\s+técnico|ayuda\s+con\s+un\s+problema|no\s+funciona|está?\s+roto|defectuoso)/i;

  private readonly buyIntentionPatterns =
    /(quiero|busco|necesito|me\s+gustaría|dame|vende|tienen|cuánto\s+cuesta|precio|disponible|cuanto\s+cuesta|cuanto\s+vale|que\s+tienen|que\s+venden|me\s+interesa|comprar|adquirir|ordenar|pedido)/i;

  private readonly cityPatterns: Record<string, string[]> = {
    cochabamba: ['cochabamba', 'cbba', 'cbb', 'cb'],
    'la paz': ['la paz', 'lp', 'elpaz'],
    'santa cruz': ['santa cruz', 'scz', 'sc', 'santacruz'],
    sucre: ['sucre', 'suc'],
    potosí: ['potosi', 'potosí', 'pot'],
    oruro: ['oruro'],
    tarija: ['tarija', 'tja'],
    quillacollo: ['quillacollo', 'quillaco'],
    montero: ['montero'],
    trinidad: ['trinidad'],
    cobija: ['cobija'],
  };

  private readonly budgetPatterns =
    /(\d+(?:\.\d+)?)\s*(?:bs|bob|\$|usd|dolares?|dólares?|pesos?)/i;
  private readonly budgetRangePatterns =
    /(?:de|entre)\s*(\d+)\s*(?:a|hasta|y|-)\s*(\d+)/i;
  private readonly quantityPatterns =
    /(\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|par|docena|media\s*docena)/i;

  classify(
    text: string,
    conversation: any,
    tenant: any,
    branches: any[] = [],
  ): ClassificationResult {
    const normalized = this.normalize(text);
    this.logger.debug(
      `Clasificando: "${text}" (fase: ${conversation.conversationPhase})`,
    );

    // 1. PRIORIDAD ALTA: Handoff
    if (this.isHandoffRequest(normalized)) {
      this.logger.log(`Intent detectado: HANDOFF`);
      return { intent: Intent.HANDOFF, confidence: 1.0 };
    }

    // 2. PRIORIDAD MEDIA: FAQ Match
    const faqMatch = this.matchFaq(normalized, tenant.faqs || []);
    if (faqMatch && faqMatch.score > 0.5) {
      this.logger.log(
        `Intent detectado: FAQ (score: ${faqMatch.score.toFixed(2)})`,
      );
      return {
        intent: Intent.FAQ,
        confidence: faqMatch.score,
        matchedFaq: faqMatch.faq,
      };
    }

    // 3. PRIORIDAD MEDIA: Saludo
    if (this.isGreeting(normalized)) {
      this.logger.log(`Intent detectado: GREETING`);
      return { intent: Intent.GREETING, confidence: 0.9 };
    }

    // 4. PRIORIDAD BAJA: Búsqueda de producto (solo si la fase lo permite)
    if (
      this.shouldAllowProductSearch(conversation) &&
      this.isProductSearch(normalized)
    ) {
      const entities = this.extractEntities(text, branches);
      this.logger.log(
        `Intent detectado: PRODUCT_SEARCH (entidades: ${JSON.stringify(entities)})`,
      );
      return {
        intent: Intent.PRODUCT_SEARCH,
        confidence: 0.7,
        extractedEntities: entities,
      };
    }

    // 5. DEFAULT: IA decide - pero aún extraemos entidades si la fase lo requiere
    const entities = this.extractEntities(text, branches);
    this.logger.log(`Intent detectado: UNKNOWN → delegar a IA`);
    return {
      intent: Intent.UNKNOWN,
      confidence: 0,
      extractedEntities: entities,
    };
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private isGreeting(text: string): boolean {
    return this.defaultGreetingPatterns.test(text);
  }

  private isHandoffRequest(text: string): boolean {
    return this.defaultHandoffPatterns.test(text);
  }

  private isProductSearch(text: string): boolean {
    return this.buyIntentionPatterns.test(text);
  }

  private shouldAllowProductSearch(conversation: any): boolean {
    const blockedPhases = [
      ConversationPhase.LOGISTICS,
      ConversationPhase.ORDER_READY,
      ConversationPhase.COMPLETED,
    ];
    return !blockedPhases.includes(conversation.conversationPhase);
  }

  matchFaq(
    text: string,
    faqs: FaqItem[],
  ): { faq: FaqItem; score: number } | null {
    if (!faqs || faqs.length === 0) return null;

    const textWords = this.extractKeywords(text);
    let bestMatch: FaqItem | null = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const faqKeywords = faq.keywords.map((k) => this.normalize(k));
      const matches = textWords.filter((w) =>
        faqKeywords.some((kw) => w.includes(kw) || kw.includes(w)),
      );
      const score = matches.length / Math.max(faqKeywords.length, 1);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    return bestMatch ? { faq: bestMatch, score: bestScore } : null;
  }

  extractEntities(text: string, branches: any[] = []): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extraer ciudad
    entities.city = this.extractCity(text, branches);

    // Extraer presupuesto
    entities.budget = this.extractBudget(text);

    // Extraer keywords (sustantivos relevantes)
    entities.keywords = this.extractProductKeywords(text);

    // Extraer cantidad
    entities.quantity = this.extractQuantity(text);

    // Detectar si menciona dirección
    entities.hasAddress =
      /dirección|direccion|avenida|calle|zona|barrio|edificio|torre|piso|departamento/i.test(
        text,
      );

    return entities;
  }

  private extractCity(text: string, branches: any[] = []): string | undefined {
    const normalized = this.normalize(text);

    // Primero intentar con ciudades de las branches del tenant
    if (branches && branches.length > 0) {
      for (const branch of branches) {
        if (branch.cityId?.name) {
          const cityName = this.normalize(branch.cityId.name);
          if (normalized.includes(cityName)) {
            return branch.cityId.name;
          }
        }
      }
    }

    // Fallback a ciudades predefinidas
    for (const [city, patterns] of Object.entries(this.cityPatterns)) {
      if (patterns.some((p) => normalized.includes(p))) {
        return city;
      }
    }

    return undefined;
  }

  private extractBudget(
    text: string,
  ): { min?: number; max?: number } | undefined {
    const rangeMatch = text.match(this.budgetRangePatterns);
    if (rangeMatch) {
      return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
    }

    const budgetMatch = text.match(this.budgetPatterns);
    if (budgetMatch) {
      return { max: parseFloat(budgetMatch[1]) };
    }

    return undefined;
  }

  private extractQuantity(text: string): number | undefined {
    const numberWords: Record<string, number> = {
      uno: 1,
      un: 1,
      una: 1,
      dos: 2,
      'un par': 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      docena: 12,
      'media docena': 6,
    };

    const normalized = this.normalize(text);

    for (const [word, num] of Object.entries(numberWords)) {
      if (normalized.includes(word)) return num;
    }

    const numMatch = text.match(this.quantityPatterns);
    if (numMatch && !isNaN(parseInt(numMatch[1]))) {
      return parseInt(numMatch[1]);
    }

    return undefined;
  }

  private extractProductKeywords(text: string): string[] {
    const stopWords = [
      'un',
      'una',
      'el',
      'la',
      'los',
      'las',
      'de',
      'en',
      'con',
      'para',
      'que',
      'como',
      'pero',
      'mas',
      'muy',
      'ya',
      'si',
      'no',
      'al',
      'del',
      'se',
      'su',
      'es',
      'lo',
      'me',
      'te',
      'le',
      'nos',
      'mi',
      'tu',
      'este',
      'esta',
      'eso',
      'ese',
      'aqui',
      'alli',
      'todo',
      'nada',
      'quiero',
      'busco',
      'necesito',
      'dame',
      'vende',
      'tienen',
      'precio',
      'cuanto',
      'cuesta',
      'vale',
      'disponible',
      'buscar',
      'comprar',
    ];

    const normalized = this.normalize(text);
    const words = normalized
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.includes(w));

    return [...new Set(words)];
  }

  private extractKeywords(text: string): string[] {
    const normalized = this.normalize(text);
    return normalized.split(/\s+/).filter((w) => w.length > 2);
  }
}
