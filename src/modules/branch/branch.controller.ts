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
import { ApiTags, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Branches')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'Listar sucursales de la empresa' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getBranches(@TenantId() tenantId: string) {
    return this.branchService.findAll(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva sucursal' })
  @Roles('OWNER', 'ADMIN')
  async createBranch(@TenantId() tenantId: string, @Body() data: any) {
    return this.branchService.create(tenantId, data);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar configuración de la sucursal (ej. SystemPrompt)',
  })
  @Roles('OWNER', 'ADMIN')
  async updateBranch(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.branchService.update(tenantId, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sucursal' })
  @Roles('OWNER')
  async removeBranch(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.branchService.remove(tenantId, id);
  }
}
