import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamoDBModule } from '@piavart/nestjs-dynamodb';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './user-service/src/app/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../infra/local/.env'],
      isGlobal: true,
    }),
    DynamoDBModule.forRoot({
      AWSConfig: {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      dynamoDBOptions: {
        endpoint: process.env.DYNAMO_ENDPOINT,
      },
    }),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
