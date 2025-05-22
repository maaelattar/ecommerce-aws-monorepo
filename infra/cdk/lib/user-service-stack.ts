// infra/cdk/lib/user-service-stack.ts

import * as path from 'path';
import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import {
  RestApi,
  LambdaIntegration,
  AuthorizationType,
  Cors,
  CognitoUserPoolsAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';

export class UserServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userTable = new Table(this, 'UsersTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPool = new UserPool(this, 'UsersPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new UserPoolClient(this, 'UsersPoolClient', {
      userPool,
      generateSecret: false,
    });

    const repoRoot = path.resolve(__dirname, '../../..');
    const userServiceDir = path.join(repoRoot, 'apps', 'user-service');
    const entryFile = path.join(userServiceDir, 'src', 'main.ts');
    const tsconfigFile = path.join(userServiceDir, 'tsconfig.app.json');

    const userFn = new NodejsFunction(this, 'UserServiceFunction', {
      runtime: Runtime.NODEJS_18_X,
      entry: entryFile,
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
      handler: 'handler',
      bundling: {
        tsconfig: tsconfigFile,
        minify: true,
        sourceMap: true,
        // Add node_modules to external modules to reduce bundle size
        externalModules: ['@aws-sdk/*', '@nestjs/*'],
      },
      memorySize: 512,
      timeout: Duration.seconds(30),
      environment: {
        TABLE_NAME: userTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    userTable.grantReadWriteData(userFn);
    userPool.grant(userFn, 'cognito-idp:AdminCreateUser');

    const api = new RestApi(this, 'UserServiceApi', {
      restApiName: 'User Service',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'CognitoAuth', {
      cognitoUserPools: [userPool],
    });

    const users = api.root.addResource('users');
    users.addMethod('POST', new LambdaIntegration(userFn), {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });
    users.addMethod('GET', new LambdaIntegration(userFn), {
      authorizer,
      authorizationType: AuthorizationType.COGNITO,
    });
  }
}
