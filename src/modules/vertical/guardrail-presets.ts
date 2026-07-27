export interface GuardrailPresetConfig {
  name: string;
  label: string;
  description: string;
  config: {
    guardrailsEnabled: boolean;
    maxResponseLength: number;
    minResponseLength: number;
    priceDisclaimerRequired: boolean;
    productValidationEnabled: boolean;
    requireGreeting: boolean;
    requireClosing: boolean;
    defaultAction: string;
    fallbackMessage: string;
    blockedTopics: string[];
    requiredTopics: string[];
    prohibitedPatterns: string[];
    prohibitedTerms: string[];
    legalDisclaimers: string[];
    customRules: Array<{
      name: string;
      description: string;
      enabled: boolean;
      action: string;
      patterns: string[];
      replacement: string;
      severity: string;
      appliesToPhases: string[];
    }>;
    toneRules: Array<{
      pattern: string;
      message: string;
      severity: string;
      action: string;
      suggestion: string;
    }>;
  };
}

export const GUARDRAIL_PRESETS: GuardrailPresetConfig[] = [
  {
    name: 'retail_general',
    label: 'Retail General',
    description: 'Configuración para tiendas de retail general. Enfoque en productos, precios y disponibilidad.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 800,
      minResponseLength: 20,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: false,
      requireClosing: false,
      defaultAction: 'sanitize',
      fallbackMessage: 'Disculpa, no pude procesar tu consulta. ¿Podrías reformularla?',
      blockedTopics: ['política', 'religión', 'drogas', 'arma', 'competencia'],
      requiredTopics: [],
      prohibitedPatterns: [],
      prohibitedTerms: ['competencia', 'otra tienda', 'más barato en'],
      legalDisclaimers: ['Precios sujetos a cambio sin previo aviso', 'Disponibilidad sujeta a stock'],
      customRules: [
        {
          name: 'no_listas_largas',
          description: 'Evitar listas de más de 3 productos',
          enabled: true,
          action: 'block',
          patterns: ['^\\d+[\\.)]\\s.*\\n.*\\n.*\\n.*\\n'],
          replacement: '',
          severity: 'high',
          appliesToPhases: ['RECOMMENDATION'],
        },
        {
          name: 'sin_numeros_whatsapp',
          description: 'No enviar números de teléfono del negocio',
          enabled: true,
          action: 'sanitize',
          patterns: ['\\b\\d{7,}\\b'],
          replacement: '[número disponible en nuestro perfil]',
          severity: 'high',
          appliesToPhases: [],
        },
      ],
      toneRules: [
        {
          pattern: '\\bwey\\b',
          message: 'Lenguaje coloquial detectado',
          severity: 'medium',
          action: 'warn',
          suggestion: 'Usar un tono más profesional',
        },
      ],
    },
  },
  {
    name: 'restaurante',
    label: 'Restaurante / Food Service',
    description: 'Configuración para restaurantes. Énfasis en menú, horarios, pedidos y alérgenos.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 600,
      minResponseLength: 15,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: false,
      requireClosing: false,
      defaultAction: 'sanitize',
      fallbackMessage: 'Lo siento, no pude entender tu pedido. ¿Podrías repetirlo?',
      blockedTopics: ['política', 'religión', 'drogas', 'arma'],
      requiredTopics: [],
      prohibitedPatterns: [],
      prohibitedTerms: ['otro restaurante', 'más barato en', 'competencia'],
      legalDisclaimers: ['Precios con IGV incluido', 'Disponibilidad sujeta a ingredientes'],
      customRules: [
        {
          name: 'alergenos',
          description: 'Recordatorio de alérgenos obligatorio',
          enabled: true,
          action: 'replace',
          patterns: ['pollo', 'carne', 'pescado', 'mariscos', 'lactosa', 'gluten'],
          replacement: '$& (recordá informar sobre alérgenos)',
          severity: 'medium',
          appliesToPhases: ['RECOMMENDATION'],
        },
        {
          name: 'horario',
          description: 'No prometer disponibilidad fuera de horario',
          enabled: true,
          action: 'warn',
          patterns: ['ahora', 'inmediato', 'ya'],
          replacement: '',
          severity: 'low',
          appliesToPhases: ['LOGISTICS'],
        },
      ],
      toneRules: [
        {
          pattern: '\\bpedo\\b',
          message: 'Lenguaje vulgar detectado',
          severity: 'high',
          action: 'block',
          suggestion: 'Mantener un tono respetuoso',
        },
      ],
    },
  },
  {
    name: 'inmobiliaria',
    label: 'Inmobiliaria / Bienes Raíces',
    description: 'Configuración para inmobiliarias. Enfoque en propiedades, ubicación, financiamiento.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 1000,
      minResponseLength: 30,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: true,
      requireClosing: false,
      defaultAction: 'block',
      fallbackMessage: 'Para brindarte información precisa sobre nuestras propiedades, ¿podrías especificar tu búsqueda?',
      blockedTopics: ['política', 'religión', 'drogas', 'competencia'],
      requiredTopics: ['ubicación', 'presupuesto'],
      prohibitedPatterns: [],
      prohibitedTerms: ['otra inmobiliaria', 'más barato en', 'garantía total'],
      legalDisclaimers: [
        'Los precios son referenciales y pueden variar',
        'Sujeto a avalúo y aprobación de crédito',
        'Imágenes meramente ilustrativas',
      ],
      customRules: [
        {
          name: 'precio_estimado',
          description: 'Nunca dar precio exacto sin consultar',
          enabled: true,
          action: 'replace',
          patterns: ['\\$\\s*\\d+\\.?\\d*'],
          replacement: '[precio de consulta]',
          severity: 'high',
          appliesToPhases: ['DISCOVERY', 'RECOMMENDATION'],
        },
        {
          name: 'ubicacion_verificada',
          description: 'Verificar que la ubicación mencionada exista',
          enabled: true,
          action: 'warn',
          patterns: ['calle\\s+\\w+'],
          replacement: '',
          severity: 'medium',
          appliesToPhases: ['RECOMMENDATION'],
        },
      ],
      toneRules: [
        {
          pattern: '\\bche\\b',
          message: 'Modismo informal detectado',
          severity: 'medium',
          action: 'sanitize',
          suggestion: 'Usar un tono más formal para transacciones inmobiliarias',
        },
      ],
    },
  },
  {
    name: 'tecnologia',
    label: 'Tienda de Tecnología',
    description: 'Configuración para tiendas de tecnología. Énfasis en specs, compatibilidad y garantías.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 900,
      minResponseLength: 25,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: false,
      requireClosing: false,
      defaultAction: 'sanitize',
      fallbackMessage: 'No encontré información sobre ese producto. ¿Podrías darme más detalles?',
      blockedTopics: ['política', 'religión', 'drogas', 'competencia'],
      requiredTopics: [],
      prohibitedPatterns: [],
      prohibitedTerms: ['otra tienda', 'más barato en', 'copia falsa'],
      legalDisclaimers: [
        'Precios pueden variar sin previo aviso',
        'Garantía según fabricante',
        'Stock sujeto a disponibilidad',
      ],
      customRules: [
        {
          name: 'no_specs_inventados',
          description: 'No inventar especificaciones técnicas',
          enabled: true,
          action: 'block',
          patterns: ['\\d+\\s*(?:gb|tb|ghz|mhz|mah|w)', 'resolución\\s+\\d+'],
          replacement: '',
          severity: 'high',
          appliesToPhases: ['RECOMMENDATION'],
        },
        {
          name: 'compatibilidad',
          description: 'Verificar compatibilidad mencionada',
          enabled: true,
          action: 'warn',
          patterns: ['compatible\\s+con', 'funciona\\s+con'],
          replacement: '',
          severity: 'medium',
          appliesToPhases: ['RECOMMENDATION'],
        },
      ],
      toneRules: [],
    },
  },
  {
    name: 'farmacia',
    label: 'Farmacia / Salud',
    description: 'Configuración para farmacias. Máxima precaución con términos de salud.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 700,
      minResponseLength: 20,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: true,
      requireClosing: false,
      defaultAction: 'block',
      fallbackMessage: 'Para tu seguridad, te recomiendo consultar con nuestro personal farmacéutico.',
      blockedTopics: ['diagnóstico', 'tratamiento médico', 'dosis', 'política', 'religión'],
      requiredTopics: [],
      prohibitedPatterns: ['cura\\s+\\w+', 'trata\\s+\\w+', 'elimina\\s+\\w+'],
      prohibitedTerms: ['medicamento', 'receta', 'sin receta', 'automedicación'],
      legalDisclaimers: [
        'Este producto no reemplaza la consulta médica',
        'Consulte a su profesional de salud',
        'Precios pueden variar',
      ],
      customRules: [
        {
          name: 'sin_diagnosticos',
          description: 'Nunca ofrecer diagnósticos médicos',
          enabled: true,
          action: 'block',
          patterns: ['tienes\\s+\\w+', 'sufres\\s+de\\s+\\w+', 'padeces\\s+\\w+'],
          replacement: '',
          severity: 'critical',
          appliesToPhases: [],
        },
        {
          name: 'sin_dosis',
          description: 'No recomendar dosis',
          enabled: true,
          action: 'block',
          patterns: ['\\d+\\s*(?:mg|ml|tabletas|cápsulas)', 'tomar\\s+\\d+'],
          replacement: '',
          severity: 'critical',
          appliesToPhases: [],
        },
        {
          name: 'disclaimer_salud',
          description: 'Disclaimer de salud obligatorio',
          enabled: true,
          action: 'replace',
          patterns: ['\\b\\w+\\b.*(?:salud|médic|farmac|medicin)'],
          replacement: '$& (Consulte a su profesional de salud)',
          severity: 'high',
          appliesToPhases: ['RECOMMENDATION'],
        },
      ],
      toneRules: [
        {
          pattern: '\\btranqui\\b',
          message: 'Tono demasiado casual para contexto de salud',
          severity: 'medium',
          action: 'sanitize',
          suggestion: 'Usar un tono más serio y profesional',
        },
      ],
    },
  },
  {
    name: 'moda',
    label: 'Moda / Fashion',
    description: 'Configuración para tiendas de moda. Énfasis en tallas, colores y tendencias.',
    config: {
      guardrailsEnabled: true,
      maxResponseLength: 700,
      minResponseLength: 20,
      priceDisclaimerRequired: true,
      productValidationEnabled: true,
      requireGreeting: false,
      requireClosing: false,
      defaultAction: 'sanitize',
      fallbackMessage: 'No encontré ese producto. ¿Podrías darme más detalles sobre lo que buscas?',
      blockedTopics: ['política', 'religión', 'drogas', 'competencia'],
      requiredTopics: [],
      prohibitedPatterns: [],
      prohibitedTerms: ['otra tienda', 'más barato en', 'copia'],
      legalDisclaimers: [
        'Precios sujetos a cambio',
        'Colores pueden variar según pantalla',
        'Disponibilidad sujeta a stock',
      ],
      customRules: [
        {
          name: 'tallas_disponibles',
          description: 'Verificar que las tallas mencionadas existan',
          enabled: true,
          action: 'warn',
          patterns: ['talla\\s+\\w+'],
          replacement: '',
          severity: 'medium',
          appliesToPhases: ['RECOMMENDATION'],
        },
        {
          name: 'colores_exactos',
          description: 'No afirmar colores sin verificar',
          enabled: true,
          action: 'warn',
          patterns: ['color\\s+\\w+'],
          replacement: '',
          severity: 'low',
          appliesToPhases: ['RECOMMENDATION'],
        },
      ],
      toneRules: [],
    },
  },
];

/**
 * Obtiene un preset por nombre.
 */
export function getPresetByName(name: string): GuardrailPresetConfig | undefined {
  return GUARDRAIL_PRESETS.find((p) => p.name === name);
}

/**
 * Obtiene la configuración de guardrails para un vertical, priorizando:
 * 1. Preset activo del verticalConfig
 * 2. Configuración personalizada del verticalConfig
 * 3. Preset por defecto (retail_general)
 */
export function resolveGuardrailConfig(
  verticalConfig: any,
): GuardrailPresetConfig['config'] {
  if (!verticalConfig) {
    return GUARDRAIL_PRESETS[0].config;
  }

  if (verticalConfig.activePreset) {
    const preset = getPresetByName(verticalConfig.activePreset);
    if (preset) {
      return {
        ...preset.config,
        ...getCustomOverrides(verticalConfig),
      };
    }
  }

  return {
    guardrailsEnabled: verticalConfig.guardrailsEnabled ?? true,
    maxResponseLength: verticalConfig.maxResponseLength ?? 800,
    minResponseLength: verticalConfig.minResponseLength ?? 20,
    priceDisclaimerRequired: verticalConfig.priceDisclaimerRequired ?? true,
    productValidationEnabled: verticalConfig.productValidationEnabled ?? true,
    requireGreeting: verticalConfig.requireGreeting ?? false,
    requireClosing: verticalConfig.requireClosing ?? false,
    defaultAction: verticalConfig.defaultAction ?? 'sanitize',
    fallbackMessage: verticalConfig.fallbackMessage ?? '',
    blockedTopics: verticalConfig.blockedTopics ?? [],
    requiredTopics: verticalConfig.requiredTopics ?? [],
    prohibitedPatterns: verticalConfig.prohibitedPatterns ?? [],
    prohibitedTerms: verticalConfig.prohibitedTerms ?? [],
    legalDisclaimers: verticalConfig.legalDisclaimers ?? [],
    customRules: verticalConfig.customRules ?? [],
    toneRules: verticalConfig.toneRules ?? [],
  };
}

function getCustomOverrides(verticalConfig: any): Partial<GuardrailPresetConfig['config']> {
  const overrides: Partial<GuardrailPresetConfig['config']> = {};

  if (verticalConfig.guardrailsEnabled !== undefined) overrides.guardrailsEnabled = verticalConfig.guardrailsEnabled;
  if (verticalConfig.maxResponseLength !== undefined) overrides.maxResponseLength = verticalConfig.maxResponseLength;
  if (verticalConfig.minResponseLength !== undefined) overrides.minResponseLength = verticalConfig.minResponseLength;
  if (verticalConfig.priceDisclaimerRequired !== undefined) overrides.priceDisclaimerRequired = verticalConfig.priceDisclaimerRequired;
  if (verticalConfig.productValidationEnabled !== undefined) overrides.productValidationEnabled = verticalConfig.productValidationEnabled;
  if (verticalConfig.requireGreeting !== undefined) overrides.requireGreeting = verticalConfig.requireGreeting;
  if (verticalConfig.requireClosing !== undefined) overrides.requireClosing = verticalConfig.requireClosing;
  if (verticalConfig.defaultAction !== undefined) overrides.defaultAction = verticalConfig.defaultAction;
  if (verticalConfig.fallbackMessage !== undefined) overrides.fallbackMessage = verticalConfig.fallbackMessage;
  if (verticalConfig.blockedTopics?.length) overrides.blockedTopics = verticalConfig.blockedTopics;
  if (verticalConfig.requiredTopics?.length) overrides.requiredTopics = verticalConfig.requiredTopics;
  if (verticalConfig.prohibitedPatterns?.length) overrides.prohibitedPatterns = verticalConfig.prohibitedPatterns;
  if (verticalConfig.prohibitedTerms?.length) overrides.prohibitedTerms = verticalConfig.prohibitedTerms;
  if (verticalConfig.legalDisclaimers?.length) overrides.legalDisclaimers = verticalConfig.legalDisclaimers;
  if (verticalConfig.customRules?.length) overrides.customRules = verticalConfig.customRules;
  if (verticalConfig.toneRules?.length) overrides.toneRules = verticalConfig.toneRules;

  return overrides;
}
