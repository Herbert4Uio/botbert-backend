import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Primero, intentar obtener del usuario autenticado (JWT)
    if (request.user && request.user.tenantId) {
      return request.user.tenantId;
    }

    // Fallback al header (útil para webhooks o scripts internos si no hay JWT)
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) {
      throw new UnauthorizedException(
        'Tenant ID is missing. User not authenticated or x-tenant-id header is missing.',
      );
    }

    return tenantId;
  },
);
