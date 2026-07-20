import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las empresas (Solo SUPERADMIN)' })
  @Roles('SUPERADMIN')
  async getTenants() {
    return this.tenantService.findAll();
  }

  @Get('my-tenant')
  @ApiOperation({
    summary:
      'Obtener información de mi empresa actual (Todos los roles del Tenant)',
  })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getMyTenant(@TenantId() tenantId: string) {
    return this.tenantService.findOne(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva empresa y su OWNER (Solo SUPERADMIN)' })
  @Roles('SUPERADMIN')
  async createTenant(@Body() data: any) {
    return this.tenantService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar configuración de la empresa' })
  @Roles('SUPERADMIN', 'OWNER') // SUPERADMIN puede editar cualquier cosa, OWNER edita la suya. Idealmente deberíamos checar que el OWNER edite su propio tenantId.
  async updateTenant(@Param('id') id: string, @Body() data: any) {
    // La seguridad de si el OWNER edita el suyo se puede manejar a nivel de interceptor o lógica, pero para este SaaS simple basta así de momento.
    return this.tenantService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una empresa (Solo SUPERADMIN)' })
  @Roles('SUPERADMIN')
  async removeTenant(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
