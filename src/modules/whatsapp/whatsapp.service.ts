import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import * as qrcode from 'qrcode-terminal';
import { BaileysAuth } from './schemas/baileys-auth.schema';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService implements OnModuleInit {
  public sockets: Map<string, ReturnType<typeof makeWASocket>> = new Map();
  public qrCodes: Map<string, string> = new Map(); // tenantId -> qr

  public onMessageCallback: (
    tenantId: string,
    message: any,
    jid: string,
  ) => void = () => {};

  constructor(
    @InjectModel(BaileysAuth.name) private authModel: Model<BaileysAuth>,
    private whatsappGateway: WhatsappGateway,
  ) {}

  onModuleInit() {
    console.log('WhatsappService inicializado.');
  }

  public registerMessageHandler(
    callback: (tenantId: string, message: any, jid: string) => void,
  ) {
    this.onMessageCallback = callback;
  }

  public async sendImage(
    tenantId: string,
    jid: string,
    imagePath: string,
    caption?: string,
  ) {
    const sock = this.sockets.get(tenantId);
    if (!sock) {
      console.error(`Socket no encontrado para el tenant: ${tenantId}`);
      return;
    }
    await sock.sendMessage(jid, { image: { url: imagePath }, caption });
  }

  public async sendImageFromBase64(
    tenantId: string,
    jid: string,
    base64: string,
    caption?: string,
  ) {
    const sock = this.sockets.get(tenantId);
    if (!sock) {
      console.error(`Socket no encontrado para el tenant: ${tenantId}`);
      return;
    }
    const base64Data = base64.split(',')[1];
    if (!base64Data) return;
    const buffer = Buffer.from(base64Data, 'base64');
    await sock.sendMessage(jid, { image: buffer, caption });
  }

  public async sendMessage(tenantId: string, jid: string, text: string) {
    const sock = this.sockets.get(tenantId);
    if (!sock) {
      console.error(`Socket no encontrado para el tenant: ${tenantId}`);
      return;
    }
    await sock.sendMessage(jid, { text });
  }

  public async getStatus(tenantId: string) {
    if (this.sockets.has(tenantId)) {
      return { status: 'CONNECTED', qr: null };
    }
    if (this.qrCodes.has(tenantId)) {
      return { status: 'QR_READY', qr: this.qrCodes.get(tenantId) };
    }
    return { status: 'DISCONNECTED', qr: null };
  }

  public async disconnectSession(tenantId: string) {
    const sock = this.sockets.get(tenantId);
    if (sock) {
      sock.logout();
      this.sockets.delete(tenantId);
    }
    this.qrCodes.delete(tenantId);

    // Limpiar auth data de DB
    await this.authModel.deleteMany({ tenantId: new Types.ObjectId(tenantId) });
    this.whatsappGateway.emitConnectionStatus(tenantId, 'DISCONNECTED');
  }

  public async startSession(tenantId: string, phoneNumber?: string) {
    if (this.sockets.has(tenantId)) {
      return this.sockets.get(tenantId);
    }

    console.log(
      `Iniciando sesión de WhatsApp para la empresa: ${tenantId}${phoneNumber ? ` (Pairing: ${phoneNumber})` : ' (QR)'}`,
    );

    const { state, saveCreds } = await this.useMongoDBAuthState(tenantId);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      //logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    if (phoneNumber) {
      sock.requestPairingCode(phoneNumber)
        .then((code) => {
          this.whatsappGateway.emitPairingCode(tenantId, code);
          this.whatsappGateway.emitConnectionStatus(tenantId, 'QR_READY');
        })
        .catch((err) => {
          console.error(`Error al solicitar pairing code para empresa ${tenantId}:`, err);
          this.whatsappGateway.emitConnectionStatus(tenantId, 'DISCONNECTED');
        });
    }

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (phoneNumber) {
        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !==
            DisconnectReason.loggedOut;
          console.log('Conexión cerrada (pairing). Reconectando:', shouldReconnect);
          this.sockets.delete(tenantId);
          this.qrCodes.delete(tenantId);
          if (shouldReconnect) {
            setTimeout(() => this.startSession(tenantId, phoneNumber), 5000);
          } else {
            this.authModel
              .deleteMany({ tenantId: new Types.ObjectId(tenantId) })
              .exec();
            this.whatsappGateway.emitConnectionStatus(tenantId, 'DISCONNECTED');
          }
        } else if (connection === 'open') {
          console.log(`¡Conexión de WhatsApp abierta (pairing) para empresa ${tenantId}!`);
          this.sockets.set(tenantId, sock);
          this.qrCodes.delete(tenantId);
          this.whatsappGateway.emitConnectionStatus(tenantId, 'CONNECTED');
        }
        return;
      }

      if (qr) {
        this.qrCodes.set(tenantId, qr);
        this.whatsappGateway.emitQrCode(tenantId, qr);
        this.whatsappGateway.emitConnectionStatus(tenantId, 'QR_READY');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as any)?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log('Conexión cerrada. Reconectando:', shouldReconnect);
        this.sockets.delete(tenantId);
        this.qrCodes.delete(tenantId);

        if (shouldReconnect) {
          setTimeout(() => this.startSession(tenantId), 5000);
        } else {
          this.authModel
            .deleteMany({ tenantId: new Types.ObjectId(tenantId) })
            .exec();
          this.whatsappGateway.emitConnectionStatus(tenantId, 'DISCONNECTED');
        }
      } else if (connection === 'open') {
        console.log(
          `¡Conexión de WhatsApp abierta y lista para empresa ${tenantId}!`,
        );
        this.sockets.set(tenantId, sock);
        this.qrCodes.delete(tenantId);
        this.whatsappGateway.emitConnectionStatus(tenantId, 'CONNECTED');
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const jid = msg.key.remoteJid;
            if (jid && !jid.includes('@g.us')) {
              this.onMessageCallback(tenantId, msg, jid);
            }
          }
        }
      }
    });

    return sock;
  }

  private async useMongoDBAuthState(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);

    const readData = async (type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      const data = await this.authModel.findOne({
        tenantId: tenantObjectId,
        sessionId: parsedId,
      });
      if (data) {
        return JSON.parse(JSON.stringify(data.authData), BufferJSON.reviver);
      }
      return null;
    };

    const writeData = async (data: any, type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      const dataToSave = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
      await this.authModel.updateOne(
        { tenantId: tenantObjectId, sessionId: parsedId },
        { $set: { authData: dataToSave } },
        { upsert: true },
      );
    };

    const removeData = async (type: string, id: string) => {
      const parsedId = `${type}-${id}`;
      await this.authModel.deleteOne({
        tenantId: tenantObjectId,
        sessionId: parsedId,
      });
    };

    const creds = (await readData('creds', 'default')) || initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const data: { [key: string]: any } = {};
            await Promise.all(
              ids.map(async (id) => {
                const value = await readData(type, id);
                data[id] = value;
              }),
            );
            return data;
          },
          set: async (data: any) => {
            const tasks: Promise<any>[] = [];
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const type = category;
                if (value) {
                  tasks.push(writeData(value, type, id));
                } else {
                  tasks.push(removeData(type, id));
                }
              }
            }
            await Promise.all(tasks);
          },
        },
      },
      saveCreds: () => writeData(creds, 'creds', 'default'),
    };
  }
}
