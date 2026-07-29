import { Controller, Get, Post, Put, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation, ApiBody } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Orders')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'ID del Tenant (Empresa)',
})
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las órdenes de la empresa' })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getOrders(@TenantId() tenantId: string) {
    return this.orderService.findAll(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una orden manualmente' })
  @Roles('OWNER', 'ADMIN')
  async createOrder(
    @TenantId() tenantId: string,
    @Body() body: { data: any; sendConfirmation: boolean },
  ) {
    return this.orderService.createOrder(tenantId, body.data, body.sendConfirmation);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar una orden existente' })
  @Roles('OWNER', 'ADMIN')
  async updateOrder(
    @TenantId() tenantId: string,
    @Param('id') orderId: string,
    @Body() data: any,
  ) {
    return this.orderService.updateOrder(tenantId, orderId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una orden' })
  @Roles('OWNER', 'ADMIN')
  async deleteOrder(
    @TenantId() tenantId: string,
    @Param('id') orderId: string,
  ) {
    return this.orderService.deleteOrder(tenantId, orderId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Actualizar el estado de una orden (PENDIENTE, ENVIADO, CANCELADO)',
  })
  @ApiBody({ schema: { example: { status: 'ENVIADO' } } })
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async updateStatus(
    @TenantId() tenantId: string,
    @Param('id') orderId: string,
    @Body('status') status: string,
  ) {
    return this.orderService.updateStatus(tenantId, orderId, status);
  }

  @Patch(':id/paid')
  @ApiOperation({ summary: 'Actualizar estado de pago de una orden' })
  @ApiBody({ schema: { example: { isPaid: true } } })
  @Roles('OWNER', 'ADMIN')
  async updatePaidStatus(
    @TenantId() tenantId: string,
    @Param('id') orderId: string,
    @Body('isPaid') isPaid: boolean,
  ) {
    return this.orderService.updatePaidStatus(tenantId, orderId, isPaid);
  }
}
