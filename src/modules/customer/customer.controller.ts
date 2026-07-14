import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Customers')
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes registrados por WhatsApp' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getCustomers(@TenantId() tenantId: string) {
    return this.customerService.findAll(tenantId);
  }
}
