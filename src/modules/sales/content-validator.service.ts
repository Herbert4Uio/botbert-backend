import { Injectable, Logger } from '@nestjs/common';
import { RegexBuilder } from '../../common/utils/regex-builder';
import { TextNormalizer } from '../../common/utils/text-normalizer';
import { resolveGuardrailConfig } from '../vertical/guardrail-presets';

export interface ContentViolation {
  type:
    | 'PROHIBITED_TERM'
    | 'PROHIBITED_PATTERN'
    | 'MISSING_DISCLAIMER'
    | 'LENGTH_VIOLATION'
    | 'MISSING_PRICE_DISCLAIMER'
    | 'HALLUCINATED_PRODUCT'
    | 'BLOCKED_TOPIC'
    | 'MISSING_REQUIRED_TOPIC'
    | 'TONE_VIOLATION'
    | 'MAX_RECOMMENDATIONS_EXCEEDED'
    | 'MISSING_GREETING'
    | 'MISSING_CLOSING'
    | 'CUSTOM_RULE';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  original?: string;
  suggestion?: string;
  ruleName?: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ContentViolation[];
  sanitizedResponse: string;
  action: 'pass' | 'block' | 'sanitize' | 'warn' | 'replace';
  appliedRules: string[];
}

@Injectable()
export class ContentValidatorService {
  private readonly logger = new Logger(ContentValidatorService.name);

  /**
   * Valida y sanitiza una respuesta del bot usando la configuración completa del vertical.
   * La configuración se resuelve desde: preset activo + overrides personalizados.
   */
  validate(
    response: string,
    verticalConfig: any,
    context?: {
      productNames?: string[];
      branchName?: string;
      tenantName?: string;
      currentPhase?: string;
    },
  ): ValidationResult {
    if (!verticalConfig?.guardrailsEnabled) {
      return {
        isValid: true,
        violations: [],
        sanitizedResponse: response,
        action: 'pass',
        appliedRules: [],
      };
    }

    const config = resolveGuardrailConfig(verticalConfig);
    const violations: ContentViolation[] = [];
    const appliedRules: string[] = [];
    let sanitized = response;
    let globalAction: ValidationResult['action'] = 'pass';

    // 1. Términos prohibidos (schema: prohibitedTerms)
    const prohibitedResult = this.checkProhibitedTerms(sanitized, config.prohibitedTerms);
    violations.push(...prohibitedResult.violations);
    sanitized = prohibitedResult.sanitized;
    if (prohibitedResult.violations.length) appliedRules.push('prohibitedTerms');

    // 2. Patrones prohibidos regex (schema: prohibitedPatterns)
    const patternResult = this.checkProhibitedPatterns(sanitized, config.prohibitedPatterns);
    violations.push(...patternResult.violations);
    sanitized = patternResult.sanitized;
    if (patternResult.violations.length) appliedRules.push('prohibitedPatterns');

    // 3. Temas bloqueados (schema: blockedTopics)
    const topicResult = this.checkBlockedTopics(sanitized, config.blockedTopics);
    violations.push(...topicResult.violations);
    sanitized = topicResult.sanitized;
    if (topicResult.violations.length) appliedRules.push('blockedTopics');

    // 4. Longitud (schema: maxResponseLength, minResponseLength)
    const lengthResult = this.checkLength(sanitized, config.minResponseLength, config.maxResponseLength);
    violations.push(...lengthResult.violations);
    if (lengthResult.violations.length) appliedRules.push('length');

    // 5. Disclaimer de precio (schema: priceDisclaimerRequired)
    if (config.priceDisclaimerRequired) {
      const priceResult = this.checkPriceDisclaimer(sanitized);
      violations.push(...priceResult.violations);
      if (priceResult.violations.length) appliedRules.push('priceDisclaimer');
    }

    // 6. Disclaimers obligatorios (schema: legalDisclaimers)
    const disclaimerResult = this.checkRequiredDisclaimers(sanitized, config.legalDisclaimers);
    violations.push(...disclaimerResult.violations);
    if (disclaimerResult.violations.length) appliedRules.push('legalDisclaimers');

    // 7. Validación de productos (schema: productValidationEnabled)
    if (config.productValidationEnabled && context?.productNames) {
      const productResult = this.checkProductMentions(sanitized, context.productNames);
      violations.push(...productResult.violations);
      if (productResult.violations.length) appliedRules.push('productValidation');
    }

    // 8. Tono (schema: toneRules)
    const toneResult = this.checkToneRules(sanitized, verticalConfig.toneRules || config.toneRules);
    violations.push(...toneResult.violations);
    sanitized = toneResult.sanitized;
    if (toneResult.violations.length) appliedRules.push('toneRules');

    // 9. Reglas personalizadas (schema: customRules)
    const customResult = this.checkCustomRules(sanitized, config.customRules, context?.currentPhase);
    violations.push(...customResult.violations);
    sanitized = customResult.sanitized;
    if (customResult.violations.length) appliedRules.push('customRules');

    // 10. Máximo de recomendaciones (schema: maxRecommendations del verticalConfig)
    const maxRec = verticalConfig.maxRecommendations || 3;
    const recResult = this.checkMaxRecommendations(sanitized, maxRec);
    violations.push(...recResult.violations);
    if (recResult.violations.length) appliedRules.push('maxRecommendations');

    // 11. Saludo requerido (schema: requireGreeting)
    if (config.requireGreeting) {
      const greetingResult = this.checkGreeting(sanitized);
      violations.push(...greetingResult.violations);
      if (greetingResult.violations.length) appliedRules.push('requireGreeting');
    }

    // 12. Despedida requerida (schema: requireClosing)
    if (config.requireClosing) {
      const closingResult = this.checkClosing(sanitized);
      violations.push(...closingResult.violations);
      if (closingResult.violations.length) appliedRules.push('requireClosing');
    }

    // 13. Temas requeridos (schema: requiredTopics)
    if (config.requiredTopics?.length) {
      const reqTopicResult = this.checkRequiredTopics(sanitized, config.requiredTopics);
      violations.push(...reqTopicResult.violations);
      if (reqTopicResult.violations.length) appliedRules.push('requiredTopics');
    }

    // Determinar acción global
    globalAction = this.determineGlobalAction(violations, config.defaultAction);

    // Aplicar acción
    if (globalAction === 'block') {
      sanitized = config.fallbackMessage || 'Disculpa, no pude procesar tu consulta. ¿Podrías reformularla?';
    } else if (globalAction === 'replace') {
      const replaceViolation = violations.find((v) => v.type === 'CUSTOM_RULE' && v.severity === 'critical');
      if (replaceViolation?.suggestion) {
        sanitized = replaceViolation.suggestion;
      }
    }

    const hasCritical = violations.some((v) => v.severity === 'critical');
    const isValid = !hasCritical && globalAction !== 'block';

    if (violations.length > 0) {
      this.logger.warn(
        `⚠️ Guardrails: ${violations.length} violaciones | Acción: ${globalAction} | Reglas: ${appliedRules.join(', ')}`,
      );
    }

    return {
      isValid,
      violations,
      sanitizedResponse: sanitized,
      action: globalAction,
      appliedRules,
    };
  }

  /**
   * Determina la acción global basada en las violaciones y la configuración.
   */
  private determineGlobalAction(
    violations: ContentViolation[],
    defaultAction: string,
  ): ValidationResult['action'] {
    if (violations.length === 0) return 'pass';

    const hasCritical = violations.some((v) => v.severity === 'critical');
    if (hasCritical) return 'block';

    const hasHigh = violations.some((v) => v.severity === 'high');
    if (hasHigh) return defaultAction === 'block' ? 'block' : 'sanitize';

    const hasMedium = violations.some((v) => v.severity === 'medium');
    if (hasMedium) return defaultAction === 'warn' ? 'warn' : 'sanitize';

    return 'warn';
  }

  /**
   * Verifica y remueve términos prohibidos (strings simples).
   */
  private checkProhibitedTerms(
    response: string,
    terms: string[],
  ): { violations: ContentViolation[]; sanitized: string } {
    const violations: ContentViolation[] = [];
    let sanitized = response;

    for (const term of terms) {
      const patterns = [RegexBuilder.accent(term), term];
      for (const pattern of patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = sanitized.match(regex);
          if (matches) {
            violations.push({
              type: 'PROHIBITED_TERM',
              severity: 'high',
              message: `Término prohibido: "${term}"`,
              original: matches.join(', '),
              suggestion: `Reemplazar "${term}" por una alternativa`,
            });
            sanitized = sanitized.replace(regex, '***');
          }
        } catch {
          // skip
        }
      }
    }

    return { violations, sanitized };
  }

  /**
   * Verifica y remueve patrones regex prohibidos (configurable desde frontend).
   */
  private checkProhibitedPatterns(
    response: string,
    patterns: string[],
  ): { violations: ContentViolation[]; sanitized: string } {
    const violations: ContentViolation[] = [];
    let sanitized = response;

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'gi');
        const matches = sanitized.match(regex);
        if (matches) {
          violations.push({
            type: 'PROHIBITED_PATTERN',
            severity: 'high',
            message: `Patrón prohibido detectado: "${pattern}"`,
            original: matches.join(', '),
          });
          sanitized = sanitized.replace(regex, '***');
        }
      } catch {
        this.logger.warn(`⚠️ Patrón regex inválido en prohibitedPatterns: "${pattern}"`);
      }
    }

    return { violations, sanitized };
  }

  /**
   * Verifica temas bloqueados (strings simples o regex).
   */
  private checkBlockedTopics(
    response: string,
    topics: string[],
  ): { violations: ContentViolation[]; sanitized: string } {
    const violations: ContentViolation[] = [];
    let sanitized = response;

    for (const topic of topics) {
      let found = false;

      try {
        const regex = new RegExp(topic, 'gi');
        if (regex.test(sanitized)) found = true;
      } catch {
        if (sanitized.toLowerCase().includes(topic.toLowerCase())) found = true;
      }

      if (found) {
        violations.push({
          type: 'BLOCKED_TOPIC',
          severity: 'high',
          message: `Tema bloqueado detectado: "${topic}"`,
        });
      }
    }

    return { violations, sanitized };
  }

  /**
   * Verifica longitud de la respuesta.
   */
  private checkLength(
    response: string,
    minLength: number,
    maxLength: number,
  ): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const length = response.length;

    if (length < minLength) {
      violations.push({
        type: 'LENGTH_VIOLATION',
        severity: 'low',
        message: `Respuesta demasiado corta (${length} chars, mínimo ${minLength})`,
      });
    }

    if (length > maxLength) {
      violations.push({
        type: 'LENGTH_VIOLATION',
        severity: 'medium',
        message: `Respuesta demasiado larga (${length} chars, máximo ${maxLength})`,
      });
    }

    return { violations };
  }

  /**
   * Verifica que si hay precios se incluya un disclaimer.
   */
  private checkPriceDisclaimer(response: string): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const pricePatterns = [/Bs\.?\s*\d+/, /\$\s*\d+/, /precio[:\s]+\d+/i, /\d+\.\d{2}/];
    const hasPrice = pricePatterns.some((p) => p.test(response));

    if (hasPrice) {
      const disclaimerPatterns = [
        /precio sujeto/i,
        /disponible/i,
        /consultar/i,
        /sujeto a/i,
        /puede variar/i,
        /stock/i,
        /referencia/i,
      ];
      const hasDisclaimer = disclaimerPatterns.some((p) => p.test(response));

      if (!hasDisclaimer) {
        violations.push({
          type: 'MISSING_PRICE_DISCLAIMER',
          severity: 'medium',
          message: 'Precio mencionado sin disclaimer de disponibilidad',
          suggestion: 'Agregar "sujeto a disponibilidad" o similar',
        });
      }
    }

    return { violations };
  }

  /**
   * Verifica disclaimers legales requeridos.
   */
  private checkRequiredDisclaimers(
    response: string,
    disclaimers: string[],
  ): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];

    for (const disclaimer of disclaimers) {
      let found = false;

      try {
        found = new RegExp(RegexBuilder.accent(disclaimer), 'i').test(response);
      } catch {
        found = response.toLowerCase().includes(disclaimer.toLowerCase());
      }

      if (!found) {
        violations.push({
          type: 'MISSING_DISCLAIMER',
          severity: 'medium',
          message: `Disclaimer obligatorio no encontrado: "${disclaimer}"`,
        });
      }
    }

    return { violations };
  }

  /**
   * Verifica que los productos mencionados existan en el catálogo.
   */
  private checkProductMentions(
    response: string,
    productNames: string[],
  ): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const productMentions = response.match(
      /(?:producto|artículo|ítem|equipo)\s+["']?([^"'.]+)["']?/gi,
    );

    if (productMentions) {
      for (const mention of productMentions) {
        const cleanMention = mention
          .replace(/(?:producto|artículo|ítem|equipo)\s+["']?/i, '')
          .replace(/["']$/, '')
          .trim();

        const exists = productNames.some(
          (name) =>
            TextNormalizer.similarity(cleanMention, name) > 0.6 ||
            name.toLowerCase().includes(cleanMention.toLowerCase()),
        );

        if (!exists && cleanMention.length > 3) {
          violations.push({
            type: 'HALLUCINATED_PRODUCT',
            severity: 'high',
            message: `Producto posiblemente inexistente: "${cleanMention}"`,
          });
        }
      }
    }

    return { violations };
  }

  /**
   * Verifica reglas de tono configurables desde el frontend.
   */
  private checkToneRules(
    response: string,
    toneRules: Array<{
      pattern: string;
      message: string;
      severity: string;
      action: string;
      suggestion?: string;
    }>,
  ): { violations: ContentViolation[]; sanitized: string } {
    const violations: ContentViolation[] = [];
    let sanitized = response;

    for (const rule of toneRules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = sanitized.match(regex);
        if (matches) {
          violations.push({
            type: 'TONE_VIOLATION',
            severity: rule.severity as ContentViolation['severity'],
            message: rule.message,
            original: matches.join(', '),
            suggestion: rule.suggestion,
          });

          if (rule.action === 'sanitize') {
            sanitized = sanitized.replace(regex, '***');
          }
        }
      } catch {
        this.logger.warn(`⚠️ Patrón regex inválido en toneRules: "${rule.pattern}"`);
      }
    }

    return { violations, sanitized };
  }

  /**
   * Verifica reglas personalizadas configurables desde el frontend.
   * Cada regla puede tener: patterns (regex), action, severity, appliesToPhases.
   */
  private checkCustomRules(
    response: string,
    customRules: Array<{
      name: string;
      description: string;
      enabled: boolean;
      action: string;
      patterns: string[];
      replacement: string;
      severity: string;
      appliesToPhases: string[];
    }>,
    currentPhase?: string,
  ): { violations: ContentViolation[]; sanitized: string } {
    const violations: ContentViolation[] = [];
    let sanitized = response;

    for (const rule of customRules) {
      if (!rule.enabled) continue;

      if (
        rule.appliesToPhases?.length &&
        currentPhase &&
        !rule.appliesToPhases.includes(currentPhase)
      ) {
        continue;
      }

      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = sanitized.match(regex);
          if (matches) {
            violations.push({
              type: 'CUSTOM_RULE',
              severity: rule.severity as ContentViolation['severity'],
              message: `[${rule.name}] ${rule.description}`,
              original: matches.join(', '),
              suggestion: rule.replacement || undefined,
              ruleName: rule.name,
            });

            if (rule.action === 'sanitize' && rule.replacement) {
              sanitized = sanitized.replace(regex, rule.replacement);
            } else if (rule.action === 'replace' && rule.replacement) {
              sanitized = sanitized.replace(regex, rule.replacement);
            } else if (rule.action === 'block') {
              sanitized = '***';
            }
          }
        } catch {
          this.logger.warn(`⚠️ Patrón regex inválido en customRule "${rule.name}": "${pattern}"`);
        }
      }
    }

    return { violations, sanitized };
  }

  /**
   * Verifica que la respuesta no exceda el máximo de recomendaciones.
   */
  private checkMaxRecommendations(
    response: string,
    maxRecommendations: number,
  ): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const listItems = response.match(/^\d+[\.)]\s/gm) || [];

    if (listItems.length > maxRecommendations) {
      violations.push({
        type: 'MAX_RECOMMENDATIONS_EXCEEDED',
        severity: 'medium',
        message: `Demasiadas recomendaciones: ${listItems.length} (máximo ${maxRecommendations})`,
        suggestion: `Reducir a ${maxRecommendations} opciones máximo`,
      });
    }

    return { violations };
  }

  /**
   * Verifica que la respuesta contenga un saludo.
   */
  private checkGreeting(response: string): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const greetingPatterns = [
      /hola/i,
      /buenos\s+(días|dias)/i,
      /buenas\s+(tardes|noches)/i,
      /hello/i,
      /hi\b/i,
      /saludos/i,
    ];

    const hasGreeting = greetingPatterns.some((p) => p.test(response));
    if (!hasGreeting && response.length > 50) {
      violations.push({
        type: 'MISSING_GREETING',
        severity: 'low',
        message: 'Saludo requerido no encontrado en la respuesta',
      });
    }

    return { violations };
  }

  /**
   * Verifica que la respuesta contenga una despedida o cierre.
   */
  private checkClosing(response: string): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];
    const closingPatterns = [
      /¿.*\?/i,
      /escríbeme/i,
      /avísame/i,
      /estoy\s+aquí/i,
      /en\s+qué\s+puedo/i,
      /otra\s+cosa/i,
      /necesitas\s+algo/i,
    ];

    const hasClosing = closingPatterns.some((p) => p.test(response));
    if (!hasClosing && response.length > 100) {
      violations.push({
        type: 'MISSING_CLOSING',
        severity: 'low',
        message: 'Cierre o pregunta de seguimiento requerida no encontrada',
      });
    }

    return { violations };
  }

  /**
   * Verifica que la respuesta contenga los temas requeridos.
   */
  private checkRequiredTopics(
    response: string,
    topics: string[],
  ): { violations: ContentViolation[] } {
    const violations: ContentViolation[] = [];

    for (const topic of topics) {
      let found = false;

      try {
        found = new RegExp(RegexBuilder.accent(topic), 'i').test(response);
      } catch {
        found = response.toLowerCase().includes(topic.toLowerCase());
      }

      if (!found) {
        violations.push({
          type: 'MISSING_REQUIRED_TOPIC',
          severity: 'medium',
          message: `Tema requerido no encontrado: "${topic}"`,
        });
      }
    }

    return { violations };
  }
}
