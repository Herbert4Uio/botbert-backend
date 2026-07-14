import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
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
    @Body('isAiPaused') isAiPaused: boolean
  ) {
    return this.salesService.toggleAiPause(tenantId, conversationId, isAiPaused);
  }
}
