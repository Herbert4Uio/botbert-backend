import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './schemas/order.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private readonly whatsappService: WhatsappService,
  ) {}

  async findAll(tenantId: string) {
    return this.orderModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('customerId')
      .populate('branchId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(tenantId: string, orderId: string, status: string) {
    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          tenantId: new Types.ObjectId(tenantId),
        },
        { status },
        { new: true },
      )
      .populate('customerId');

    if (order && order.customerId) {
      const customer: any = order.customerId;
      const jid = customer.whatsappId;

      let message = '';
      switch (status) {
        case 'CONFIRMED':
          message = `¡Hola ${customer.profileName || ''}! Tu pedido #${order._id.toString().slice(-6).toUpperCase()} ha sido confirmado y lo estamos preparando.`;
          break;
        case 'ON_THE_WAY':
          message = `🚚 ¡Buenas noticias! Tu pedido #${order._id.toString().slice(-6).toUpperCase()} ya está en camino a tu dirección. ¡Atento a su llegada!`;
          break;
        case 'DELIVERED':
          message = `✅ Tu pedido #${order._id.toString().slice(-6).toUpperCase()} ha sido entregado. ¡Esperamos que lo disfrutes! Gracias por preferirnos.`;
          break;
        case 'CANCELLED':
          message = `❌ Hola, te informamos que tu pedido #${order._id.toString().slice(-6).toUpperCase()} ha sido cancelado. Si tienes dudas, puedes responder a este chat.`;
          break;
      }

      if (message) {
        try {
          await this.whatsappService.sendMessage(tenantId, jid, message);
          this.logger.log(
            `Notificación de estado enviada al cliente ${jid} para orden ${order._id}`,
          );
        } catch (error) {
          this.logger.error(
            `Error enviando notificación al cliente ${jid}`,
            error,
          );
        }
      }
    }

    return order;
  }

  async updatePaidStatus(tenantId: string, orderId: string, isPaid: boolean) {
    return this.orderModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          tenantId: new Types.ObjectId(tenantId),
        },
        { isPaid },
        { new: true },
      )
      .populate('customerId');
  }
}
