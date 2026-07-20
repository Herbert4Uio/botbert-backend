import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './modules/tenant/tenant.module';
import { BranchModule } from './modules/branch/branch.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomerModule } from './modules/customer/customer.module';
import { OrderModule } from './modules/order/order.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { SalesModule } from './modules/sales/sales.module';
import { CityModule } from './modules/city/city.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/whatbot',
      }),
      inject: [ConfigService],
    }),
    TenantModule,
    BranchModule,
    UserModule,
    CatalogModule,
    CustomerModule,
    OrderModule,
    WhatsappModule,
    AiModule,
    AuthModule,
    SalesModule,
    CityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
