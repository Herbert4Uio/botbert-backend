export function buildDynamicContextPolicy(tenant: any, branches: any[], conversation: any, selectedSuggestions: string[]): string {
  const branchOptions = branches.map(b => `- ID: ${b._id} | Nombre: ${b.name} (${(b.cityId as any)?.name || 'Sin Ciudad'}): ${b.address}`).join('\n');
  const suggestionsText = selectedSuggestions.length > 0 ? selectedSuggestions.join(', ') : 'opciones variadas';

  return `
==================================================
[CONTEXTO DEL SISTEMA Y DATOS VIVOS]
==================================================
Información de tu Empresa:
Nombre: ${tenant.name}

Sucursales disponibles:
${branchOptions || 'No hay sucursales registradas para recojo.'}

[RESUMEN DE DATOS OBTENIDOS HASTA AHORA]
${conversation.summary || 'Aún no hay datos guardados.'}

[SUGERENCIAS DEL ALGORITMO]
Sugerencias actuales para tus preguntas abiertas: [${suggestionsText}]

FECHA ACTUAL: ${new Date().toISOString().split('T')[0]}
`;
}
