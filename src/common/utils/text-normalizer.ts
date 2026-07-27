import { RegexBuilder } from './regex-builder';

/**
 * TextNormalizer — Normalización de texto para búsquedas y matching.
 *
 * Soporta:
 *  - Normalización de acentos/caracteres especiales
 *  - Detección y corrección de typos comunes
 *  - Stemming básico
 *  - Expansión de sinónimos con fuzzy matching
 */
export class TextNormalizer {
  private static readonly STOP_WORDS = new Set([
    'un', 'una', 'unas', 'unos', 'el', 'la', 'los', 'las', 'lo',
    'para', 'con', 'de', 'en', 'por', 'al', 'del', 'que', 'es',
    'se', 'su', 'le', 'ya', 'ni', 'no', 'si', 'me', 'te',
    'y', 'e', 'o', 'a', 'ante', 'bajo', 'cabe', 'como',
    'contra', 'cual', 'cuando', 'desde', 'donde', 'durante',
    'entre', 'esta', 'este', 'esto', 'fin', 'fue', 'fuera',
    'has', 'han', 'hay', 'haya', 'he', 'hubo',
    'más', 'menos', 'mi', 'muy', 'son', 'soy', 'sus',
    'tal', 'tan', 'tanto', 'todo', 'tus', 'tu', 'tuyo',
    'tras', 'uno', 'vos', 'voy', 'zona', 'otro', 'otra',
    'mismo', 'misma', 'quiero', 'busco', 'necesito',
    'quisiera', 'dame', 'puedes', 'podrias', 'puede',
    'tiene', 'tengo', 'hacer', 'hace', 'hacen',
  ]);

  private static readonly COMMON_MISSPELLINGS: Record<string, string> = {
    'ke': 'que',
    'kiero': 'quiero',
    'kien': 'quien',
    'bien': 'bien',
    'bno': 'bueno',
    'bnas': 'buenas',
    'xq': 'por qué',
    'xk': 'porque',
    'porq': 'porque',
    'tmb': 'también',
    'tb': 'también',
    'nd': 'nada',
    'bn': 'buen',
    'q': 'que',
    'd': 'de',
    'x': 'por',
    'hl': 'hola',
    'qsy': 'que sé yo',
    'xdi': 'por dios',
    'ntp': 'no te preocupes',
    'ntc': 'no te creo',
    'bnm': 'buenísimo',
    'xfa': 'por favor',
    'afa': 'a favor',
    'msj': 'mensaje',
    'msg': 'mensaje',
    'tt': 'todo',
    'tdo': 'todo',
    'nps': 'no pasa nada',
    'np': 'no pasa',
    'dnd': 'dónde',
    'cmo': 'cómo',
    'sta': 'está',
    'nvo': 'nuevo',
    'nva': 'nueva',
    'bss': 'besos',
    'beso': 'beso',
  };

  /**
   * Normaliza un texto completo: remueve acentos, corrige typos, elimina stop words.
   */
  static normalize(text: string): string {
    let result = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    result = result.replace(/(.)\1{2,}/g, '$1$1');

    result = result.replace(/[^a-záéíóúñü0-9\s]/g, ' ');

    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Normaliza un query de búsqueda: corrige typos comunes y normaliza.
   */
  static normalizeQuery(query: string): string {
    let normalized = this.normalize(query);

    const words = normalized.split(/\s+/);
    const corrected = words.map((word) => {
      if (this.COMMON_MISSPELLINGS[word]) {
        return this.COMMON_MISSPELLINGS[word];
      }
      return word;
    });

    return corrected.join(' ');
  }

  /**
   * Extrae keywords relevantes de un texto (elimina stop words).
   */
  static extractKeywords(text: string): string[] {
    const normalized = this.normalize(text);
    return normalized
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.STOP_WORDS.has(w));
  }

  /**
   * Genera un regex tolerante para un keyword de búsqueda.
   * Combina: acentos + plurales + typos leves
   */
  static buildSearchRegex(keyword: string): {
    regex: RegExp;
    rootWords: string[];
  } {
    const normalized = this.normalize(keyword);

    const words = normalized
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.STOP_WORDS.has(w));

    if (words.length === 0) {
      return { regex: new RegExp(this.normalize(keyword), 'i'), rootWords: [] };
    }

    const rootWords = words.map((w) => {
      let root = w;
      if (root.endsWith('es') && root.length > 4) {
        root = root.slice(0, -2);
      } else if (root.endsWith('s') && root.length > 3) {
        root = root.slice(0, -1);
      }
      return root;
    });

    const patterns = rootWords.map((root) => {
      const accentPattern = RegexBuilder.accent(root);
      return `${accentPattern}(?:s|es)?`;
    });

    const regexString = patterns.join('|');
    return { regex: new RegExp(regexString, 'i'), rootWords };
  }

  /**
   * Compara dos textos y retorna un score de similitud (0-1).
   * Usa Jaccard similarity normalizada.
   */
  static similarity(text1: string, text2: string): number {
    const normalize = (text: string) =>
      this.normalize(text)
        .split(/\s+/)
        .filter((w) => w.length > 1 && !this.STOP_WORDS.has(w));

    const tokens1 = new Set(normalize(text1));
    const tokens2 = new Set(normalize(text2));

    if (tokens1.size === 0 || tokens2.size === 0) {
      return tokens1.size === tokens2.size ? 1 : 0;
    }

    let intersection = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) {
        intersection++;
      } else {
        for (const t2 of tokens2) {
          if (RegexBuilder.isSimilar(token, t2, 1)) {
            intersection += 0.5;
            break;
          }
        }
      }
    }

    const union = new Set([...tokens1, ...tokens2]).size;
    return intersection / union;
  }

  /**
   * Expande un término a todas sus variantes posibles (plural, acentos, etc.)
   */
  static expandTerm(term: string): string[] {
    const normalized = this.normalize(term);
    const variants = new Set<string>();

    variants.add(normalized);
    variants.add(normalized + 's');
    variants.add(normalized + 'es');

    if (normalized.endsWith('z')) {
      variants.add(normalized.slice(0, -1) + 'ces');
    }

    if (normalized.endsWith('ión')) {
      variants.add(normalized.slice(0, -3) + 'iones');
    }

    const fuzzyVariants = RegexBuilder.variants(normalized);
    fuzzyVariants.forEach((v) => variants.add(v));

    return [...variants].filter((v) => v.length > 1);
  }

  /**
   * Valida si un patrón regex es seguro y válido.
   */
  static isValidRegex(pattern: string): boolean {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escapa caracteres especiales de regex en un string.
   */
  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
