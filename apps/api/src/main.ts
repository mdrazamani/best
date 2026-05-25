import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const isProduction = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const corsOriginOption = isProduction ? (corsOrigins.length ? corsOrigins : false) : (corsOrigins.length ? corsOrigins : true);

  await app.register(cors, {
    origin: corsOriginOption,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type']
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request: any, reply: any, done: any) => {
    const requestId = request.headers['x-request-id']?.toString() || randomUUID();
    request.requestId = requestId;
    reply.header('x-request-id', requestId);
    done();
  });

  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('BEST API')
    .setDescription('BEST Api Documentaion')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      'bearer'
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  fastify.get('/', async () => ({
    success: true,
    data: {
      service: 'BEST API',
      version: '1.0.0',
      docs: '/docs',
      basePath: '/v1'
    }
  }));

  fastify.get('/health', async () => ({
    success: true,
    data: {
      status: 'ok'
    }
  }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
