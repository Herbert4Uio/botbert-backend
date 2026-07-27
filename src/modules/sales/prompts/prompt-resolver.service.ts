import { Injectable } from '@nestjs/common';

const VERTICAL_PLACEHOLDER = /{{vertical\.(\w+)}}/g;
const TENANT_PLACEHOLDER = /{{tenant\.(\w+)}}/g;

@Injectable()
export class PromptResolverService {
  resolve(template: string, vertical: any, tenant: any): string {
    let result = template;

    result = result.replace(VERTICAL_PLACEHOLDER, (_match, key) => {
      const value = vertical?.[key];
      if (value === undefined || value === null) return '';
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'boolean') return value ? 'Sí' : 'No';
      return String(value);
    });

    result = result.replace(TENANT_PLACEHOLDER, (_match, key) => {
      const value = tenant?.[key];
      if (value === undefined || value === null) return '';
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'boolean') return value ? 'Sí' : 'No';
      return String(value);
    });

    return result;
  }

  resolveLegalSection(vertical: any): string {
    if (!vertical?.legalDisclaimers?.length) return '';
    return `==================================================
[AVISOS LEGALES OBLIGATORIOS - ${vertical.name}]
==================================================
${vertical.legalDisclaimers.map((d: string) => `- ${d}`).join('\n')}`;
  }

  resolveToneInstruction(vertical: any): string {
    if (!vertical?.tone) return '';
    return `[TONO Y ESTILO]\nTono: ${vertical.tone}`;
  }

  resolveProhibitedTerms(vertical: any): string {
    if (!vertical?.prohibitedTerms?.length) return '';
    return `[TÉRMINOS PROHIBIDOS EN TUS RESPUESTAS]\nNUNCA uses estas palabras o frases en tus respuestas: ${vertical.prohibitedTerms.join(', ')}`;
  }
}