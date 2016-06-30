'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  compileMethods() {
    _.forEach(this.serverless.service.functions, (functionObject, functionName) => {
      functionObject.events.forEach(event => {
        if (event.http) {
          let method;
          let path;

          if (typeof event.http === 'object') {
            method = event.http.method;
            path = event.http.path;
          } else if (typeof event.http === 'string') {
            method = event.http.split(' ')[0];
            path = event.http.split(' ')[1];
          } else {
            const errorMessage = [
              `HTTP event of function ${functionName} is not an object nor a string.`,
              ` The correct syntax is: http: get users/list OR an object with "path" and "method" proeprties.`,
              ` Please check the docs for more info.`
            ].join('');
            throw new this.serverless.classes
              .Error(errorMessage);
          }

          const resourceLogicalId = this.resourceLogicalIds[path];
          const normalizedMethod = method[0].toUpperCase() +
            method.substr(1).toLowerCase();

          const extractedResourceId = resourceLogicalId.match(/\d+$/)[0];
          const serviceName = this.serverless.service.service;
          const awsAccountNumber = this.serverless.service
            .getVariables(this.options.stage, this.options.region).iamRoleArnLambda
            .match(/(.*):(.*):(.*):(.*):(.*):role\/.*/)[5];

          const lambdaUri = `arn:aws:apigateway:${
            this.options.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${
            this.options.region}:${awsAccountNumber}:function:${
            serviceName}-${this.options.stage}-${functionName}/invocations`;

          // universal velocity template
          // provides `{body, method, headers, query, path, identity, stageVariables} = event`
          // as js objects
          const DEFAULT_JSON_REQUEST_TEMPLATE = `
            #define( $loop )
              {
              #foreach($key in $map.keySet())
                  "$util.escapeJavaScript($key)":
                    "$util.escapeJavaScript($map.get($key))"
                    #if( $foreach.hasNext ) , #end
              #end
              }
            #end
            {
              "body": $input.json("$"),
              "method": "$context.httpMethod",
              
              #set( $map = $input.params().header )
              "headers": $loop,
  
              #set( $map = $input.params().querystring )
              "query": $loop,
  
              #set( $map = $input.params().path )
              "path": $loop,
  
              #set( $map = $context.identity )
              "identity": $loop,
  
              #set( $map = $stageVariables )
              "stageVariables": $loop
            }
          `;

          const methodTemplate = `
            {
              "Type" : "AWS::ApiGateway::Method",
              "Properties" : {
                "AuthorizationType" : "NONE",
                "HttpMethod" : "${method.toUpperCase()}",
                "MethodResponses" : [
                  {
                    "ResponseModels" : {},
                    "ResponseParameters" : {},
                    "StatusCode" : "200"
                  }
                ],
                "RequestParameters" : {},
                "Integration" : {
                  "IntegrationHttpMethod" : "POST",
                  "Type" : "AWS",
                  "Uri" : "${lambdaUri}",
                  "RequestTemplates" : {
                    "application/json" : ${JSON.stringify(DEFAULT_JSON_REQUEST_TEMPLATE)}
                  },
                  "IntegrationResponses" : [
                    {
                      "StatusCode" : "200",
                      "ResponseParameters" : {},
                      "ResponseTemplates" : {
                        "application/json": ""
                      }
                    }
                  ]
                },
                "ResourceId" : { "Ref": "${resourceLogicalId}" },
                "RestApiId" : { "Ref": "RestApiApigEvent" }
              }
            }
          `;

          const methodObject = {
            [`${normalizedMethod}MethodApigEvent${extractedResourceId}`]:
              JSON.parse(methodTemplate),
          };

          _.merge(this.serverless.service.resources.Resources,
            methodObject);

          // store a method logical id in memory to be used
          // by Deployment resources "DependsOn" property
          if (!this.methodDep) {
            this.methodDep = `${normalizedMethod}MethodApigEvent${extractedResourceId}`;
          }
        }
      });
    });
    return BbPromise.resolve();
  },
};
