import { Controller, Post, Get, UseGuards, Body, BadRequestException } from '@nestjs/common';
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
  async connectPairing(
    @TenantId() tenantId: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    if (!phoneNumber) {
      throw new BadRequestException('El número de teléfono es requerido');
    }
    const code = await this.whatsappService.generatePairingCode(tenantId, phoneNumber);
    return { message: 'Pairing code generado', code };
  }
  @Post('disconnect')
  @Roles('OWNER', 'ADMIN')
  async disconnect(@TenantId() tenantId: string) {
    await this.whatsappService.disconnectSession(tenantId);
    return { message: 'Desconectado exitosamente' };
  }
}
