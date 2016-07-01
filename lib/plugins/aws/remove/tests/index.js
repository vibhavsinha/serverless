'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const AwsRemove = require('../');
const Serverless = require('../../../../Serverless');

describe('AwsRemove', () => {
  const serverless = new Serverless();
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  const awsRemove = new AwsRemove(serverless, options);
  awsRemove.serverless.cli = new serverless.classes.CLI();

  describe('#constructor()', () => {
    it('should have hooks', () => expect(awsRemove.hooks).to.be.not.empty);

    it('should set the provider variable to "aws"', () => expect(awsRemove.provider)
      .to.equal('aws'));

    it('should have access to the serverless instance', () => {
      expect(awsRemove.serverless).to.deep.equal(serverless);
    });

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(awsRemove, 'validate').returns(BbPromise.resolve());
      const emptyS3BucketStub = sinon
        .stub(awsRemove, 'emptyS3Bucket').returns(BbPromise.resolve());
      const removeStackStub = sinon
        .stub(awsRemove, 'removeStack').returns(BbPromise.resolve());

      return awsRemove.hooks['remove:remove']()
        .then(() => {
          expect(validateStub.calledOnce).to.be.equal(true);
          expect(emptyS3BucketStub.calledAfter(validateStub)).to.be.equal(true);
          expect(removeStackStub.calledAfter(emptyS3BucketStub)).to.be.equal(true);

          awsRemove.validate.restore();
          awsRemove.emptyS3Bucket.restore();
          awsRemove.removeStack.restore();
        });
    });
  });
});
