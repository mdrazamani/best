import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { UsersModule } from './modules/users/users.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollaboratorsModule } from './modules/collaborators/collaborators.module';
import { CustomersModule } from './modules/customers/customers.module';
import { MeshTypesModule } from './modules/mesh-types/mesh-types.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { BackupsModule } from './modules/backups/backups.module';
import { OperationLogsModule } from './modules/operation-logs/operation-logs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BootstrapService } from './bootstrap.service';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    CollaboratorsModule,
    CustomersModule,
    MeshTypesModule,
    OrdersModule,
    InvoicesModule,
    BackupsModule,
    OperationLogsModule,
    ReportsModule
  ],
  providers: [BootstrapService, AuthGuard, PermissionsGuard]
})
export class AppModule {}
