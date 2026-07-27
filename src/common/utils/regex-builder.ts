/**
 * RegexBuilder — Motor robusto de generación de regex con fuzzy matching.
 *
 * Soporta:
 *  - Tolerancia a typos (distancia de Levenshtein configurable)
 *  - Normalización de acentos/caracteres especiales
 *  - Stemming básico (raíces de palabras)
 *  - Patrones compuestos flexibles
 *  - Variantes de escritura (doble letra, intercambio, etc.)
 */
export class RegexBuilder {
  private static readonly ACCENT_MAP: Record<string, string> = {
    a: '[aáAÁàÀâÂäÄãÃåÅ]',
    e: '[eéEÉèÈêÊëË]',
    i: '[iíIÍìÌîÎïÏ]',
    o: '[oóOÓòÒôÔöÖõÕøØ]',
    u: '[uúUÚùÙûÛüÜ]',
    n: '[nñÑ]',
    c: '[cçÇ]',
    s: '[sşŞ]',
  };

  private static readonly VOWELS = 'aeiouáéíóúüàèìòùâêîôûäëïöü';

  /**
   * Genera un regex que tolera typos usando distancia de Levenshtein.
   * Ej: fuzzy("zapatilla", 1) → matchea "zapattilla", "zapatila", "zapatilas", etc.
   */
  static fuzzy(word: string, maxDistance: number = 1): string {
    if (word.length <= 2) return this.accent(word);

    const parts: string[] = [];

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const charPattern = this.accentChar(char);

      if (i < word.length - 1) {
        const nextChar = word[i + 1];
        const nextPattern = this.accentChar(nextChar);

        if (char === nextChar) {
          parts.push(`${charPattern}{1,2}`);
        } else {
          parts.push(charPattern);
        }
      } else {
        parts.push(charPattern);
      }
    }

    let pattern = parts.join('');

    if (maxDistance >= 1) {
      pattern += `(?:s|es|z|ces)?`;
    }

    return pattern;
  }

  /**
   * Genera un regex que matchea con/sin acentos.
   * Ej: accent("café") → /[cç][aá][fF][eé]/i
   */
  static accent(word: string): string {
    return word
      .split('')
      .map((char) => this.accentChar(char))
      .join('');
  }

  /**
   * Genera variantes de una palabra con diferentes formas de escritura.
   * Ej: variants("zapatilla") → ["zapatilla", "zapatillas", "zapattilla", "zapatila"]
   */
  static variants(word: string): string[] {
    const result = new Set<string>();

    result.add(word);
    result.add(word + 's');
    result.add(word + 'es');

    if (word.endsWith('s')) {
      result.add(word.slice(0, -1));
    }
    if (word.endsWith('es')) {
      result.add(word.slice(0, -2));
    }

    if (word.endsWith('z')) {
      result.add(word.slice(0, -1) + 'ces');
      result.add(word.slice(0, -1) + 's');
    }

    if (word.endsWith('ión')) {
      result.add(word.slice(0, -3) + 'iones');
      result.add(word.slice(0, -3) + 'ion');
    }

    if (word.endsWith('ía')) {
      result.add(word.slice(0, -2) + 'ias');
      result.add(word.slice(0, -2) + 'ia');
    }

    const doubleLetterVariants = this.getDoubleLetterVariants(word);
    doubleLetterVariants.forEach((v) => {
      result.add(v);
      result.add(v + 's');
      result.add(v + 'es');
    });

    const swappedVariants = this.getSwappedVariants(word);
    swappedVariants.forEach((v) => {
      result.add(v);
      result.add(v + 's');
    });

    return [...result].filter((v) => v.length > 1);
  }

  /**
   * Genera un patrón que matchea la raíz de una palabra (stemming básico).
   * Ej: stem("corriendo") → /corriendo|corrieron|corrio|corre/i
   */
  static stem(word: string): string {
    const roots: string[] = [word];

    if (word.endsWith('ando') || word.endsWith('iendo')) {
      const base = word.slice(0, -4);
      roots.push(base + 'ar', base + 'er', base + 'ir');
      roots.push(base + 'ó', base + 'ió');
      roots.push(base + 'arón', base + 'ieron');
    }

    if (word.endsWith('ado') || word.endsWith('ido')) {
      const base = word.slice(0, -3);
      roots.push(base + 'ar', base + 'er', base + 'ir');
      roots.push(base + 'ados', base + 'idos');
    }

    if (word.endsWith('mente')) {
      const base = word.slice(0, -5);
      roots.push(base);
      roots.push(base + 'o', base + 'a');
      roots.push(base + 'os', base + 'as');
    }

    if (word.endsWith('ción')) {
      const base = word.slice(0, -4);
      roots.push(base + 'cion', base + 'ciones');
      roots.push(base + 'cir', base + 'car');
    }

    if (word.endsWith('dad')) {
      const base = word.slice(0, -3);
      roots.push(base + 'dades');
    }

    if (word.endsWith('oso') || word.endsWith('osa')) {
      const base = word.slice(0, -3);
      roots.push(base + 'osos', base + 'osas');
      roots.push(base + 'osidad');
    }

    if (word.endsWith('ero') || word.endsWith('era')) {
      const base = word.slice(0, -3);
      roots.push(base + 'eros', base + 'eras');
      roots.push(base + 'ería');
    }

    const uniqueRoots = [...new Set(roots)].filter((r) => r.length >= 3);
    return uniqueRoots.map((r) => this.accent(r)).join('|');
  }

  /**
   * Combina múltiples patrones en un solo regex con prioridad.
   * Ej: compound(["zapatilla", "champión"], { fuzzy: 1, accent: true })
   */
  static compound(
    words: string[],
    options: {
      fuzzy?: number;
      accent?: boolean;
      stem?: boolean;
      caseInsensitive?: boolean;
    } = {},
  ): string {
    const { fuzzy = 0, accent = true, stem = false, caseInsensitive = true } = options;

    const patterns: string[] = [];

    for (const word of words) {
      if (accent) {
        patterns.push(this.accent(word));
      } else {
        patterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }

      if (stem) {
        patterns.push(this.stem(word));
      }
    }

    const uniquePatterns = [...new Set(patterns)];
    const flags = caseInsensitive ? 'gi' : 'g';
    const regexStr = uniquePatterns.join('|');

    return regexStr;
  }

  /**
   * Genera un regex para buscar palabras clave con tolerancia a errores.
   * Combina: acentos + typos + doble letra + plurales
   */
  static keywordSearch(keyword: string): string {
    const accentPattern = this.accent(keyword);

    let typoPattern = '';
    if (keyword.length >= 4) {
      const chars = keyword.split('');
      const typoParts: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        const char = this.accentChar(chars[i]);
        if (i < chars.length - 1 && chars[i] === chars[i + 1]) {
          typoParts.push(`${char}{1,2}`);
        } else {
          typoParts.push(char);
        }
      }
      typoPattern = typoParts.join('');
    }

    const root = keyword.endsWith('s')
      ? keyword.slice(0, -1)
      : keyword.endsWith('es')
        ? keyword.slice(0, -2)
        : keyword;

    const pluralPattern = this.accent(root) + '(?:s|es)?';

    const allPatterns = [accentPattern, pluralPattern];
    if (typoPattern) allPatterns.push(typoPattern);

    return `[${keyword}](${allPatterns.join('|')})`;
  }

  /**
   * Crea un mapa de sustituciones de caracteres para matching tolerante.
   */
  static getCharAlternatives(char: string): string {
    const lower = char.toLowerCase();

    const alternatives: Record<string, string> = {
      b: '[bBD]',
      v: '[vVB]',
      c: '[ccksCKS]',
      k: '[kcCK]',
      s: '[scSCzZ]',
      z: '[zsZS]',
      g: '[gjGJ]',
      j: '[jgGJ]',
      y: '[yiI]',
      i: '[iyI]',
      ll: '[llYy]',
      rr: '[rrRr]',
      qu: '[qukwKW]',
    };

    return alternatives[lower] || this.accentChar(char);
  }

  /**
   * Patrón para palabras con intercambio de letras adyacentes.
   */
  private static getSwappedVariants(word: string): string[] {
    const variants: string[] = [];
    for (let i = 0; i < word.length - 1; i++) {
      if (word[i] !== word[i + 1]) {
        const swapped =
          word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
        variants.push(swapped);
      }
    }
    return variants;
  }

  /**
   * Patrón para palabras con doble letra (o viceversa).
   */
  private static getDoubleLetterVariants(word: string): string[] {
    const variants: string[] = [];
    const consonants = 'bcdfghjklmnpqrstvwxyz';

    for (let i = 0; i < word.length; i++) {
      if (consonants.includes(word[i].toLowerCase())) {
        if (i + 1 < word.length && word[i] === word[i + 1]) {
          variants.push(word.slice(0, i) + word.slice(i + 1));
        } else if (
          i + 1 < word.length &&
          consonants.includes(word[i + 1].toLowerCase())
        ) {
          variants.push(
            word.slice(0, i) + word[i] + word[i] + word.slice(i + 1),
          );
        }
      }
    }
    return variants;
  }

  /**
   * Convierte un carácter a su patrón con variantes de acento.
   */
  private static accentChar(char: string): string {
    const lower = char.toLowerCase();
    const map: Record<string, string> = {
      a: '[aáàâäãå]',
      e: '[eéèêë]',
      i: '[iíìîï]',
      o: '[oóòôöõø]',
      u: '[uúùûü]',
      n: '[nñ]',
      c: '[cç]',
      s: '[sş]',
      y: '[yÿ]',
    };
    return map[lower] || char;
  }

  /**
   * Calcula la distancia de Levenshtein entre dos strings.
   */
  static levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const matrix: number[][] = [];

    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[m][n];
  }

  /**
   * Escapa caracteres especiales de regex en un string.
   */
  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Verifica si dos palabras están dentro de una distancia de Levenshtein.
   */
  static isSimilar(
    word1: string,
    word2: string,
    maxDistance: number = 2,
  ): boolean {
    const normalized1 = word1
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const normalized2 = word2
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalized1 === normalized2) return true;

    if (Math.abs(normalized1.length - normalized2.length) > maxDistance)
      return false;

    return this.levenshtein(normalized1, normalized2) <= maxDistance;
  }
}
