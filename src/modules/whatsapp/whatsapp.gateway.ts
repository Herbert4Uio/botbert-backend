import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp'
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    if (tenantId) {
      client.join(tenantId);
      console.log(`Client connected to tenant room: ${tenantId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  emitQrCode(tenantId: string, qr: string) {
    this.server.to(tenantId).emit('qr', { qr });
  }

  emitConnectionStatus(tenantId: string, status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY') {
    this.server.to(tenantId).emit('status', { status });
  }
}
