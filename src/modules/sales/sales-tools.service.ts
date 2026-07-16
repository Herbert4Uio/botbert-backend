import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Product } from '../catalog/schemas/product.schema';
import { Order } from '../order/schemas/order.schema';
import { Category } from '../catalog/schemas/category.schema';

@Injectable()
export class SalesToolsService {
  private readonly logger = new Logger(SalesToolsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) {}

  getAiTools(tenant: any) {
    const industryType = tenant?.industryType || 'productos';
    return [
      {
        type: "function",
        function: {
          name: "buscar_productos",
          description: `Busca ${industryType} en la base de datos. Úsalo INMEDIATAMENTE después de saber la ciudad del cliente. Puedes usar query vacío ('') para explorar el catálogo general ANTES de ofrecer opciones de tu prompt.`,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Búsqueda libre (ej. 'pollo', 'grande'). Usa string vacío '' SIEMPRE al inicio para escanear qué productos están realmente disponibles antes de hablar." },
              categoryName: { type: "string", description: "El nombre exacto de la categoría que el cliente eligió (de la lista de tu contexto). Usa string vacío '' si no eligió ninguna." },
              occasionTag: { type: "string", description: "Una ocasión exacta (ej. 'Regalo'). Usa string vacío '' si no hay ocasión." },
              minPrice: { type: "number", description: "Precio mínimo del presupuesto. SOLO usar si el cliente proporcionó números explícitos. NO ASUMAS CANTIDADES." },
              maxPrice: { type: "number", description: "Precio máximo del presupuesto. SOLO usar si el cliente proporcionó números explícitos. NO ASUMAS CANTIDADES." },
              customerCity: { type: "string", description: "La ciudad que el cliente mencionó (ej. 'Cochabamba'). OBLIGATORIO para buscar precios correctos." }
            },
            required: ["customerCity"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generar_orden",
          description: "Cierra la venta y genera una orden de compra SOLO cuando hayas recolectado TODO: productos, cantidades, logística, pagos y facturación.",
          parameters: {
            type: "object",
            properties: {
              paymentType: { type: "string", enum: ["QR", "EFECTIVO", "TRANSFERENCIA"], description: "El método de pago elegido." },
              paymentTiming: { type: "string", enum: ["PAY_NOW", "PAY_LATER"], description: "Si pagará AHORA (PAY_NOW) o AL_RECIBIR/AL_RECOGER (PAY_LATER)." },
              deliveryType: { type: "string", enum: ["RECOJO", "ENVIO"], description: "El método de entrega elegido." },
              customerCity: { type: "string", description: "La ciudad acordada para la entrega/recojo (ej. 'La Paz'). OBLIGATORIO." },
              branchId: { type: "string", description: "Si es RECOJO, el ID exacto de la sucursal elegida de la lista del contexto. Si es ENVIO, pon 'N/A'." },
              shippingDate: { type: "string", description: "Fecha EXACTA de envío/recojo en formato YYYY-MM-DD." },
              shippingTimeRange: { type: "string", description: "Rango de hora de entrega (ej. 10am-12pm, Tarde, N/A)." },
              shippingAddress: { type: "string", description: "Dirección de envío exacta o URL de Google Maps (o 'Misma sucursal' si es recojo)." },
              shippingInstructions: { type: "string", description: "Recomendaciones o instrucciones de entrega (o 'Ninguna' si no hay)." },
              billingName: { type: "string", description: "Nombre completo del cliente para la factura." },
              billingNit: { type: "string", description: "NIT o documento del cliente (o 'S/N' si no proporcionó)." },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    productId: { type: "string", description: "El número de Opción (ej. '1') exacto que devolvió 'buscar_productos'. Si NUNCA usaste 'buscar_productos', escribe el NOMBRE EXACTO del producto (ej. 'Bowl Salteado Pollo')." },
                    quantity: { type: "number", description: "Cantidad a comprar" }
                  },
                  required: ["productId", "quantity"]
                }
              }
            },
            required: ["paymentType", "paymentTiming", "deliveryType", "customerCity", "branchId", "billingName", "items"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "actualizar_resumen_venta",
          description: "Guarda información crucial que el cliente haya proporcionado (ej. productos de interés, ciudad, dirección, NIT). LLAMA a esta función para no olvidar detalles importantes si la conversación se vuelve larga.",
          parameters: {
            type: "object",
            properties: {
              resumen: { type: "string", description: "Un breve texto estructurado con los datos confirmados del cliente hasta el momento." }
            },
            required: ["resumen"]
          }
        }
      }
    ];
  }

  async handleProductSearch(args: any, tenantObjectId: Types.ObjectId, conversation: any): Promise<string> {
    this.logger.log(`🔍 Buscando productos con query: "${args.query || ''}", occasion: "${args.occasionTag || ''}" para ciudad "${args.customerCity}"`);
    
    let filter: any = { tenantId: tenantObjectId, isActive: true };
    
    if (args.categoryName && args.categoryName.trim() !== '') {
      const categoryDb = await this.categoryModel.findOne({ 
        tenantId: tenantObjectId, 
        name: new RegExp('^' + args.categoryName.trim() + '$', 'i'),
        isActive: true
      });
      if (categoryDb) {
        filter.categoryId = categoryDb._id;
        this.logger.log(`🏷️ Filtrando por Categoría: ${categoryDb.name}`);
      } else {
        this.logger.warn(`⚠️ Categoría "${args.categoryName}" no encontrada.`);
      }
    }

    if (args.occasionTag && args.occasionTag.trim() !== '') {
      filter.occasions = new RegExp('^' + args.occasionTag + '$', 'i');
    }
    
    if (args.query && args.query.trim() !== '') {
      filter.$text = { $search: args.query };
    }

    let searchResults = [];

    if (filter.$text) {
      searchResults = await this.productModel.find(
        filter,
        { score: { $meta: "textScore" } }
      )
      .populate('prices.cityId')
      .sort({ score: { $meta: "textScore" } })
      .limit(50);
      
      if (searchResults.length === 0) {
        this.logger.warn(`⚠️ Búsqueda $text falló, intentando con Regex fallback...`);
        delete filter.$text;
        const regex = new RegExp(args.query.split(' ').join('|'), 'i');
        filter.$or = [ { name: regex }, { keywords: regex } ];
        searchResults = await this.productModel.find(filter).populate('prices.cityId').limit(50);
      }
    } else {
      // Búsqueda solo por ocasión
      searchResults = await this.productModel.find(filter).populate('prices.cityId').limit(50);
    }

    // Filtrado en memoria por Ciudad y Presupuesto
    const regexCity = new RegExp(args.customerCity, 'i');
    let validProducts = [];

    for (const p of searchResults) {
      let matchedPrice = null;
      if (p.prices && p.prices.length > 0) {
        const priceObj = p.prices.find((pr: any) => pr.cityId && pr.cityId.name && regexCity.test(pr.cityId.name));
        if (priceObj) {
          matchedPrice = priceObj.price;
        }
      }

      if (matchedPrice !== null) {
        let passMin = args.minPrice === undefined || args.minPrice === null || matchedPrice >= args.minPrice;
        let passMax = args.maxPrice === undefined || args.maxPrice === null || matchedPrice <= args.maxPrice;
        if (passMin && passMax) {
          validProducts.push({ ...p.toObject(), matchedPrice });
        }
      }
    }

    validProducts = validProducts.slice(0, 10);

    let resultText = "Resultados de la búsqueda (Catálogo interno):\n";
    if (validProducts.length > 0) {
      this.logger.debug(`✅ Encontrados ${validProducts.length} productos en la BD válidos para el filtro.`);

      conversation.lastSearchResults = validProducts.map(p => p._id);
      await conversation.save();

      validProducts.forEach((p: any, index: number) => {
        const optionId = (index + 1).toString();
        const weightInfo = p.weight ? ` (Peso: ${p.weight})` : '';
        resultText += `- [Opción: ${optionId}] ${p.name}${weightInfo}: $${p.matchedPrice}. ${p.description}\n`;
      });
    } else {
      this.logger.debug(`❌ No se encontraron productos.`);
      resultText = "No se encontraron productos exactos con ese término. Puedes sugerirle al cliente que intente otra palabra clave o pregúntale de otra forma.";
    }

    return resultText;
  }

  async handleUpdateSummary(args: any, conversation: any): Promise<string> {
    this.logger.log(`📝 Actualizando resumen de venta: ${args.resumen}`);
    conversation.summary = args.resumen;
    await conversation.save();
    return 'Resumen actualizado correctamente. Sigue respondiendo al cliente. NO VUELVAS A LLAMAR A ESTA HERRAMIENTA AHORA.';
  }

  async handleGenerateOrder(
    args: any,
    tenantObjectId: Types.ObjectId,
    tenant: any,
    branches: any[],
    customer: any,
    conversation: any,
    jid: string
  ): Promise<{ success: boolean; message: string }> {
    
    // Update Customer details if provided
    if (args.billingName || args.billingNit) {
      customer.fullName = args.billingName || customer.fullName;
      customer.nit = args.billingNit || customer.nit;
      if (args.deliveryType === 'ENVIO' && args.shippingAddress && args.shippingAddress !== 'Misma sucursal') {
        customer.address = args.shippingAddress;
      }
      await customer.save();
    }

    // Validaciones Antifraude
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ordersToday = await this.orderModel.countDocuments({
      customerId: customer._id,
      createdAt: { $gte: today }
    });
    const maxOrders = tenant.maxOrdersPerDay || 5;
    if (ordersToday >= maxOrders) {
      this.logger.warn(`Fraude o Límite: Cliente ${jid} alcanzó ${ordersToday} órdenes hoy.`);
      return { success: false, message: "Lo siento, has alcanzado el límite máximo de pedidos por hoy. Por favor, contáctanos directamente o intenta mañana." };
    }

    const paymentMap: Record<string, string> = { 'EFECTIVO': 'CASH', 'TRANSFERENCIA': 'TRANSFER', 'QR': 'QR' };
    const deliveryMap: Record<string, string> = { 'RECOJO': 'PICKUP', 'ENVIO': 'DELIVERY' };
    const timingMap: Record<string, string> = { 'PAY_NOW': 'PAY_NOW', 'PAY_LATER': 'PAY_LATER' };
    
    let totalAmount = 0;
    const orderItems = [];
    let isOrderValid = true;
    let validationErrorMsg = '';

    // Validación Temprana de Datos Completos
    if (!args.customerCity) {
      isOrderValid = false;
      validationErrorMsg = "Falta la ciudad del cliente. Por favor, pregúntale de qué ciudad es antes de generar la orden.";
    } else if (args.deliveryType === 'ENVIO' && (!args.shippingAddress || args.shippingAddress.trim() === '')) {
      isOrderValid = false;
      validationErrorMsg = "El cliente eligió ENVIO, pero falta la dirección exacta. Pídesela antes de generar la orden.";
    } else if (args.deliveryType === 'RECOJO' && (!args.branchId || args.branchId === 'N/A')) {
      isOrderValid = false;
      validationErrorMsg = "El cliente eligió RECOJO, pero falta especificar el ID de la sucursal. Ofrécele las opciones antes de generar la orden.";
    } else if (!args.items || args.items.length === 0) {
      isOrderValid = false;
      validationErrorMsg = "El carrito de compras está vacío.";
    }

    const MAX_ITEMS_PER_PRODUCT = tenant.maxItemsPerOrder || 20;
    
    // Consolidación de items y validación matemática de cantidades
    const consolidatedItemsMap = new Map<string, number>();
    if (isOrderValid) {
      for (const item of args.items) {
        let productId = item.productId;
        const quantity = item.quantity;
        
        if (!productId || quantity <= 0 || !Number.isInteger(quantity) || quantity > MAX_ITEMS_PER_PRODUCT) {
          isOrderValid = false;
          validationErrorMsg = `La cantidad o el ID para el producto indicado son inválidos. La cantidad debe ser un número entero mayor a 0.`;
          break;
        }

        productId = productId.replace(/[\[\]]/g, '').trim();

        let actualMongoId = productId;
        const optionIndex = parseInt(productId) - 1;
        if (!isNaN(optionIndex) && conversation.lastSearchResults && conversation.lastSearchResults[optionIndex]) {
          actualMongoId = conversation.lastSearchResults[optionIndex].toString();
        }

        const currentQty = consolidatedItemsMap.get(actualMongoId) || 0;
        consolidatedItemsMap.set(actualMongoId, currentQty + quantity);
      }
    }

    // Validación de Sucursal para Recojo
    let selectedBranchId = null;
    if (isOrderValid && args.deliveryType === 'RECOJO') {
      const matchedBranch = branches.find(b => b._id.toString() === args.branchId);
      if (!matchedBranch) {
        isOrderValid = false;
        validationErrorMsg = `No pude encontrar el ID de sucursal "${args.branchId}". Por favor, verifica el nombre y confírmame.`;
      } else {
        selectedBranchId = matchedBranch._id;
      }
    }

    // Validación de Productos y Precios del Servidor
    const regexCity = new RegExp(args.customerCity, 'i');

    if (isOrderValid) {
      for (const [productId, quantity] of consolidatedItemsMap.entries()) {
        if (quantity > MAX_ITEMS_PER_PRODUCT) {
          isOrderValid = false;
          validationErrorMsg = `La cantidad solicitada de un producto supera el límite de ${MAX_ITEMS_PER_PRODUCT} unidades por orden.`;
          break;
        }

        let productDb = null;
        try {
          if (Types.ObjectId.isValid(productId)) {
            productDb = await this.productModel.findOne({ 
              tenantId: tenantObjectId, 
              _id: new Types.ObjectId(productId)
            }).populate('prices.cityId');
          }
        } catch(e) {}

        if (!productDb) {
          // Fallback 1: Buscar por regex exacto o parcial
          let cleanName = productId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          productDb = await this.productModel.findOne({
            tenantId: tenantObjectId,
            name: new RegExp(cleanName, 'i')
          }).populate('prices.cityId');
        }

        if (!productDb) {
          // Fallback 2: Búsqueda $text (Fuzzy)
          const searchResults = await this.productModel.find(
            { tenantId: tenantObjectId, $text: { $search: productId }, isActive: true },
            { score: { $meta: "textScore" } }
          ).sort({ score: { $meta: "textScore" } }).limit(1).populate('prices.cityId');
          
          if (searchResults.length > 0) {
            productDb = searchResults[0];
          }
        }

        if (productDb) {
          let dbPrice = null;
          if (productDb.prices && productDb.prices.length > 0) {
            const priceObj = productDb.prices.find((pr: any) => pr.cityId && pr.cityId.name && regexCity.test(pr.cityId.name));
            if (priceObj) dbPrice = priceObj.price;
          }

          if (dbPrice !== null) {
            orderItems.push({
              productId: productDb._id,
              name: productDb.name,
              quantity: quantity,
              price: dbPrice
            });
            totalAmount += (quantity * dbPrice);
          } else {
            isOrderValid = false;
            validationErrorMsg = `El producto "${productDb.name}" no está disponible o no tiene precio para la ciudad de ${args.customerCity}.`;
            break;
          }
        } else {
          isOrderValid = false;
          validationErrorMsg = `Hubo un error con el producto ID: ${productId}. Parece que no existe en nuestro catálogo o el ID es incorrecto.`;
          break;
        }
      }
    }

    if (isOrderValid && orderItems.length > 0) {
      this.logger.log(`📦 Creando orden en BD con ${orderItems.length} items y total $${totalAmount} (Validada en DB)`);
      await this.orderModel.create({
        tenantId: tenantObjectId,
        branchId: selectedBranchId as any,
        customerId: customer._id,
        items: orderItems,
        totalAmount,
        paymentType: paymentMap[args.paymentType] || 'CASH',
        paymentTiming: timingMap[args.paymentTiming] || 'PAY_LATER',
        billingName: args.billingName,
        billingNit: args.billingNit,
        shippingInstructions: args.shippingInstructions,
        deliveryType: deliveryMap[args.deliveryType] || 'PICKUP',
        shippingDate: args.shippingDate,
        shippingTimeRange: args.shippingTimeRange,
        shippingAddress: args.shippingAddress,
        status: 'PENDING',
        isAiGenerated: true
      });
      this.logger.debug(`✅ Orden guardada exitosamente.`);

      if (paymentMap[args.paymentType] === 'QR' && timingMap[args.paymentTiming] === 'PAY_NOW') {
        setTimeout(() => {
          if (tenant.qrImageBase64) {
            this.whatsappService.sendImageFromBase64(tenantObjectId.toString(), jid, tenant.qrImageBase64, "Aquí tienes nuestro código QR oficial para realizar el pago. Por favor, envíanos el comprobante por este medio.");
          } else {
            this.whatsappService.sendMessage(tenantObjectId.toString(), jid, "Tu orden fue generada. En breve un administrador te enviará el código QR oficial para realizar el pago.");
          }
        }, 1500);
      }

      return { success: true, message: "¡Perfecto! He registrado tu orden de compra con éxito. Nuestro equipo se encargará del resto. ¡Muchas gracias por tu compra!" };
    } else {
      this.logger.warn(`⚠️ La orden fue rechazada por el servidor: ${validationErrorMsg}`);
      return { success: false, message: validationErrorMsg || "Parece que hubo un problema identificando los productos de nuestro catálogo o validando tu orden. Por favor, intentemos de nuevo." };
    }
  }
}
