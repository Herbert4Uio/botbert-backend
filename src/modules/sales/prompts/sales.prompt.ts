import { buildDynamicContextPolicy } from './policies/dynamic-context.policy';
import { buildSecurityPolicy } from './policies/security.policy';
import { buildToolsPolicy } from './policies/tools.policy';
import { buildConversationPolicy } from './policies/conversation.policy';
import { buildBusinessPolicy } from './policies/business.policy';

export function buildSalesPrompt(tenant: any, branches: any[], conversation: any, selectedSuggestions: string[] = []): string {
  const dynamicContext = buildDynamicContextPolicy(tenant, branches, conversation, selectedSuggestions);
  const conversationPolicy = buildConversationPolicy();
  const businessPolicy = buildBusinessPolicy();
  const toolsPolicy = buildToolsPolicy();
  const securityPolicy = buildSecurityPolicy(tenant.name);

  return `
${dynamicContext}

==================================================
[INSTRUCCIONES DEL TENANT] (Custom)
==================================================
${tenant.systemPrompt || 'El tenant no ha proveído instrucciones personalizadas.'}

${conversationPolicy}
${businessPolicy}
${toolsPolicy}
${securityPolicy}
`;
}
