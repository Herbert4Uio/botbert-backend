import { Controller, Post, Get, UseGuards, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  @Roles('OWNER', 'ADMIN')
  async getStatus(@TenantId() tenantId: string) {
    return this.whatsappService.getStatus(tenantId);
  }

  @Post('connect')
  @Roles('OWNER', 'ADMIN')
  async connect(@TenantId() tenantId: string) {
    await this.whatsappService.startSession(tenantId);
    return { message: 'Iniciando conexión' };
  }

  @Post('connect/pairing')
  @Roles('OWNER', 'ADMIN')
  async connectPairing(
    @TenantId() tenantId: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    if (!phoneNumber || phoneNumber.trim().length < 5) {
      return { error: 'Número de teléfono inválido' };
    }
    await this.whatsappService.startSession(tenantId, phoneNumber.trim().replace(/[^0-9]/g, ''));
    return { message: 'Solicitando código de vinculación' };
  }

  @Post('disconnect')
  @Roles('OWNER', 'ADMIN')
  async disconnect(@TenantId() tenantId: string) {
    await this.whatsappService.disconnectSession(tenantId);
    return { message: 'Desconectado exitosamente' };
  }
}
