'use strict';

const _ = require('lodash');

class AwsCompileFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = 'aws';

    this.hooks = {
      'deploy:compileFunctions': this.compileFunctions.bind(this),
    };
  }

  compileFunctions() {
    if (!this.serverless.service.resources.Resources) {
      throw new this.serverless.classes
        .Error('This plugin needs access to Resources section of the AWS CloudFormation template');
    }

    const functionTemplate = `
      {
        "Type": "AWS::Lambda::Function",
        "Properties": {
          "Code": {
            "S3Bucket": "S3Bucket",
            "S3Key": "S3Key"
          },
          "FunctionName": "FunctionName",
          "Handler": "Handler",
          "MemorySize": "MemorySize",
          "Role": "Role",
          "Runtime": "Runtime",
          "Timeout": "Timeout"
        }
      }
    `;

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const newFunction = JSON.parse(functionTemplate);
      const functionObject = this.serverless.service.getFunction(functionName);

      newFunction.Properties.Code
        .S3Bucket =
        `${this.serverless.service.service}-${this.options.stage}-${this.options.region}`;
      newFunction.Properties.Code
        .S3Key = ''; // will be replaced in a further step

      if (!functionObject.handler) {
        throw new this.serverless.classes
          .Error(`Missing "handler" property in function ${functionName}`);
      }

      // TODO validate the values of each of those properties
      const Handler = functionObject.handler;
      const FunctionName = functionObject.name
        || `${this.serverless.service.service}-${this.options.stage}-${functionName}`;
      const MemorySize = functionObject.memory
        || this.serverless.service.defaults.memory
        || 1024;
      const Timeout = functionObject.timeout
        || this.serverless.service.defaults.timeout
        || 6;

      newFunction.Properties.Handler = Handler;
      newFunction.Properties.FunctionName = FunctionName;
      newFunction.Properties.MemorySize = MemorySize;
      newFunction.Properties.Timeout = Timeout;
      newFunction.Properties.Runtime = 'nodejs4.3';
      newFunction.Properties.Role = { 'Fn::GetAtt': ['IamRoleLambda', 'Arn'] };

      const newFunctionObject = {
        [functionName]: newFunction,
      };

      _.merge(this.serverless.service.resources.Resources, newFunctionObject);
    });
  }
}

module.exports = AwsCompileFunctions;
