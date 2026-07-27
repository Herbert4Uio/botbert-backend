import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SynonymDictionary } from './schemas/synonym-dictionary.schema';
import { RegexBuilder } from '../../common/utils/regex-builder';
import { TextNormalizer } from '../../common/utils/text-normalizer';

@Injectable()
export class SynonymService {
  private readonly logger = new Logger(SynonymService.name);

  constructor(
    @InjectModel(SynonymDictionary.name)
    private synonymModel: Model<SynonymDictionary>,
  ) {}

  async findAll(tenantId: string) {
    return this.synonymModel
      .find({ tenantId: new Types.ObjectId(tenantId), isActive: true })
      .exec();
  }

  async findOne(tenantId: string, id: string) {
    return this.synonymModel
      .findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
  }

  async create(tenantId: string, data: any) {
    const processedEntries = (data.entries || []).map((entry: any) => ({
      ...entry,
      patterns: this.processPatterns(entry.patterns || []),
    }));

    return this.synonymModel.create({
      ...data,
      entries: processedEntries,
      tenantId: new Types.ObjectId(tenantId),
    });
  }

  async update(tenantId: string, id: string, data: any) {
    if (data.entries) {
      data.entries = data.entries.map((entry: any) => ({
        ...entry,
        patterns: this.processPatterns(entry.patterns || []),
      }));
    }

    return this.synonymModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) },
        data,
        { new: true },
      )
      .exec();
  }

  async delete(tenantId: string, id: string) {
    return this.synonymModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      })
      .exec();
  }

  /**
   * Procesa patrones del frontend a regex robustos.
   * Acepta tanto regex simples como palabras clave que se expanden automáticamente.
   *
   * Ejemplos de entrada del frontend:
   *   "zapatilla"     → genera patrones con acentos, plurales, typos
   *   "zapatillas?"   → regex estándar (soporte legacy)
   *   "/zapatillas?/" → regex raw
   */
  private processPatterns(patterns: string[]): string[] {
    const processed: string[] = [];

    for (const pattern of patterns) {
      if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        processed.push(pattern.slice(1, pattern.lastIndexOf('/')));
        continue;
      }

      if (pattern.includes('(') || pattern.includes('[') || pattern.includes('\\')) {
        processed.push(pattern);
        continue;
      }

      const baseWord = pattern.replace(/[?*+]/g, '');
      const accentPattern = RegexBuilder.accent(baseWord);
      processed.push(`${accentPattern}(?:s|es)?`);

      const fuzzyPattern = RegexBuilder.fuzzy(baseWord, 1);
      if (fuzzyPattern !== accentPattern) {
        processed.push(fuzzyPattern);
      }
    }

    return processed;
  }

  /**
   * Normaliza un query reemplazando variantes por su término canónico.
   * Soporta:
   *  - Matching con acentos (zapatilla = zapatillas = zapatillas)
   *  - Tolerancia a typos (zapattilla = zapatilla)
   *  - Plurales (zapatillas = zapatilla)
   *  - Variantes doble letra (zapatilla = zapatila)
   */
  async normalizeQuery(
    query: string,
    tenantId: string,
    categoryId?: string,
  ): Promise<string> {
    if (!query || query.trim() === '') return query;

    const normalizedQuery = TextNormalizer.normalizeQuery(query);

    const dictionary = await this.synonymModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    }).exec();

    if (!dictionary || !dictionary.entries?.length) return normalizedQuery;

    let result = normalizedQuery;
    const matchedCanonicals: string[] = [];

    for (const entry of dictionary.entries) {
      if (!entry.isActive) continue;
      if (categoryId && entry.category && entry.category !== categoryId) continue;

      for (const patternStr of entry.patterns) {
        try {
          const regex = new RegExp(patternStr, 'gi');
          const matches = result.match(regex);

          if (matches && matches.length > 0) {
            matchedCanonicals.push(entry.canonical);

            const isPlural = matches.some((m) => m.toLowerCase().endsWith('s'));
            const canonicalForm = isPlural
              ? this.pluralize(entry.canonical)
              : entry.canonical;

            result = result.replace(regex, canonicalForm);

            this.logger.debug(
              `🔄 Sinónimo: "${matches.join(', ')}" → "${canonicalForm}" (canónico: "${entry.canonical}")`,
            );
          }
        } catch (e) {
          this.logger.warn(
            `⚠️ Patrón regex inválido: "${patternStr}"`,
          );
        }
      }

      if (!matchedCanonicals.includes(entry.canonical)) {
        const fuzzyMatch = this.fuzzyMatchWord(result, entry);
        if (fuzzyMatch) {
          matchedCanonicals.push(entry.canonical);
          result = result.replace(
            new RegExp(RegexBuilder.escapeRegex(fuzzyMatch), 'gi'),
            entry.canonical,
          );
          this.logger.debug(
            `🔄 Fuzzy match: "${fuzzyMatch}" → "${entry.canonical}"`,
          );
        }
      }
    }

    if (matchedCanonicals.length > 0) {
      this.logger.log(
        `✅ Query normalizado: "${query}" → "${result}" (sinónimos: ${matchedCanonicals.join(', ')})`,
      );
    }

    return result;
  }

  /**
   * Matching fuzzy: busca si alguna palabra del query coincide con un entry
   * usando tolerancia a typos y acentos.
   */
  private fuzzyMatchWord(
    text: string,
    entry: { canonical: string; patterns: string[] },
  ): string | null {
    const words = text.split(/\s+/);
    const maxDistance = entry.canonical.length <= 4 ? 1 : 2;

    for (const word of words) {
      if (RegexBuilder.isSimilar(word, entry.canonical, maxDistance)) {
        return word;
      }

      for (const pattern of entry.patterns) {
        const baseWord = pattern.replace(/[?*+]/g, '');
        if (RegexBuilder.isSimilar(word, baseWord, maxDistance)) {
          return word;
        }
      }
    }

    return null;
  }

  /**
   * Expande un término canónico a todas sus variantes regex.
   * Incluye acentos, plurales, y fuzzy variants.
   */
  async expandTerm(
    term: string,
    tenantId: string,
    categoryId?: string,
  ): Promise<string[]> {
    const dictionary = await this.synonymModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      isActive: true,
    }).exec();

    const expandedTerms = TextNormalizer.expandTerm(term);

    if (!dictionary || !dictionary.entries?.length) return expandedTerms;

    for (const entry of dictionary.entries) {
      if (!entry.isActive) continue;
      if (categoryId && entry.category && entry.category !== categoryId) continue;

      if (entry.canonical.toLowerCase() === term.toLowerCase()) {
        const variantWords = entry.patterns
          .map((p) => p.replace(/[?*+]/g, '').replace(/[\\()]/g, ''))
          .filter((w) => w.length > 1);
        variantWords.forEach((v) => expandedTerms.push(v));
      }
    }

    return [...new Set(expandedTerms)];
  }

  /**
   * Genera un regex compuesto para buscar un término con todas sus variantes.
   */
  async buildSearchRegex(
    term: string,
    tenantId: string,
    categoryId?: string,
  ): Promise<RegExp> {
    const variants = await this.expandTerm(term, tenantId, categoryId);
    const patterns = variants.map((v) => RegexBuilder.accent(v));
    const regexStr = patterns.join('|');
    return new RegExp(regexStr, 'gi');
  }

  private pluralize(word: string): string {
    const lower = word.toLowerCase();
    if (lower.endsWith('s')) return word;
    if (lower.endsWith('z')) return word.slice(0, -1) + 'ces';
    if (lower.endsWith('ión')) return word.slice(0, -3) + 'ones';
    if (lower.endsWith('a') || lower.endsWith('e') || lower.endsWith('o') || lower.endsWith('u')) {
      return word + 's';
    }
    return word + 'es';
  }
}
