import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Delete('history')
  @Roles('OWNER', 'ADMIN')
  async clearHistory(@TenantId() tenantId: string) {
    return this.salesService.clearHistory(tenantId);
  }

  @Post('reset-memory')
  @Roles('OWNER', 'ADMIN')
  async resetAiMemory(@TenantId() tenantId: string) {
    return this.salesService.resetAiMemory(tenantId);
  }

  @Get('conversations')
  @Roles('OWNER', 'ADMIN', 'VIEWER')
  async getConversations(@TenantId() tenantId: string) {
    return this.salesService.getConversations(tenantId);
  }

  @Patch('conversations/:id/pause')
  @Roles('OWNER', 'ADMIN')
  async toggleAiPause(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body('isAiPaused') isAiPaused: boolean,
  ) {
    return this.salesService.toggleAiPause(
      tenantId,
      conversationId,
      isAiPaused,
    );
  }

  @Post('conversations/:id/message')
  @Roles('OWNER', 'ADMIN')
  async sendManualMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body('message') message: string,
  ) {
    return this.salesService.sendManualMessage(tenantId, conversationId, message);
  }

  @Post('conversations/:id/inject')
  @Roles('OWNER', 'ADMIN')
  async injectContextMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body('message') message: string,
  ) {
    return this.salesService.injectContextMessage(tenantId, conversationId, message);
  }

  @Post('conversations/:id/force-reply')
  @Roles('OWNER', 'ADMIN')
  async forceAiReply(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
  ) {
    return this.salesService.forceAiReply(tenantId, conversationId);
  }

  @Post('generate-prompt')
  @Roles('OWNER', 'ADMIN')
  async generatePrompt(@Body('businessDescription') businessDescription: string) {
    if (!businessDescription || businessDescription.trim().length < 10) {
      return { error: 'La descripción del negocio debe tener al menos 10 caracteres.' };
    }
    const prompt = await this.salesService.generatePrompt(businessDescription);
    return { prompt };
  }
}
