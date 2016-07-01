'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const AwsInvoke = require('../');
const Serverless = require('../../../../Serverless');
const BbPromise = require('bluebird');

describe('AwsInvoke', () => {
  const serverless = new Serverless();
  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first',
  };
  const awsInvoke = new AwsInvoke(serverless, options);

  describe('#constructor()', () => {
    it('should have hooks', () => expect(awsInvoke.hooks).to.be.not.empty);

    it('should set the provider variable to "aws"', () => expect(awsInvoke.provider)
      .to.equal('aws'));

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(awsInvoke, 'validate').returns(BbPromise.resolve());
      const invokeStub = sinon
        .stub(awsInvoke, 'invoke').returns(BbPromise.resolve());
      const logStub = sinon
        .stub(awsInvoke, 'log').returns(BbPromise.resolve());

      return awsInvoke.hooks['invoke:invoke']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
        expect(invokeStub.calledAfter(validateStub)).to.be.equal(true);
        expect(logStub.calledAfter(invokeStub)).to.be.equal(true);

        awsInvoke.validate.restore();
        awsInvoke.invoke.restore();
        awsInvoke.log.restore();
      });
    });
  });

  describe('#validate()', () => {
    beforeEach(() => {
      serverless.config.servicePath = true;
      serverless.service.environment = {
        vars: {},
        stages: {
          dev: {
            vars: {},
            regions: {
              'us-east-1': {
                vars: {},
              },
            },
          },
        },
      };
      serverless.service.functions = {
        first: {
          handler: true,
        },
      };
    });

    it('it should parse file if file path is provided', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      const data = {
        testProp: 'testValue',
      };
      serverless.utils.writeFileSync(path
        .join(serverless.config.servicePath, 'data.json'), JSON.stringify(data));
      awsInvoke.options.path = 'data.json';

      return awsInvoke.validate().then(() => {
        expect(awsInvoke.options.data).to.deep.equal(data);
        awsInvoke.options.path = false;
        serverless.config.servicePath = true;
      });
    });

    it('it should throw error if service path is not set', () => {
      serverless.config.servicePath = false;
      expect(() => awsInvoke.validate()).to.throw(Error);
      serverless.config.servicePath = true;
    });

    it('it should throw error if file path does not exist', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      awsInvoke.options.path = 'some/path';

      expect(() => awsInvoke.validate()).to.throw(Error);

      awsInvoke.options.path = false;
      serverless.config.servicePath = true;
    });
  });

  describe('#invoke()', () => {
    let invokeStub;
    beforeEach(() => {
      invokeStub = sinon.stub(awsInvoke.sdk, 'request').
        returns(BbPromise.resolve());
      awsInvoke.serverless.service.service = 'new-service';
      awsInvoke.options = {
        stage: 'dev',
        function: 'first',
      };
    });

    it('should invoke with correct params', () => awsInvoke.invoke()
      .then(() => {
        expect(invokeStub.calledOnce).to.be.equal(true);
        expect(invokeStub.calledWith(awsInvoke.options.stage, awsInvoke.options.region));
        expect(invokeStub.args[0][2].FunctionName).to.be.equal('new-service-dev-first');
        expect(invokeStub.args[0][2].InvocationType).to.be.equal('RequestResponse');
        expect(invokeStub.args[0][2].LogType).to.be.equal('None');
        expect(typeof invokeStub.args[0][2].Payload).to.not.be.equal('undefined');
        awsInvoke.sdk.request.restore();
      })
    );

    it('should invoke and log', () => {
      awsInvoke.options.log = true;

      return awsInvoke.invoke().then(() => {
        expect(invokeStub.calledOnce).to.be.equal(true);
        expect(invokeStub.calledWith(awsInvoke.options.stage, awsInvoke.options.region));
        expect(invokeStub.args[0][2].FunctionName).to.be.equal('new-service-dev-first');
        expect(invokeStub.args[0][2].InvocationType).to.be.equal('RequestResponse');
        expect(invokeStub.args[0][2].LogType).to.be.equal('Tail');
        expect(typeof invokeStub.args[0][2].Payload).to.not.be.equal('undefined');
        awsInvoke.sdk.request.restore();
      });
    });

    it('should invoke with other invocation type', () => {
      awsInvoke.options.type = 'OtherType';

      return awsInvoke.invoke().then(() => {
        expect(invokeStub.calledOnce).to.be.equal(true);
        expect(invokeStub.calledWith(awsInvoke.options.stage, awsInvoke.options.region));
        expect(invokeStub.args[0][2].FunctionName).to.be.equal('new-service-dev-first');
        expect(invokeStub.args[0][2].InvocationType).to.be.equal('OtherType');
        expect(invokeStub.args[0][2].LogType).to.be.equal('None');
        expect(typeof invokeStub.args[0][2].Payload).to.not.be.equal('undefined');
        awsInvoke.sdk.request.restore();
      });
    });
  });

  describe('#log()', () => {
    it('should log payload', () => {
      const invocationReplyMock = {
        Payload: `
        {
         "testProp": "testValue"
        }
        `,
        LogResult: 'test',
      };

      return awsInvoke.log(invocationReplyMock);
    });
  });
});
