'use strict';

const fs = require('fs');
const request = require('supertest');
const path = require('path');
const sinon = require('sinon');
const test = require('ava');
const {
  buildS3Uri,
  createBucket,
  fileExists,
  recursivelyDeleteS3Bucket
} = require('@cumulus/aws-client/S3');
const {
  s3,
  secretsManager,
  sfn
} = require('@cumulus/aws-client/services');
const cmrjs = require('@cumulus/cmrjs');
const { CMR } = require('@cumulus/cmr-client');
const {
  metadataObjectFromCMRFile
} = require('@cumulus/cmrjs/cmr-utils');
const launchpad = require('@cumulus/common/launchpad');
const { randomString, randomId } = require('@cumulus/common/test-utils');

const assertions = require('../../lib/assertions');
const models = require('../../models');
const bootstrap = require('../../lambdas/bootstrap');
const indexer = require('../../es/indexer');
const {
  fakeAccessTokenFactory,
  fakeCollectionFactory,
  fakeGranuleFactoryV2,
  createFakeJwtAuthToken,
  setAuthorizedOAuthUsers
} = require('../../lib/testUtils');
const {
  createJwtToken
} = require('../../lib/token');
const { Search } = require('../../es/search');

process.env.AccessTokensTable = randomId('token');
process.env.CollectionsTable = randomId('collection');
process.env.GranulesTable = randomId('granules');
process.env.stackName = randomId('stackname');
process.env.system_bucket = randomId('systembucket');
process.env.TOKEN_SECRET = randomId('secret');

// import the express app after setting the env variables
const { app } = require('../../app');

function createBuckets(buckets) {
  return Promise.all(buckets.map(createBucket));
}

function deleteBuckets(buckets) {
  return Promise.all(buckets.map(recursivelyDeleteS3Bucket));
}

const putObject = (params) => s3().putObject(params).promise();

async function runTestUsingBuckets(buckets, testFunction) {
  try {
    await createBuckets(buckets);
    await testFunction();
  } finally {
    await Promise.all(buckets.map(recursivelyDeleteS3Bucket));
  }
}

/**
 * Helper for creating and uploading bucket configuration for 'move' tests.
 * @returns {Object} with keys of internalBucket, and publicBucket.
 */
async function setupBucketsConfig() {
  const systemBucket = process.env.system_bucket;
  const buckets = {
    protected: {
      name: systemBucket,
      type: 'protected'
    },
    public: {
      name: randomId('public'),
      type: 'public'
    }
  };

  process.env.DISTRIBUTION_ENDPOINT = 'http://example.com/';
  await putObject({
    Bucket: systemBucket,
    Key: `${process.env.stackName}/workflows/buckets.json`,
    Body: JSON.stringify(buckets)
  });
  await createBucket(buckets.public.name);
  return { internalBucket: systemBucket, publicBucket: buckets.public.name };
}

// create all the variables needed across this test
let esClient;
let esIndex;
let accessTokenModel;
let granuleModel;
let collectionModel;
let accessToken;

test.before(async (t) => {
  esIndex = randomId('esindex');
  t.context.esAlias = randomId('esAlias');
  process.env.ES_INDEX = t.context.esAlias;

  // create esClient
  esClient = await Search.es('fakehost');

  // add fake elasticsearch index
  await bootstrap.bootstrapElasticSearch('fakehost', esIndex, t.context.esAlias);

  // create a fake bucket
  await createBucket(process.env.system_bucket);

  // create a workflow template file
  const tKey = `${process.env.stackName}/workflow_template.json`;
  await putObject({ Bucket: process.env.system_bucket, Key: tKey, Body: '{}' });

  // create fake Collections table
  collectionModel = new models.Collection();
  await collectionModel.createTable();

  // create fake Granules table
  granuleModel = new models.Granule();
  await granuleModel.createTable();

  const username = randomString();
  await setAuthorizedOAuthUsers([username]);

  accessTokenModel = new models.AccessToken();
  await accessTokenModel.createTable();

  accessToken = await createFakeJwtAuthToken({ accessTokenModel, username });

  // Store the CMR password
  process.env.cmr_password_secret_name = randomString();
  await secretsManager().createSecret({
    Name: process.env.cmr_password_secret_name,
    SecretString: randomString()
  }).promise();

  // Store the Launchpad passphrase
  process.env.launchpad_passphrase_secret_name = randomString();
  await secretsManager().createSecret({
    Name: process.env.launchpad_passphrase_secret_name,
    SecretString: randomString()
  }).promise();
});

test.beforeEach(async (t) => {
  const { esAlias } = t.context;

  t.context.testCollection = fakeCollectionFactory({
    name: 'fakeCollection',
    version: 'v1',
    duplicateHandling: 'error'
  });
  await collectionModel.create(t.context.testCollection);

  // create fake granule records
  t.context.fakeGranules = [
    fakeGranuleFactoryV2({ status: 'completed' }),
    fakeGranuleFactoryV2({ status: 'failed' })
  ];

  await Promise.all(t.context.fakeGranules.map((granule) =>
    granuleModel.create(granule)
      .then((record) => indexer.indexGranule(esClient, record, esAlias))));
});

test.after.always(async () => {
  await collectionModel.deleteTable();
  await granuleModel.deleteTable();
  await accessTokenModel.deleteTable();
  await esClient.indices.delete({ index: esIndex });
  await recursivelyDeleteS3Bucket(process.env.system_bucket);
  await secretsManager().deleteSecret({
    SecretId: process.env.cmr_password_secret_name,
    ForceDeleteWithoutRecovery: true
  }).promise();
  await secretsManager().deleteSecret({
    SecretId: process.env.launchpad_passphrase_secret_name,
    ForceDeleteWithoutRecovery: true
  }).promise();
});

test.serial('default returns list of granules', async (t) => {
  const response = await request(app)
    .get('/granules')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const { meta, results } = response.body;
  t.is(results.length, 2);
  t.is(meta.stack, process.env.stackName);
  t.is(meta.table, 'granule');
  t.is(meta.count, 2);
  const granuleIds = t.context.fakeGranules.map((i) => i.granuleId);
  results.forEach((r) => {
    t.true(granuleIds.includes(r.granuleId));
  });
});

test.serial('CUMULUS-911 GET without pathParameters and without an Authorization header returns an Authorization Missing response', async (t) => {
  const response = await request(app)
    .get('/granules')
    .set('Accept', 'application/json')
    .expect(401);

  assertions.isAuthorizationMissingResponse(t, response);
});

test.serial('CUMULUS-911 GET with pathParameters.granuleName set and without an Authorization header returns an Authorization Missing response', async (t) => {
  const response = await request(app)
    .get('/granules/asdf')
    .set('Accept', 'application/json')
    .expect(401);

  assertions.isAuthorizationMissingResponse(t, response);
});

test.serial('CUMULUS-911 PUT with pathParameters.granuleName set and without an Authorization header returns an Authorization Missing response', async (t) => {
  const response = await request(app)
    .put('/granules/asdf')
    .set('Accept', 'application/json')
    .expect(401);

  assertions.isAuthorizationMissingResponse(t, response);
});

test.serial('CUMULUS-911 DELETE with pathParameters.granuleName set and without an Authorization header returns an Authorization Missing response', async (t) => {
  const response = await request(app)
    .delete('/granules/asdf')
    .set('Accept', 'application/json')
    .expect(401);

  assertions.isAuthorizationMissingResponse(t, response);
});

test.serial('CUMULUS-912 GET without pathParameters and with an invalid access token returns an unauthorized response', async (t) => {
  const response = await request(app)
    .get('/granules/asdf')
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ThisIsAnInvalidAuthorizationToken')
    .expect(403);

  assertions.isInvalidAccessTokenResponse(t, response);
});

test.serial('CUMULUS-912 GET without pathParameters and with an unauthorized user returns an unauthorized response', async (t) => {
  const accessTokenRecord = fakeAccessTokenFactory();
  await accessTokenModel.create(accessTokenRecord);
  const jwtToken = createJwtToken(accessTokenRecord);

  const response = await request(app)
    .get('/granules')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${jwtToken}`)
    .expect(401);

  assertions.isUnauthorizedUserResponse(t, response);
});

test.serial('CUMULUS-912 GET with pathParameters.granuleName set and with an invalid access token returns an unauthorized response', async (t) => {
  const response = await request(app)
    .get('/granules/asdf')
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ThisIsAnInvalidAuthorizationToken')
    .expect(403);

  assertions.isInvalidAccessTokenResponse(t, response);
});

test.todo('CUMULUS-912 GET with pathParameters.granuleName set and with an unauthorized user returns an unauthorized response');

test.serial('CUMULUS-912 PUT with pathParameters.granuleName set and with an invalid access token returns an unauthorized response', async (t) => {
  const response = await request(app)
    .put('/granules/asdf')
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ThisIsAnInvalidAuthorizationToken')
    .expect(403);

  assertions.isInvalidAccessTokenResponse(t, response);
});

test.todo('CUMULUS-912 PUT with pathParameters.granuleName set and with an unauthorized user returns an unauthorized response');

test.serial('CUMULUS-912 DELETE with pathParameters.granuleName set and with an unauthorized user returns an unauthorized response', async (t) => {
  const accessTokenRecord = fakeAccessTokenFactory();
  await accessTokenModel.create(accessTokenRecord);
  const jwtToken = createJwtToken(accessTokenRecord);

  const response = await request(app)
    .delete('/granules/adsf')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${jwtToken}`)
    .expect(401);

  assertions.isUnauthorizedUserResponse(t, response);
});

test.serial('GET returns an existing granule', async (t) => {
  const response = await request(app)
    .get(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const { granuleId } = response.body;
  t.is(granuleId, t.context.fakeGranules[0].granuleId);
});

test.serial('GET returns a 404 response if the granule is not found', async (t) => {
  const response = await request(app)
    .get('/granules/unknownGranule')
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(404);

  t.is(response.status, 404);
  const { message } = response.body;
  t.is(message, 'Granule not found');
});

test.serial('PUT fails if action is not supported', async (t) => {
  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ action: 'someUnsupportedAction' })
    .expect(400);

  t.is(response.status, 400);
  const { message } = response.body;
  t.true(message.includes('Action is not supported'));
});

test.serial('PUT fails if action is not provided', async (t) => {
  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(400);

  t.is(response.status, 400);
  const { message } = response.body;
  t.is(message, 'Action is missing');
});

// This needs to be serial because it is stubbing aws.sfn's responses
test.serial('reingest a granule', async (t) => {
  const fakeDescribeExecutionResult = {
    input: JSON.stringify({
      meta: {
        workflow_name: 'IngestGranule'
      },
      payload: {}
    })
  };

  // fake workflow
  const message = JSON.parse(fakeDescribeExecutionResult.input);
  const wKey = `${process.env.stackName}/workflows/${message.meta.workflow_name}.json`;
  await putObject({ Bucket: process.env.system_bucket, Key: wKey, Body: '{}' });

  const stub = sinon.stub(sfn(), 'describeExecution').returns({
    promise: () => Promise.resolve(fakeDescribeExecutionResult)
  });

  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ action: 'reingest' })
    .expect(200);

  const body = response.body;
  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'reingest');
  t.true(body.warning.includes('overwritten'));

  const updatedGranule = await granuleModel.get({ granuleId: t.context.fakeGranules[0].granuleId });
  t.is(updatedGranule.status, 'running');
  stub.restore();
});

// This needs to be serial because it is stubbing aws.sfn's responses
test.serial('apply an in-place workflow to an existing granule', async (t) => {
  const fakeSFResponse = {
    execution: {
      input: JSON.stringify({
        meta: {
          workflow_name: 'inPlaceWorkflow'
        },
        payload: {}
      })
    }
  };

  //fake in-place workflow
  const message = JSON.parse(fakeSFResponse.execution.input);
  const wKey = `${process.env.stackName}/workflows/${message.meta.workflow_name}.json`;
  await putObject({ Bucket: process.env.system_bucket, Key: wKey, Body: '{}' });

  const fakeDescribeExecutionResult = {
    output: JSON.stringify({
      meta: {
        workflow_name: 'IngestGranule'
      },
      payload: {}
    })
  };

  const stub = sinon.stub(sfn(), 'describeExecution').returns({
    promise: () => Promise.resolve(fakeDescribeExecutionResult)
  });

  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      action: 'applyWorkflow',
      workflow: 'inPlaceWorkflow',
      messageSource: 'output'
    })
    .expect(200);

  const body = response.body;
  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'applyWorkflow inPlaceWorkflow');

  const updatedGranule = await granuleModel.get({ granuleId: t.context.fakeGranules[0].granuleId });
  t.is(updatedGranule.status, 'running');
  stub.restore();
});

test.serial('remove a granule from CMR', async (t) => {
  sinon.stub(
    CMR.prototype,
    'deleteGranule'
  ).callsFake(() => Promise.resolve());

  sinon.stub(
    cmrjs,
    'getMetadata'
  ).callsFake(() => Promise.resolve({ title: t.context.fakeGranules[0].granuleId }));

  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ action: 'removeFromCmr' })
    .expect(200);

  const body = response.body;
  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'removeFromCmr');

  const updatedGranule = await granuleModel.get({ granuleId: t.context.fakeGranules[0].granuleId });
  t.is(updatedGranule.published, false);
  t.is(updatedGranule.cmrLink, undefined);

  CMR.prototype.deleteGranule.restore();
  cmrjs.getMetadata.restore();
});

test.serial('remove a granule from CMR with launchpad authentication', async (t) => {
  process.env.cmr_oauth_provider = 'launchpad';
  const launchpadStub = sinon.stub(launchpad, 'getLaunchpadToken').callsFake(() => randomString());

  sinon.stub(
    CMR.prototype,
    'deleteGranule'
  ).callsFake(() => Promise.resolve());

  sinon.stub(
    cmrjs,
    'getMetadata'
  ).callsFake(() => Promise.resolve({ title: t.context.fakeGranules[0].granuleId }));

  const response = await request(app)
    .put(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ action: 'removeFromCmr' })
    .expect(200);

  const body = response.body;
  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'removeFromCmr');

  const updatedGranule = await granuleModel.get({ granuleId: t.context.fakeGranules[0].granuleId });
  t.is(updatedGranule.published, false);
  t.is(updatedGranule.cmrLink, undefined);

  t.is(launchpadStub.calledOnce, true);

  process.env.cmr_oauth_provider = 'earthdata';
  launchpadStub.restore();
  CMR.prototype.deleteGranule.restore();
  cmrjs.getMetadata.restore();
});

test.serial('DELETE deleting an existing granule that is published will fail', async (t) => {
  const response = await request(app)
    .delete(`/granules/${t.context.fakeGranules[0].granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(400);

  t.is(response.status, 400);
  const { message } = response.body;
  t.is(
    message,
    'You cannot delete a granule that is published to CMR. Remove it from CMR first'
  );
});

test('DELETE deleting an existing unpublished granule', async (t) => {
  const buckets = {
    protected: {
      name: randomId('protected'),
      type: 'protected'
    },
    public: {
      name: randomId('public'),
      type: 'public'
    }
  };
  const newGranule = fakeGranuleFactoryV2({ status: 'failed' });
  newGranule.published = false;
  newGranule.files = [
    {
      bucket: buckets.protected.name,
      fileName: `${newGranule.granuleId}.hdf`,
      key: `${randomString(5)}/${newGranule.granuleId}.hdf`
    },
    {
      bucket: buckets.protected.name,
      fileName: `${newGranule.granuleId}.cmr.xml`,
      key: `${randomString(5)}/${newGranule.granuleId}.cmr.xml`
    },
    {
      bucket: buckets.public.name,
      fileName: `${newGranule.granuleId}.jpg`,
      key: `${randomString(5)}/${newGranule.granuleId}.jpg`
    }
  ];

  await createBuckets([
    buckets.protected.name,
    buckets.public.name
  ]);

  for (let i = 0; i < newGranule.files.length; i += 1) {
    const file = newGranule.files[i];
    await putObject({ // eslint-disable-line no-await-in-loop
      Bucket: file.bucket,
      Key: file.key,
      Body: `test data ${randomString()}`
    });
  }

  // create a new unpublished granule
  await granuleModel.create(newGranule);

  const response = await request(app)
    .delete(`/granules/${newGranule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  t.is(response.status, 200);
  const { detail } = response.body;
  t.is(detail, 'Record deleted');

  // verify the files are deleted
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < newGranule.files.length; i += 1) {
    const file = newGranule.files[i];
    t.false(await fileExists(file.bucket, file.key));
  }
  /* eslint-enable no-await-in-loop */

  await deleteBuckets([
    buckets.protected.name,
    buckets.public.name
  ]);
});

test('DELETE for a granule with a file not present in S3 succeeds', async (t) => {
  const newGranule = fakeGranuleFactoryV2({ status: 'failed' });
  newGranule.published = false;
  newGranule.files = [
    {
      bucket: process.env.system_bucket,
      fileName: `${newGranule.granuleId}.hdf`,
      key: randomString()
    }
  ];

  // create a new unpublished granule
  await granuleModel.create(newGranule);

  const response = await request(app)
    .delete(`/granules/${newGranule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`);

  t.is(response.status, 200);
});

test.serial('move a granule with no .cmr.xml file', async (t) => {
  const bucket = process.env.system_bucket;
  const secondBucket = randomId('second');
  const thirdBucket = randomId('third');

  await runTestUsingBuckets(
    [secondBucket, thirdBucket],
    async () => {
      const newGranule = fakeGranuleFactoryV2();

      newGranule.files = [
        {
          bucket,
          fileName: `${newGranule.granuleId}.txt`,
          key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.txt`
        },
        {
          bucket,
          fileName: `${newGranule.granuleId}.md`,
          key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.md`
        },
        {
          bucket: secondBucket,
          fileName: `${newGranule.granuleId}.jpg`,
          key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.jpg`
        }
      ];

      await granuleModel.create(newGranule);

      await Promise.all(
        newGranule.files.map(
          (file) =>
            putObject({
              Bucket: file.bucket,
              Key: file.key,
              Body: 'test data'
            })
        )
      );

      const destinationFilepath = `${process.env.stackName}/granules_moved`;
      const destinations = [
        {
          regex: '.*.txt$',
          bucket,
          filepath: destinationFilepath
        },
        {
          regex: '.*.md$',
          bucket: thirdBucket,
          filepath: destinationFilepath
        },
        {
          regex: '.*.jpg$',
          bucket,
          filepath: destinationFilepath
        }
      ];

      const response = await request(app)
        .put(`/granules/${newGranule.granuleId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          action: 'move',
          destinations
        })
        .expect(200);

      const body = response.body;
      t.is(body.status, 'SUCCESS');
      t.is(body.action, 'move');

      const bucketObjects = await s3().listObjects({
        Bucket: bucket,
        Prefix: destinationFilepath
      }).promise();

      t.is(bucketObjects.Contents.length, 2);
      bucketObjects.Contents.forEach((item) => {
        t.is(item.Key.indexOf(destinationFilepath), 0);
      });


      const thirdBucketObjects = await s3().listObjects({
        Bucket: thirdBucket,
        Prefix: destinationFilepath
      }).promise();

      t.is(thirdBucketObjects.Contents.length, 1);
      thirdBucketObjects.Contents.forEach((item) => {
        t.is(item.Key.indexOf(destinationFilepath), 0);
      });


      // check the granule in table is updated
      const updatedGranule = await granuleModel.get({ granuleId: newGranule.granuleId });
      updatedGranule.files.forEach((file) => {
        t.true(file.key.startsWith(destinationFilepath));
        const destination = destinations.find((dest) => file.fileName.match(dest.regex));
        t.is(destination.bucket, file.bucket);
        t.is(file.bucket, destination.bucket);
      });
    }
  );
});

test.serial('move a file and update ECHO10 xml metadata', async (t) => {
  const { internalBucket, publicBucket } = await setupBucketsConfig();
  const newGranule = fakeGranuleFactoryV2();

  newGranule.files = [
    {
      bucket: internalBucket,
      fileName: `${newGranule.granuleId}.txt`,
      key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.txt`
    },
    {
      bucket: publicBucket,
      fileName: `${newGranule.granuleId}.cmr.xml`,
      key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.cmr.xml`
    }
  ];

  await granuleModel.create(newGranule);

  await putObject({
    Bucket: newGranule.files[0].bucket,
    Key: newGranule.files[0].key,
    Body: 'test data'
  });

  await putObject({
    Bucket: newGranule.files[1].bucket,
    Key: newGranule.files[1].key,
    Body: fs.createReadStream(path.resolve(__dirname, '../data/meta.xml'))
  });

  const originalXML = await metadataObjectFromCMRFile(
    buildS3Uri(newGranule.files[1].bucket, newGranule.files[1].key)
  );

  const destinationFilepath = `${process.env.stackName}/moved_granules`;
  const destinations = [
    {
      regex: '.*.txt$',
      bucket: internalBucket,
      filepath: destinationFilepath
    }
  ];

  sinon.stub(
    CMR.prototype,
    'ingestGranule'
  ).returns({ result: { 'concept-id': 'id204842' } });

  const response = await request(app)
    .put(`/granules/${newGranule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      action: 'move',
      destinations
    })
    .expect(200);

  const body = response.body;

  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'move');

  const list = await s3().listObjects({
    Bucket: internalBucket,
    Prefix: destinationFilepath
  }).promise();
  t.is(list.Contents.length, 1);
  t.is(list.Contents[0].Key.indexOf(destinationFilepath), 0);

  const list2 = await s3().listObjects({
    Bucket: publicBucket,
    Prefix: `${process.env.stackName}/original_filepath`
  }).promise();
  t.is(list2.Contents.length, 1);
  t.is(newGranule.files[1].key, list2.Contents[0].Key);

  const xmlObject = await metadataObjectFromCMRFile(
    buildS3Uri(newGranule.files[1].bucket, newGranule.files[1].key)
  );

  const newUrls = xmlObject.Granule.OnlineAccessURLs.OnlineAccessURL.map((obj) => obj.URL);
  const newDestination = `${process.env.DISTRIBUTION_ENDPOINT}${destinations[0].bucket}/${destinations[0].filepath}/${newGranule.files[0].fileName}`;
  t.true(newUrls.includes(newDestination));

  // All original URLs are unchanged (because they weren't involved in the granule move)
  const originalURLObjects = originalXML.Granule.OnlineAccessURLs.OnlineAccessURL;
  const originalURLs = originalURLObjects.map((urlObj) => urlObj.URL);
  originalURLs.forEach((originalURL) => {
    t.true(newUrls.includes(originalURL));
  });

  CMR.prototype.ingestGranule.restore();
  await recursivelyDeleteS3Bucket(publicBucket);
});

test.serial('move a file and update its UMM-G JSON metadata', async (t) => {
  const { internalBucket, publicBucket } = await setupBucketsConfig();

  const newGranule = fakeGranuleFactoryV2();
  const ummgMetadataString = fs.readFileSync(path.resolve(__dirname, '../data/ummg-meta.json'));
  const originalUMMG = JSON.parse(ummgMetadataString);

  newGranule.files = [
    {
      bucket: internalBucket,
      fileName: `${newGranule.granuleId}.txt`,
      key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.txt`
    },
    {
      bucket: publicBucket,
      fileName: `${newGranule.granuleId}.cmr.json`,
      key: `${process.env.stackName}/original_filepath/${newGranule.granuleId}.cmr.json`
    }
  ];

  await granuleModel.create(newGranule);

  await Promise.all(newGranule.files.map((file) => {
    if (file.name === `${newGranule.granuleId}.txt`) {
      return putObject({ Bucket: file.bucket, Key: file.key, Body: 'test data' });
    }
    return putObject({ Bucket: file.bucket, Key: file.key, Body: ummgMetadataString });
  }));

  const destinationFilepath = `${process.env.stackName}/moved_granules/${randomString()}`;
  const destinations = [
    {
      regex: '.*.txt$',
      bucket: internalBucket,
      filepath: destinationFilepath
    }
  ];

  sinon.stub(
    CMR.prototype,
    'ingestUMMGranule'
  ).returns({ result: { 'concept-id': 'id204842' } });

  const response = await request(app)
    .put(`/granules/${newGranule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      action: 'move',
      destinations
    })
    .expect(200);

  const body = response.body;

  t.is(body.status, 'SUCCESS');
  t.is(body.action, 'move');

  // text file has moved to correct location
  const list = await s3().listObjects({
    Bucket: internalBucket,
    Prefix: destinationFilepath
  }).promise();
  t.is(list.Contents.length, 1);
  t.is(list.Contents[0].Key.indexOf(destinationFilepath), 0);

  // CMR JSON  is in same location.
  const list2 = await s3().listObjects({
    Bucket: publicBucket,
    Prefix: `${process.env.stackName}/original_filepath`
  }).promise();
  t.is(list2.Contents.length, 1);
  t.is(newGranule.files[1].key, list2.Contents[0].Key);

  // CMR UMMG JSON has been updated with the location of the moved file.
  const ummgObject = await metadataObjectFromCMRFile(
    buildS3Uri(newGranule.files[1].bucket, newGranule.files[1].key)
  );
  const updatedURLs = ummgObject.RelatedUrls.map((urlObj) => urlObj.URL);
  const newDestination = `${process.env.DISTRIBUTION_ENDPOINT}${destinations[0].bucket}/${destinations[0].filepath}/${newGranule.files[0].fileName}`;
  t.true(updatedURLs.includes(newDestination));

  // Original metadata is also unchanged.
  const origURLs = originalUMMG.RelatedUrls.map((urlObj) => urlObj.URL);
  origURLs.forEach((origURL) => {
    t.true(updatedURLs.includes(origURL));
  });

  CMR.prototype.ingestUMMGranule.restore();
  await recursivelyDeleteS3Bucket(publicBucket);
});

test.serial('PUT with action move returns failure if one granule file exists', async (t) => {
  const filesExistingStub = sinon.stub(models.Granule.prototype, 'getFilesExistingAtLocation').returns([{ fileName: 'file1' }]);
  const moveGranuleStub = sinon.stub(models.Granule.prototype, 'move').resolves({});

  const granule = t.context.fakeGranules[0];

  await granuleModel.create(granule);

  const body = {
    action: 'move',
    destinations: [{
      regex: '.*.hdf$',
      bucket: 'fake-bucket',
      filepath: 'fake-destination'
    }]
  };

  const response = await request(app)
    .put(`/granules/${granule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body)
    .expect(409);


  const responseBody = response.body;
  t.is(response.status, 409);
  t.is(responseBody.message,
    'Cannot move granule because the following files would be overwritten at the destination location: file1. Delete the existing files or reingest the source files.');

  filesExistingStub.restore();
  moveGranuleStub.restore();
});

test('PUT with action move returns failure if more than one granule file exists', async (t) => {
  const filesExistingStub = sinon.stub(models.Granule.prototype, 'getFilesExistingAtLocation').returns([
    { fileName: 'file1' },
    { fileName: 'file2' },
    { fileName: 'file3' }
  ]);
  const moveGranuleStub = sinon.stub(models.Granule.prototype, 'move').resolves({});

  const granule = t.context.fakeGranules[0];

  await granuleModel.create(granule);

  const body = {
    action: 'move',
    destinations: [{
      regex: '.*.hdf$',
      bucket: 'fake-bucket',
      filepath: 'fake-destination'
    }]
  };

  const response = await request(app)
    .put(`/granules/${granule.granuleId}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body)
    .expect(409);

  const responseBody = response.body;
  t.is(response.statusCode, 409);
  t.is(responseBody.message,
    'Cannot move granule because the following files would be overwritten at the destination location: file1, file2, file3. Delete the existing files or reingest the source files.');

  filesExistingStub.restore();
  moveGranuleStub.restore();
});
