'use strict';

const fs = require('fs-extra');
const isNumber = require('lodash.isnumber');
const isString = require('lodash.isstring');
const isObject = require('lodash.isobject');
const path = require('path');
const { URL, resolve } = require('url');
const difference = require('lodash.difference');
const includes = require('lodash.includes');
const intersection = require('lodash.intersection');

const {
  AccessToken,
  Execution,
  Granule,
  Pdr,
  Provider
} = require('@cumulus/api/models');
const {
  deleteS3Object,
  parseS3Uri,
  s3CopyObject,
  s3GetObjectTagging,
  s3ObjectExists
} = require('@cumulus/aws-client/S3');
const { s3 } = require('@cumulus/aws-client/services');
const { generateChecksumFromStream } = require('@cumulus/checksum');
const { constructCollectionId } = require('@cumulus/common/collection-config-store');
const { LambdaStep } = require('@cumulus/integration-tests/sfnStep');
const { getUrl } = require('@cumulus/cmrjs');
const {
  addCollections,
  api: apiTestUtils,
  executionsApi: executionsApiTestUtils,
  buildAndExecuteWorkflow,
  buildAndStartWorkflow,
  conceptExists,
  getOnlineResources,
  granulesApi: granulesApiTestUtils,
  waitForConceptExistsOutcome,
  waitForTestExecutionStart,
  waitForCompletedExecution,
  EarthdataLogin: { getEarthdataAccessToken },
  distributionApi: {
    getDistributionApiRedirect,
    getDistributionApiFileStream,
    getDistributionFileUrl
  }
} = require('@cumulus/integration-tests');
const { deleteCollection } = require('@cumulus/integration-tests/api/collections');

const {
  loadConfig,
  templateFile,
  uploadTestDataToBucket,
  deleteFolder,
  getExecutionUrl,
  createTimestampedTestId,
  createTestDataPath,
  createTestSuffix,
  getFilesMetadata
} = require('../../helpers/testUtils');
const {
  setDistributionApiEnvVars,
  waitForModelStatus
} = require('../../helpers/apiUtils');
const {
  addUniqueGranuleFilePathToGranuleFiles,
  addUrlPathToGranuleFiles,
  setupTestGranuleForIngest,
  loadFileWithUpdatedGranuleIdPathAndCollection
} = require('../../helpers/granuleUtils');

const { isReingestExecutionForGranuleId } = require('../../helpers/workflowUtils');

const { getConfigObject } = require('../../helpers/configUtils');

const lambdaStep = new LambdaStep();
const workflowName = 'IngestAndPublishGranule';

const workflowConfigFile = './workflows/sips.yml';

const granuleRegex = '^MOD09GQ\\.A[\\d]{7}\\.[\\w]{6}\\.006\\.[\\d]{13}$';

const s3data = [
  '@cumulus/test-data/granules/MOD09GQ.A2016358.h13v04.006.2016360104606.hdf.met',
  '@cumulus/test-data/granules/MOD09GQ.A2016358.h13v04.006.2016360104606.hdf',
  '@cumulus/test-data/granules/MOD09GQ.A2016358.h13v04.006.2016360104606_ndvi.jpg'
];

function isExecutionForGranuleId(taskInput, params) {
  return taskInput.payload.granules && taskInput.payload.granules[0].granuleId === params.granuleId;
}

describe('The S3 Ingest Granules workflow', () => {
  const inputPayloadFilename = './spec/parallel/ingestGranule/IngestGranule.input.payload.json';
  const providersDir = './data/providers/s3/';
  const collectionsDir = './data/collections/s3_MOD09GQ_006';
  const collectionDupeHandling = 'error';

  let accessTokensModel;
  let collection;
  let config;
  let executionModel;
  let expectedPayload;
  let expectedS3TagSet;
  let expectedSyncGranulePayload;
  let granuleModel;
  let inputPayload;
  let pdrModel;
  let postToCmrOutput;
  let provider;
  let providerModel;
  let testDataFolder;
  let workflowExecutionArn;
  let failingWorkflowExecution;
  let granuleCompletedMessageKey;
  let granuleRunningMessageKey;

  beforeAll(async () => {
    config = await loadConfig();

    const testId = createTimestampedTestId(config.stackName, 'IngestGranuleSuccess');
    const testSuffix = createTestSuffix(testId);
    testDataFolder = createTestDataPath(testId);

    collection = { name: `MOD09GQ${testSuffix}`, version: '006' };
    const newCollectionId = constructCollectionId(collection.name, collection.version);
    provider = { id: `s3_provider${testSuffix}` };

    process.env.AccessTokensTable = `${config.stackName}-AccessTokensTable`;
    accessTokensModel = new AccessToken();
    process.env.GranulesTable = `${config.stackName}-GranulesTable`;
    granuleModel = new Granule();
    process.env.ExecutionsTable = `${config.stackName}-ExecutionsTable`;
    executionModel = new Execution();
    process.env.system_bucket = config.bucket;
    process.env.ProvidersTable = `${config.stackName}-ProvidersTable`;
    providerModel = new Provider();
    process.env.PdrsTable = `${config.stackName}-PdrsTable`;
    pdrModel = new Pdr();

    const providerJson = JSON.parse(fs.readFileSync(`${providersDir}/s3_provider.json`, 'utf8'));
    const providerData = {
      ...providerJson,
      id: provider.id,
      host: config.bucket
    };

    // populate collections, providers and test data
    await Promise.all([
      uploadTestDataToBucket(config.bucket, s3data, testDataFolder),
      addCollections(config.stackName, config.bucket, collectionsDir, testSuffix, testId, collectionDupeHandling),
      apiTestUtils.addProviderApi({ prefix: config.stackName, provider: providerData })
    ]);
    const inputPayloadJson = fs.readFileSync(inputPayloadFilename, 'utf8');
    // update test data filepaths
    inputPayload = await setupTestGranuleForIngest(config.bucket, inputPayloadJson, granuleRegex, testSuffix, testDataFolder);
    const granuleId = inputPayload.granules[0].granuleId;
    expectedS3TagSet = [{ Key: 'granuleId', Value: granuleId }];
    await Promise.all(inputPayload.granules[0].files.map((fileToTag) =>
      s3().putObjectTagging({ Bucket: config.bucket, Key: `${fileToTag.path}/${fileToTag.name}`, Tagging: { TagSet: expectedS3TagSet } }).promise()));

    const collectionUrlString = '{cmrMetadata.Granule.Collection.ShortName}___{cmrMetadata.Granule.Collection.VersionId}/{substring(file.name, 0, 3)}/';

    const templatedSyncGranuleFilename = templateFile({
      inputTemplateFilename: './spec/parallel/ingestGranule/SyncGranule.output.payload.template.json',
      config: {
        granules: [
          {
            files: [
              {
                bucket: config.buckets.internal.name,
                filename: `s3://${config.buckets.internal.name}/file-staging/${config.stackName}/replace-me-collectionId/replace-me-granuleId.hdf`,
                fileStagingDir: `file-staging/${config.stackName}/replace-me-collectionId`
              },
              {
                bucket: config.buckets.internal.name,
                filename: `s3://${config.buckets.internal.name}/file-staging/${config.stackName}/replace-me-collectionId/replace-me-granuleId.hdf.met`,
                fileStagingDir: `file-staging/${config.stackName}/replace-me-collectionId`
              },
              {
                bucket: config.buckets.internal.name,
                filename: `s3://${config.buckets.internal.name}/file-staging/${config.stackName}/replace-me-collectionId/replace-me-granuleId_ndvi.jpg`,
                fileStagingDir: `file-staging/${config.stackName}/replace-me-collectionId`
              }
            ]
          }
        ]
      }
    });

    expectedSyncGranulePayload = loadFileWithUpdatedGranuleIdPathAndCollection(templatedSyncGranuleFilename, granuleId, testDataFolder, newCollectionId, config.stackName);

    expectedSyncGranulePayload.granules[0].dataType += testSuffix;
    expectedSyncGranulePayload.granules[0].files = addUrlPathToGranuleFiles(expectedSyncGranulePayload.granules[0].files, testId, '');

    const templatedOutputPayloadFilename = templateFile({
      inputTemplateFilename: './spec/parallel/ingestGranule/IngestGranule.output.payload.template.json',
      config: {
        granules: [
          {
            files: [
              {
                bucket: config.buckets.protected.name,
                filename: `s3://${config.buckets.protected.name}/MOD09GQ___006/2017/MOD/replace-me-granuleId.hdf`
              },
              {
                bucket: config.buckets.private.name,
                filename: `s3://${config.buckets.private.name}/MOD09GQ___006/MOD/replace-me-granuleId.hdf.met`
              },
              {
                bucket: config.buckets.public.name,
                filename: `s3://${config.buckets.public.name}/MOD09GQ___006/MOD/replace-me-granuleId_ndvi.jpg`
              },
              {
                bucket: config.buckets['protected-2'].name,
                filename: `s3://${config.buckets['protected-2'].name}/MOD09GQ___006/MOD/replace-me-granuleId.cmr.xml`
              }
            ]
          }
        ]
      }
    });

    expectedPayload = loadFileWithUpdatedGranuleIdPathAndCollection(templatedOutputPayloadFilename, granuleId, testDataFolder, newCollectionId);
    expectedPayload.granules[0].dataType += testSuffix;
    expectedPayload.granules = addUniqueGranuleFilePathToGranuleFiles(expectedPayload.granules, testId);
    expectedPayload.granules[0].files = addUrlPathToGranuleFiles(expectedPayload.granules[0].files, testId, collectionUrlString);
    // process.env.DISTRIBUTION_ENDPOINT needs to be set for below
    setDistributionApiEnvVars();

    console.log('Start SuccessExecution');
    workflowExecutionArn = await buildAndStartWorkflow(
      config.stackName,
      config.bucket,
      workflowName,
      collection,
      provider,
      inputPayload,
      {
        distribution_endpoint: process.env.DISTRIBUTION_ENDPOINT
      }
    );
  });

  afterAll(async () => {
    // clean up stack state added by test
    await Promise.all([
      deleteFolder(config.bucket, testDataFolder),
      deleteCollection(config.stackName, collection.name, collection.version),
      providerModel.delete(provider),
      executionModel.delete({ arn: workflowExecutionArn }),
      granulesApiTestUtils.removePublishedGranule({
        prefix: config.stackName,
        granuleId: inputPayload.granules[0].granuleId
      }),
      pdrModel.delete({
        pdrName: inputPayload.pdr.name
      }),
      deleteS3Object(config.bucket, granuleCompletedMessageKey),
      deleteS3Object(config.bucket, granuleRunningMessageKey)
    ]);
  });

  it('triggers a running execution record being added to DynamoDB', async () => {
    const record = await waitForModelStatus(
      executionModel,
      { arn: workflowExecutionArn },
      'running'
    );
    expect(record.status).toEqual('running');
  });

  it('triggers a running PDR record being added to DynamoDB', async () => {
    const record = await waitForModelStatus(
      pdrModel,
      { pdrName: inputPayload.pdr.name },
      'running'
    );
    expect(record.status).toEqual('running');
  });

  it('makes the granule available through the Cumulus API', async () => {
    await waitForModelStatus(
      granuleModel,
      { granuleId: inputPayload.granules[0].granuleId },
      'running'
    );

    const granuleResponse = await granulesApiTestUtils.getGranule({
      prefix: config.stackName,
      granuleId: inputPayload.granules[0].granuleId
    });
    const granule = JSON.parse(granuleResponse.body);

    expect(granule.granuleId).toEqual(inputPayload.granules[0].granuleId);
    expect(granule.status).toEqual('running');
  });

  it('completes execution with success status', async () => {
    const workflowExecutionStatus = await waitForCompletedExecution(workflowExecutionArn);
    expect(workflowExecutionStatus).toEqual('SUCCEEDED');
  });

  it('can retrieve the specific provider that was created', async () => {
    const providerListResponse = await apiTestUtils.getProviders({ prefix: config.stackName });
    const providerList = JSON.parse(providerListResponse.body);
    expect(providerList.results.length).toBeGreaterThan(0);

    const providerResultResponse = await apiTestUtils.getProvider({ prefix: config.stackName, providerId: provider.id });
    const providerResult = JSON.parse(providerResultResponse.body);
    expect(providerResult).not.toBeNull();
  });

  it('can retrieve the specific collection that was created', async () => {
    const collectionListResponse = await apiTestUtils.getCollections({ prefix: config.stackName });
    const collectionList = JSON.parse(collectionListResponse.body);
    expect(collectionList.results.length).toBeGreaterThan(0);

    const collectionResponse = await apiTestUtils.getCollection(
      { prefix: config.stackName, collectionName: collection.name, collectionVersion: collection.version }
    );
    const collectionResult = JSON.parse(collectionResponse.body);
    expect(collectionResult).not.toBeNull();
  });

  describe('the SyncGranules task', () => {
    let lambdaInput;
    let lambdaOutput;

    beforeAll(async () => {
      lambdaInput = await lambdaStep.getStepInput(workflowExecutionArn, 'SyncGranule');
      lambdaOutput = await lambdaStep.getStepOutput(workflowExecutionArn, 'SyncGranule');
    });

    it('receives the correct collection and provider configuration', () => {
      expect(lambdaInput.meta.collection.name).toEqual(collection.name);
      expect(lambdaInput.meta.provider.id).toEqual(provider.id);
    });

    it('output includes the ingested granule with file staging location paths', () => {
      const updatedGranule = {
        ...expectedSyncGranulePayload.granules[0],
        sync_granule_duration: lambdaOutput.meta.input_granules[0].sync_granule_duration
      };

      const updatedPayload = {
        ...expectedSyncGranulePayload,
        granules: [updatedGranule]
      };
      expect(lambdaOutput.payload).toEqual(updatedPayload);
    });

    it('updates the meta object with input_granules', () => {
      const updatedGranule = {
        ...expectedSyncGranulePayload.granules[0],
        sync_granule_duration: lambdaOutput.meta.input_granules[0].sync_granule_duration
      };
      expect(lambdaOutput.meta.input_granules).toEqual([updatedGranule]);
    });
  });

  describe('the MoveGranules task', () => {
    let lambdaOutput;
    let files;
    let movedTaggings;
    let existCheck = [];

    beforeAll(async () => {
      lambdaOutput = await lambdaStep.getStepOutput(workflowExecutionArn, 'MoveGranules');
      files = lambdaOutput.payload.granules[0].files;
      movedTaggings = await Promise.all(lambdaOutput.payload.granules[0].files.map((file) => {
        const { Bucket, Key } = parseS3Uri(file.filename);
        return s3GetObjectTagging(Bucket, Key);
      }));

      existCheck = await Promise.all([
        s3ObjectExists({ Bucket: files[0].bucket, Key: files[0].filepath }),
        s3ObjectExists({ Bucket: files[1].bucket, Key: files[1].filepath }),
        s3ObjectExists({ Bucket: files[2].bucket, Key: files[2].filepath })
      ]);
    });

    it('has a payload with correct buckets, filenames, sizes', () => {
      files.forEach((file) => {
        const expectedFile = expectedPayload.granules[0].files.find((f) => f.name === file.name);
        expect(file.filename).toEqual(expectedFile.filename);
        expect(file.bucket).toEqual(expectedFile.bucket);
        if (file.size) {
          expect(file.size).toEqual(expectedFile.size);
        }
      });
    });

    it('moves files to the bucket folder based on metadata', () => {
      existCheck.forEach((check) => {
        expect(check).toEqual(true);
      });
    });

    it('preserves tags on moved files', () => {
      movedTaggings.forEach((tagging) => {
        expect(tagging.TagSet).toEqual(expectedS3TagSet);
      });
    });
  });

  describe('the PostToCmr task', () => {
    let cmrResource;
    let ummCmrResource;
    let files;
    let granule;
    let resourceURLs;
    let accessToken;
    let beforeAllError;

    beforeAll(async () => {
      process.env.CMR_ENVIRONMENT = 'UAT';
      postToCmrOutput = await lambdaStep.getStepOutput(workflowExecutionArn, 'PostToCmr');

      if (postToCmrOutput === null) {
        beforeAllError = new Error(`Failed to get the PostToCmr step's output for ${workflowExecutionArn}`);
        return;
      }

      try {
        granule = postToCmrOutput.payload.granules[0];
        files = granule.files;

        const ummGranule = { ...granule, cmrMetadataFormat: 'umm_json_v5' };
        const result = await Promise.all([
          getOnlineResources(granule),
          getOnlineResources(ummGranule),
          // Login with Earthdata and get access token.
          getEarthdataAccessToken({
            redirectUri: process.env.DISTRIBUTION_REDIRECT_ENDPOINT,
            requestOrigin: process.env.DISTRIBUTION_ENDPOINT
          })
        ]);

        cmrResource = result[0];
        ummCmrResource = result[1];
        resourceURLs = cmrResource.map((resource) => resource.href);
        accessToken = result[2].accessToken;
      } catch (e) {
        beforeAllError = e;
      }
    });

    beforeEach(() => {
      if (beforeAllError) fail(beforeAllError);
    });

    afterAll(async () => {
      await accessTokensModel.delete({ accessToken });
    });

    it('has expected payload', () => {
      expect(granule.cmrLink).toEqual(`${getUrl('search', null, 'UAT')}granules.json?concept_id=${granule.cmrConceptId}`);
      const updatedGranule = expectedPayload.granules[0];
      const thisExpectedPayload = {
        ...expectedPayload,
        granules: [
          {
            ...updatedGranule,
            cmrConceptId: postToCmrOutput.payload.granules[0].cmrConceptId,
            cmrLink: postToCmrOutput.payload.granules[0].cmrLink,
            post_to_cmr_duration: postToCmrOutput.payload.granules[0].post_to_cmr_duration,
            sync_granule_duration: postToCmrOutput.payload.granules[0].sync_granule_duration
          }
        ]
      };
      expect(postToCmrOutput.payload).toEqual(thisExpectedPayload);
    });

    it('publishes the granule metadata to CMR', () => {
      const result = conceptExists(granule.cmrLink);

      expect(granule.published).toEqual(true);
      expect(result).not.toEqual(false);
    });

    it('updates the CMR metadata online resources with the final metadata location', () => {
      const scienceFileUrl = getDistributionFileUrl({ bucket: files[0].bucket, key: files[0].filepath });
      const s3BrowseImageUrl = getDistributionFileUrl({ bucket: files[2].bucket, key: files[2].filepath });
      const s3CredsUrl = resolve(process.env.DISTRIBUTION_ENDPOINT, 's3credentials');

      console.log('parallel resourceURLs: ', resourceURLs);
      console.log('s3CredsUrl: ', s3CredsUrl);

      expect(resourceURLs.includes(scienceFileUrl)).toBe(true);
      expect(resourceURLs.includes(s3BrowseImageUrl)).toBe(true);
      expect(resourceURLs.includes(s3CredsUrl)).toBe(true);
    });

    it('updates the CMR metadata "online resources" with the proper types and urls', () => {
      const resource = ummCmrResource;
      const distributionUrl = getDistributionFileUrl({
        bucket: files[0].bucket,
        key: files[0].filepath
      });
      const s3BrowseImageUrl = getDistributionFileUrl({ bucket: files[2].bucket, key: files[2].filepath });
      const s3CredsUrl = resolve(process.env.DISTRIBUTION_ENDPOINT, 's3credentials');
      const expectedTypes = [
        'GET DATA',
        'VIEW RELATED INFORMATION',
        'VIEW RELATED INFORMATION',
        'GET RELATED VISUALIZATION'
      ];
      const cmrUrls = resource.map((r) => r.URL);

      expect(cmrUrls.includes(distributionUrl)).toBe(true);
      expect(cmrUrls.includes(s3BrowseImageUrl)).toBe(true);
      expect(cmrUrls.includes(s3CredsUrl)).toBe(true);
      expect(expectedTypes).toEqual(resource.map((r) => r.Type));
    });

    // TODO Re-enable when CUMULUS-1458 has been completed
    xit('includes the Earthdata login ID for requests to protected science files', async () => {
      const filepath = `/${files[0].bucket}/${files[0].filepath}`;
      const s3SignedUrl = await getDistributionApiRedirect(filepath, accessToken);
      const earthdataLoginParam = new URL(s3SignedUrl).searchParams.get('x-EarthdataLoginUsername');
      expect(earthdataLoginParam).toEqual(process.env.EARTHDATA_USERNAME);
    });

    // TODO Re-enable when CUMULUS-1458 has been completed
    xit('downloads the requested science file for authorized requests', async () => {
      const scienceFileUrls = resourceURLs
        .filter((url) =>
          (url.startsWith(process.env.DISTRIBUTION_ENDPOINT) ||
          url.match(/s3\.amazonaws\.com/)) &&
          !url.endsWith('.cmr.xml') &&
          !url.includes('s3credentials'));

      const checkFiles = await Promise.all(
        scienceFileUrls
          .map(async (url) => {
            const extension = path.extname(new URL(url).pathname);
            const sourceFile = s3data.find((d) => d.endsWith(extension));
            const sourceChecksum = await generateChecksumFromStream(
              'cksum',
              fs.createReadStream(require.resolve(sourceFile))
            );
            const file = files.find((f) => f.name.endsWith(extension));

            const filepath = `/${file.bucket}/${file.filepath}`;
            const fileStream = await getDistributionApiFileStream(filepath, accessToken);
            // Compare checksum of downloaded file with expected checksum.
            const downloadChecksum = await generateChecksumFromStream('cksum', fileStream);
            return downloadChecksum === sourceChecksum;
          })
      );

      checkFiles.forEach((fileCheck) => {
        expect(fileCheck).toBe(true);
      });
    });
  });

  describe('A Cloudwatch event', () => {
    beforeAll(async () => {
      console.log('Start FailingExecution');

      failingWorkflowExecution = await buildAndExecuteWorkflow(
        config.stackName,
        config.bucket,
        workflowName,
        collection,
        provider,
        {}
      );
    });

    it('triggers the granule record being added to DynamoDB', async () => {
      const record = await waitForModelStatus(
        granuleModel,
        { granuleId: inputPayload.granules[0].granuleId },
        'completed'
      );
      expect(record.execution).toEqual(getExecutionUrl(workflowExecutionArn));
    });

    it('triggers the successful execution record being added to DynamoDB', async () => {
      const record = await waitForModelStatus(
        executionModel,
        { arn: workflowExecutionArn },
        'completed'
      );
      expect(record.status).toEqual('completed');
    });

    it('triggers the failed execution record being added to DynamoDB', async () => {
      const record = await waitForModelStatus(
        executionModel,
        { arn: failingWorkflowExecution.executionArn },
        'failed'
      );
      expect(record.status).toEqual('failed');
      expect(isObject(record.error)).toBe(true);
    });
  });

  describe('an SNS message', () => {
    let executionName;
    let executionCompletedKey;
    let executionFailedKey;
    let failedExecutionArn;
    let failedExecutionName;

    beforeAll(async () => {
      failedExecutionArn = failingWorkflowExecution.executionArn;
      failedExecutionName = failedExecutionArn.split(':').pop();
      executionName = postToCmrOutput.cumulus_meta.execution_name;

      executionFailedKey = `${config.stackName}/test-output/${failedExecutionName}.output`;
      executionCompletedKey = `${config.stackName}/test-output/${executionName}.output`;

      granuleCompletedMessageKey = `${config.stackName}/test-output/${inputPayload.granules[0].granuleId}-completed.output`;
      granuleRunningMessageKey = `${config.stackName}/test-output/${inputPayload.granules[0].granuleId}-running.output`;
    });

    afterAll(async () => {
      await Promise.all([
        executionModel.delete({ arn: failedExecutionArn }),
        deleteS3Object(config.bucket, executionCompletedKey),
        deleteS3Object(config.bucket, executionFailedKey)
      ]);
    });

    it('is published for a running granule', async () => {
      const granuleExists = await s3ObjectExists({
        Bucket: config.bucket,
        Key: granuleRunningMessageKey
      });
      expect(granuleExists).toEqual(true);
    });

    it('is published for an execution on a successful workflow completion', async () => {
      const executionExists = await s3ObjectExists({
        Bucket: config.bucket,
        Key: executionCompletedKey
      });
      expect(executionExists).toEqual(true);
    });

    it('is published for a granule on a successful workflow completion', async () => {
      const granuleExists = await s3ObjectExists({
        Bucket: config.bucket,
        Key: granuleCompletedMessageKey
      });
      expect(granuleExists).toEqual(true);
    });

    it('is published for an execution on workflow failure', async () => {
      const executionExists = await s3ObjectExists({
        Bucket: config.bucket,
        Key: executionFailedKey
      });

      expect(executionExists).toEqual(true);
    });
  });

  describe('The Cumulus API', () => {
    let workflowConfig;
    beforeAll(() => {
      workflowConfig = getConfigObject(workflowConfigFile, workflowName);
    });

    describe('granule endpoint', () => {
      let granule;
      let cmrLink;
      let publishGranuleExecution;

      beforeAll(async () => {
        const granuleResponse = await granulesApiTestUtils.getGranule({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId
        });
        granule = JSON.parse(granuleResponse.body);
        cmrLink = granule.cmrLink;
      });

      afterAll(async () => {
        const publishExecutionName = publishGranuleExecution.executionArn.split(':').pop();
        await deleteS3Object(config.bucket, `${config.stackName}/test-output/${publishExecutionName}.output`);
      });

      it('makes the granule available through the Cumulus API', async () => {
        expect(granule.granuleId).toEqual(inputPayload.granules[0].granuleId);
      });

      it('returns the granule with a CMR link', () => {
        expect(granule.cmrLink).not.toBeUndefined();
      });

      it('returns the granule with a timeToPreprocess', () => {
        expect(isNumber(granule.timeToPreprocess)).toBe(true);
      });

      it('returns the granule with a timeToArchive', () => {
        expect(isNumber(granule.timeToArchive)).toBe(true);
      });

      it('returns the granule with a processingStartDateTime', () => {
        expect(isString(granule.processingStartDateTime)).toBe(true);
      });

      it('returns the granule with a processingEndDateTime', () => {
        expect(isString(granule.processingEndDateTime)).toBe(true);
      });

      describe('when a reingest granule is triggered via the API', () => {
        let oldExecution;
        let oldUpdatedAt;
        let reingestResponse;
        let startTime;

        beforeAll(async () => {
          startTime = new Date();
          oldUpdatedAt = granule.updatedAt;
          oldExecution = granule.execution;
          const reingestGranuleResponse = await granulesApiTestUtils.reingestGranule({
            prefix: config.stackName,
            granuleId: inputPayload.granules[0].granuleId
          });
          reingestResponse = JSON.parse(reingestGranuleResponse.body);
        });

        it('executes successfully', () => {
          expect(reingestResponse.status).toEqual('SUCCESS');
        });

        it('returns a warning that data may be overwritten when duplicateHandling is "error"', () => {
          expect(reingestResponse.warning && reingestResponse.warning.includes('overwritten')).toBeTruthy();
        });

        it('overwrites granule files', async () => {
          // Await reingest completion
          const reingestGranuleExecution = await waitForTestExecutionStart({
            workflowName,
            stackName: config.stackName,
            bucket: config.bucket,
            findExecutionFn: isReingestExecutionForGranuleId,
            findExecutionFnParams: { granuleId: inputPayload.granules[0].granuleId },
            startTask: 'SyncGranule'
          });

          console.log(`Wait for completed execution ${reingestGranuleExecution.executionArn}`);

          await waitForCompletedExecution(reingestGranuleExecution.executionArn);

          const moveGranuleOutput = await lambdaStep.getStepOutput(
            reingestGranuleExecution.executionArn,
            'MoveGranule'
          );

          const moveGranuleOutputFiles = moveGranuleOutput.payload.granules[0].files;
          const nonCmrFiles = moveGranuleOutputFiles.filter((f) => !f.filename.endsWith('.cmr.xml'));
          nonCmrFiles.forEach((f) => expect(f.duplicate_found).toBe(true));

          await waitForModelStatus(
            granuleModel,
            { granuleId: inputPayload.granules[0].granuleId },
            'completed'
          );

          const updatedGranuleResponse = await granulesApiTestUtils.getGranule({
            prefix: config.stackName,
            granuleId: inputPayload.granules[0].granuleId
          });

          const updatedGranule = JSON.parse(updatedGranuleResponse.body);
          expect(updatedGranule.status).toEqual('completed');
          expect(updatedGranule.updatedAt).toBeGreaterThan(oldUpdatedAt);
          expect(updatedGranule.execution).not.toEqual(oldExecution);

          // the updated granule has the same files
          const oldFileNames = granule.files.map((f) => f.filename);
          const newFileNames = updatedGranule.files.map((f) => f.filename);
          expect(difference(oldFileNames, newFileNames).length).toBe(0);

          const currentFiles = await getFilesMetadata(updatedGranule.files);
          currentFiles.forEach((cf) => {
            expect(cf.LastModified).toBeGreaterThan(startTime);
          });
        });
      });

      it('removeFromCMR removes the ingested granule from CMR', async () => {
        const existsInCMR = await conceptExists(cmrLink);

        expect(existsInCMR).toEqual(true);

        // Remove the granule from CMR
        await granulesApiTestUtils.removeFromCMR({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId
        });

        // Check that the granule was removed
        await waitForConceptExistsOutcome(cmrLink, false);
        const doesExist = await conceptExists(cmrLink);
        expect(doesExist).toEqual(false);
      });

      it('applyWorkflow PublishGranule publishes the granule to CMR', async () => {
        const existsInCMR = await conceptExists(cmrLink);
        expect(existsInCMR).toEqual(false);

        // Publish the granule to CMR
        await granulesApiTestUtils.applyWorkflow({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId,
          workflow: 'PublishGranule'
        });

        publishGranuleExecution = await waitForTestExecutionStart({
          workflowName: 'PublishGranule',
          stackName: config.stackName,
          bucket: config.bucket,
          findExecutionFn: isExecutionForGranuleId,
          findExecutionFnParams: { granuleId: inputPayload.granules[0].granuleId },
          startTask: 'PostToCmr'
        });

        console.log(`Wait for completed execution ${publishGranuleExecution.executionArn}`);

        await waitForCompletedExecution(publishGranuleExecution.executionArn);

        await waitForConceptExistsOutcome(cmrLink, true);
        const doesExist = await conceptExists(cmrLink);
        expect(doesExist).toEqual(true);
      });

      describe('when moving a granule', () => {
        let file;
        let destinationKey;
        let destinations;

        beforeAll(() => {
          try {
            file = granule.files[0];

            destinationKey = `${testDataFolder}/${file.key}`;

            destinations = [{
              regex: '.*.hdf$',
              bucket: config.bucket,
              filepath: `${testDataFolder}/${path.dirname(file.key)}`
            }];
          } catch (err) {
            console.error('Error in beforeAll() block:', err);
            console.log(`File errored on: ${JSON.stringify(file, null, 2)}`);
          }
        });

        it('rejects moving a granule to a location that already exists', async () => {
          await s3CopyObject({
            Bucket: config.bucket,
            CopySource: `${file.bucket}/${file.key}`,
            Key: destinationKey
          });

          const moveGranuleResponse = await granulesApiTestUtils.moveGranule({
            prefix: config.stackName,
            granuleId: inputPayload.granules[0].granuleId,
            destinations
          });

          const responseBody = JSON.parse(moveGranuleResponse.body);

          expect(moveGranuleResponse.statusCode).toEqual(409);
          expect(responseBody.message).toEqual(
            `Cannot move granule because the following files would be overwritten at the destination location: ${granule.files[0].fileName}. Delete the existing files or reingest the source files.`
          );
        });

        it('when the file is deleted and the move retried, the move completes successfully', async () => {
          await deleteS3Object(config.bucket, destinationKey);

          // Sanity check
          let fileExists = await s3ObjectExists({ Bucket: config.bucket, Key: destinationKey });
          expect(fileExists).toBe(false);

          const moveGranuleResponse = await granulesApiTestUtils.moveGranule({
            prefix: config.stackName,
            granuleId: inputPayload.granules[0].granuleId,
            destinations
          });

          expect(moveGranuleResponse.statusCode).toEqual(200);

          fileExists = await s3ObjectExists({ Bucket: config.bucket, Key: destinationKey });
          expect(fileExists).toBe(true);
        });
      });

      it('can delete the ingested granule from the API', async () => {
        // pre-delete: Remove the granule from CMR
        await granulesApiTestUtils.removeFromCMR({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId
        });

        // Delete the granule
        await granulesApiTestUtils.deleteGranule({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId
        });

        // Verify deletion
        const granuleResponse = await granulesApiTestUtils.getGranule({
          prefix: config.stackName,
          granuleId: inputPayload.granules[0].granuleId
        });
        const resp = JSON.parse(granuleResponse.body);

        expect(resp.message).toEqual('Granule not found');
      });
    });

    describe('executions endpoint', () => {
      let executionResponse;
      let executions;

      beforeAll(async () => {
        const executionsApiResponse = await executionsApiTestUtils.getExecutions({
          prefix: config.stackName
        });
        executions = JSON.parse(executionsApiResponse.body);
        executionResponse = await executionsApiTestUtils.getExecution({
          prefix: config.stackName,
          arn: workflowExecutionArn
        });
      });

      it('returns a list of exeuctions', async () => {
        expect(executions.results.length).toBeGreaterThan(0);
      });

      it('returns overall status and timing for the execution', async () => {
        expect(executionResponse.status).toBeDefined();
        expect(executionResponse.createdAt).toBeDefined();
        expect(executionResponse.updatedAt).toBeDefined();
        expect(executionResponse.duration).toBeDefined();
      });

      it('returns tasks metadata with name and version', async () => {
        expect(executionResponse.tasks).toBeDefined();
        expect(executionResponse.tasks.length).not.toEqual(0);
        Object.keys(executionResponse.tasks).forEach((step) => {
          const task = executionResponse.tasks[step];
          expect(task.name).toBeDefined();
          expect(task.version).toBeDefined();
        });
      });
    });

    describe('When accessing a workflow execution via the API', () => {
      let executionStatus;
      let allStates;

      beforeAll(async () => {
        const executionStatusResponse = await executionsApiTestUtils.getExecutionStatus({
          prefix: config.stackName,
          arn: workflowExecutionArn
        });

        executionStatus = JSON.parse(executionStatusResponse.body);

        allStates = Object.keys(workflowConfig.States);
      });

      it('returns the inputs and outputs for the entire workflow', async () => {
        expect(executionStatus.execution).toBeTruthy();
        expect(executionStatus.execution.executionArn).toEqual(workflowExecutionArn);
        const input = JSON.parse(executionStatus.execution.input);
        const output = JSON.parse(executionStatus.execution.output);
        expect(input.payload).toEqual(inputPayload);
        expect(output.payload || output.replace).toBeTruthy();
      });

      it('returns the stateMachine information and workflow definition', async () => {
        expect(executionStatus.stateMachine).toBeTruthy();
        expect(executionStatus.stateMachine.stateMachineArn).toEqual(executionStatus.execution.stateMachineArn);
        expect(executionStatus.stateMachine.stateMachineArn.endsWith(executionStatus.stateMachine.name)).toBe(true);

        const definition = JSON.parse(executionStatus.stateMachine.definition);
        expect(definition.Comment).toEqual('Ingest Granule');
        const stateNames = Object.keys(definition.States);

        // definition has all the states' information
        expect(difference(allStates, stateNames).length).toBe(0);
      });

      it('returns the inputs, outputs, timing, and status information for each executed step', async () => {
        expect(executionStatus.executionHistory).toBeTruthy();

        // expected 'not executed' steps
        const expectedNotExecutedSteps = ['WorkflowFailed'];

        // expected 'executed' steps
        const expectedExecutedSteps = difference(allStates, expectedNotExecutedSteps);

        // steps with *EventDetails will have the input/output, and also stepname when state is entered/exited
        const stepNames = [];
        executionStatus.executionHistory.events.forEach((event) => {
          // expect timing information for each step
          expect(event.timestamp).toBeDefined();
          const eventKeys = Object.keys(event);
          // protect against "undefined": TaskStateEntered has "input" but not "name"
          if (event.name && intersection(eventKeys, ['input', 'output']).length === 1) {
            // each step should contain status information
            if (event.type === 'TaskStateExited') {
              const prevEvent = executionStatus.executionHistory.events[event.previousEventId - 1];
              expect(['LambdaFunctionSucceeded', 'LambdaFunctionFailed']).toContain(prevEvent.type);
            }
            if (!includes(stepNames, event.name)) stepNames.push(event.name);
          }
        });

        // all the executed steps have *EventDetails
        expect(difference(expectedExecutedSteps, stepNames).length).toBe(0);
        // some steps are not executed
        expect(difference(expectedNotExecutedSteps, stepNames).length).toBe(expectedNotExecutedSteps.length);
      });
    });

    describe('logs endpoint', () => {
      it('returns logs with a specific execution name', async () => {
        const executionARNTokens = workflowExecutionArn.split(':');
        const logsExecutionName = executionARNTokens[executionARNTokens.length - 1];
        const logsResponse = await apiTestUtils.getExecutionLogs({ prefix: config.stackName, executionName: logsExecutionName });
        const logs = JSON.parse(logsResponse.body);
        expect(logs.meta.count).not.toEqual(0);
        logs.results.forEach((log) => {
          expect(log.sender).not.toBe(undefined);
          expect(log.executions).toEqual(logsExecutionName);
        });
      });
    });

    describe('workflows endpoint', () => {
      it('returns a list of workflows', async () => {
        const workflowsResponse = await apiTestUtils.getWorkflows({ prefix: config.stackName });

        const workflows = JSON.parse(workflowsResponse.body);
        expect(workflows).not.toBe(undefined);
        expect(workflows.length).toBeGreaterThan(0);
      });

      it('returns the expected workflow', async () => {
        const workflowResponse = await apiTestUtils.getWorkflow({
          workflowName,
          prefix: config.stackName
        });

        const foundWorkflow = JSON.parse(workflowResponse.body);
        expect(foundWorkflow.definition.Comment).toEqual(workflowConfig.Comment);

        const foundKeys = Object.keys(foundWorkflow.definition.States);
        const configKeys = Object.keys(workflowConfig.States);
        expect(foundKeys.sort()).toEqual(configKeys.sort());
      });
    });
  });
});
