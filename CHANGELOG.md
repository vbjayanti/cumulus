# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### BREAKING CHANGES

- **CUMULUS-1714**
  - Changed the format of the message sent to the granule SNS Topic. Message includes the granule record under `record` and the type of event under `event`. Messages with `deleted` events will have the record that was deleted with a `deletedAt` timestamp. Options for `event` are `Create | Update | Delete`


  
### Changed

- **CUMULUS-1768**
  - The `stats/summary` endpoint reports the distinct collections for the number of granules reported
  
### Fixed

- **CUMULUS-1775**
  - Fix/update api endpoint to use updated google auth endpoints such that it will work with new accounts
  
- **CUMULUS-1768**
  - Fixed the `stats/` endpoint so that data is correctly filtered by timestamp and `processingTime` is calculated correctly.  

### Removed

- **CUMULUS-1768**
  - Removed API endpoints `stats/histogram` and `stats/average`. All advanced stats needs should be acquired from Cloud Metrics or similarly configured ELK stack.

## [v1.19.0] 2020-02-28

### BREAKING CHANGES

- **CUMULUS-1736**
  - The `@cumulus/discover-granules` task now sets the `dataType` of discovered
    granules based on the `name` of the configured collection, not the
    `dataType`.
  - The config schema of the `@cumulus/discover-granules` task now requires that
    collections contain a `version`.
  - The `@cumulus/sync-granule` task will set the `dataType` and `version` of a
    granule based on the configured collection if those fields are not already
    set on the granule. Previously it was using the `dataType` field of the
    configured collection, then falling back to the `name` field of the
    collection. This update will just use the `name` field of the collection to
    set the `dataType` field of the granule.

- **CUMULUS-1446**
  - Update the `@cumulus/integration-tests/api/executions.getExecution()`
    function to parse the response and return the execution, rather than return
    the full API response.

- **CUMULUS-1672**
  - The `cumulus` Terraform module in previous releases set a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, a `tags` input variable has been added to the `cumulus` Terraform
    module to allow resource tagging to be customized. No default tags will be
    applied to Cumulus-managed resources. To replicate the previous behavior,
    set `tags = { Deployment: var.prefix }` as an input variable for the
    `cumulus` Terraform module.

- **CUMULUS-1684 Migration Instructions**
  - In previous releases, a provider's username and password were encrypted
    using a custom encryption library. That has now been updated to use KMS.
    This release includes a Lambda function named
    `<prefix>-ProviderSecretsMigration`, which will re-encrypt existing
    provider credentials to use KMS. After this release has been deployed, you
    will need to manually invoke that Lambda function using either the AWS CLI
    or AWS Console. It should only need to be successfully run once.
  - Future releases of Cumulus will invoke a
    `<prefix>-VerifyProviderSecretsMigration` Lambda function as part of the
    deployment, which will cause the deployment to fail if the migration
    Lambda has not been run.

- **CUMULUS-1718**
  - The `@cumulus/sf-sns-report` task for reporting mid-workflow updates has been retired.
  This task was used as the `PdrStatusReport` task in our ParsePdr example workflow.
  If you have a ParsePdr or other workflow using this task, use `@cumulus/sf-sqs-report` instead.
  Trying to deploy the old task will result in an error as the cumulus module no longer exports `sf_sns_report_task`.
  - Migration instruction: In your workflow definition, for each step using the old task change:
  `"Resource": "${module.cumulus.sf_sns_report_task.task_arn}"`
  to
  `"Resource": "${module.cumulus.sf_sqs_report_task.task_arn}"`

- **CUMULUS-1755**
  - The `thin_egress_jwt_secret_name` variable for the `tf-modules/cumulus` Terraform module is now **required**. This variable is passed on to the Thin Egress App in `tf-modules/distribution/main.tf`, which uses the keys stored in the secret to sign JWTs. See the [Thin Egress App documentation on how to create a value for this secret](https://github.com/asfadmin/thin-egress-app#setting-up-the-jwt-cookie-secrets).

### Added

- **CUMULUS-1446**
  - Add `@cumulus/common/FileUtils.readJsonFile()` function
  - Add `@cumulus/common/FileUtils.readTextFile()` function
  - Add `@cumulus/integration-tests/api/collections.createCollection()` function
  - Add `@cumulus/integration-tests/api/collections.deleteCollection()` function
  - Add `@cumulus/integration-tests/api/collections.getCollection()` function
  - Add `@cumulus/integration-tests/api/providers.getProvider()` function
  - Add `@cumulus/integration-tests/index.getExecutionOutput()` function
  - Add `@cumulus/integration-tests/index.loadCollection()` function
  - Add `@cumulus/integration-tests/index.loadProvider()` function
  - Add `@cumulus/integration-tests/index.readJsonFilesFromDir()` function

- **CUMULUS-1672**
  - Add a `tags` input variable to the `archive` Terraform module
  - Add a `tags` input variable to the `cumulus` Terraform module
  - Add a `tags` input variable to the `cumulus_ecs_service` Terraform module
  - Add a `tags` input variable to the `data-persistence` Terraform module
  - Add a `tags` input variable to the `distribution` Terraform module
  - Add a `tags` input variable to the `ingest` Terraform module
  - Add a `tags` input variable to the `s3-replicator` Terraform module

- **CUMULUS-1707**
  - Enable logrotate on ECS cluster

- **CUMULUS-1684**
  - Add a `@cumulus/aws-client/KMS` library of KMS-related functions
  - Add `@cumulus/aws-client/S3.getTextObject()`
  - Add `@cumulus/sftp-client` package
  - Create `ProviderSecretsMigration` Lambda function
  - Create `VerifyProviderSecretsMigration` Lambda function

- **CUMULUS-1548**
  - Add ability to put default Cumulus logs in Metrics' ELK stack
  - Add ability to add custom logs to Metrics' ELK Stack

- **CUMULUS-1702**
  - When logs are sent to Metrics' ELK stack, the logs endpoints will return results from there

- **CUMULUS-1459**
  - Async Operations are indexed in Elasticsearch
  - To index any existing async operations you'll need to perform an index from
    database function.

- **CUMULUS-1717**
  - Add `@cumulus/aws-client/deleteAndWaitForDynamoDbTableNotExists`, which
    deletes a DynamoDB table and waits to ensure the table no longer exists
  - Added `publishGranules` Lambda to handle publishing granule messages to SNS when granule records are written to DynamoDB
  - Added `@cumulus/api/models/Granule.storeGranulesFromCumulusMessage` to store granules from a Cumulus message to DynamoDB

- **CUMULUS-1718**
  - Added `@cumulus/sf-sqs-report` task to allow mid-workflow reporting updates.
  - Added `stepfunction_event_reporter_queue_url` and `sf_sqs_report_task` outputs to the `cumulus` module.
  - Added `publishPdrs` Lambda to handle publishing PDR messages to SNS when PDR records are written to DynamoDB.
  - Added `@cumulus/api/models/Pdr.storePdrFromCumulusMessage` to store PDRs from a Cumulus message to DynamoDB.
  - Added `@cumulus/aws-client/parseSQSMessageBody` to parse an SQS message body string into an object.

- **Ability to set custom backend API url in the archive module**
  - Add `api_url` definition in `tf-modules/cumulus/archive.tf`
  - Add `archive_api_url` variable in `tf-modules/cumulus/variables.tf`

- **CUMULUS-1741**
  - Added an optional `elasticsearch_security_group_ids` variable to the
    `data-persistence` Terraform module to allow additional security groups to
    be assigned to the Elasticsearch Domain.

- **CUMULUS-1752**
  - Added `@cumulus/integration-tests/api/distribution.invokeTEADistributionLambda` to simulate a request to the [Thin Egress App](https://github.com/asfadmin/thin-egress-app) by invoking the Lambda and getting a response payload.
  - Added `@cumulus/integration-tests/api/distribution.getTEARequestHeaders` to generate necessary request headers for a request to the Thin Egress App
  - Added `@cumulus/integration-tests/api/distribution.getTEADistributionApiFileStream` to get a response stream for a file served by Thin Egress App
  - Added `@cumulus/integration-tests/api/distribution.getTEADistributionApiRedirect` to get a redirect response from the Thin Egress App

- **CUMULUS-1755**
  - Added `@cumulus/aws-client/CloudFormation.describeCfStack()` to describe a Cloudformation stack
  - Added `@cumulus/aws-client/CloudFormation.getCfStackParameterValues()` to get multiple parameter values for a Cloudformation stack

### Changed

- **CUMULUS-1736**
  - The `collections` model in the API package now determines the name of a
    collection based on the `name` property, rather than using `dataType` and
    then falling back to `name`.
  - The `@cumulus/integration-tests.loadCollection()` function no longer appends
    the postfix to the end of the collection's `dataType`.
  - The `@cumulus/integration-tests.addCollections()` function no longer appends
    the postfix to the end of the collection's `dataType`.

- **CUMULUS-1672**
  - Add a `retryOptions` parameter to the `@cumulus/aws-client/S3.headObject`
     function, which will retry if the object being queried does not exist.

- **CUMULUS-1446**
  - Mark the `@cumulus/integration-tests/api.addCollectionApi()` function as
    deprecated
  - Mark the `@cumulus/integration-tests/index.listCollections()` function as
    deprecated
  - Mark the `@cumulus/integration-tests/index.listProviders()` function as
    deprecated
  - Mark the `@cumulus/integration-tests/index.rulesList()` function as
    deprecated

- **CUMULUS-1672**
  - Previously, the `cumulus` module defaulted to setting a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, the `cumulus` module will now accept a `tags` input variable that
    defines the tags to be assigned to all resources that it manages.
  - Previously, the `data-persistence` module defaulted to setting a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, the `data-persistence` module will now accept a `tags` input
    variable that defines the tags to be assigned to all resources that it
    manages.
  - Previously, the `distribution` module defaulted to setting a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, the `distribution` module will now accept a `tags` input variable
    that defines the tags to be assigned to all resources that it manages.
  - Previously, the `ingest` module defaulted to setting a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, the `ingest` module will now accept a `tags` input variable that
    defines the tags to be assigned to all resources that it manages.
  - Previously, the `s3-replicator` module defaulted to setting a
    `Deployment = var.prefix` tag on all resources that it managed. In this
    release, the `s3-replicator` module will now accept a `tags` input variable
    that defines the tags to be assigned to all resources that it manages.

- **CUMULUS-1684**
  - Update the API package to encrypt provider credentials using KMS instead of
    using RSA keys stored in S3

- **CUMULUS-1717**
  - Changed name of `cwSfExecutionEventToDb` Lambda to `cwSfEventToDbRecords`
  - Updated `cwSfEventToDbRecords` to write granule records to DynamoDB from the incoming Cumulus message

- **CUMULUS-1718**
  - Renamed `cwSfEventToDbRecords` to `sfEventSqsToDbRecords` due to architecture change to being a consumer of an SQS queue of Step Function Cloudwatch events.
  - Updated `sfEventSqsToDbRecords` to write PDR records to DynamoDB from the incoming Cumulus message
  - Moved `data-cookbooks/sns.md` to `data-cookbooks/ingest-notifications.md` and updated it to reflect recent changes.

- **CUMULUS-1748**
  - (S)FTP discovery tasks now use the provider-path as-is instead of forcing it to a relative path.
  - Improved error handling to catch permission denied FTP errors better and log them properly. Workflows will still fail encountering this error and we intend to consider that approach in a future ticket.

- **CUMULUS-1752**
  - Moved class for parsing distribution events to its own file: `@cumulus/api/lib/DistributionEvent.js`
    - Updated `DistributionEvent` to properly parse S3 access logs generated by requests from the [Thin Egress App](https://github.com/asfadmin/thin-egress-app)

- **CUMULUS-1753** - Changes to `@cumulus/ingest/HttpProviderClient.js`:
  - Removed regex filter in `HttpProviderClient.list()` that was used to return only files with an extension between 1 and 4 characters long. `HttpProviderClient.list()` will now return all files linked from the HTTP provider host.

- **CUMULUS-1755**
  - Updated the Thin Egress App module used in `tf-modules/distribution/main.tf` to build 61. [See the release notes](https://github.com/asfadmin/thin-egress-app/releases/tag/tea-build.61).

- **CUMULUS-1757**
  - Update @cumulus/cmr-client CMRSearchConceptQueue to take optional cmrEnvironment parameter

### Deprecated

- **CUMULUS-1684**
  - Deprecate `@cumulus/common/key-pair-provider/S3KeyPairProvider`
  - Deprecate `@cumulus/common/key-pair-provider/S3KeyPairProvider.encrypt()`
  - Deprecate `@cumulus/common/key-pair-provider/S3KeyPairProvider.decrypt()`
  - Deprecate `@cumulus/common/kms/KMS`
  - Deprecate `@cumulus/common/kms/KMS.encrypt()`
  - Deprecate `@cumulus/common/kms/KMS.decrypt()`
  - Deprecate `@cumulus/common/sftp.Sftp`

- **CUMULUS-1717**
  - Deprecate `@cumulus/api/models/Granule.createGranulesFromSns`

- **CUMULUS-1718**
  - Deprecate `@cumulus/sf-sns-report`.
    - This task has been updated to always throw an error directing the user to use `@cumulus/sf-sqs-report` instead. This was done because there is no longer an SNS topic to which to publish, and no consumers to listen to it.

- **CUMULUS-1748**
  - Deprecate `@cumulus/ingest/util.normalizeProviderPath`

- **CUMULUS-1752**
  - Deprecate `@cumulus/integration-tests/api/distribution.getDistributionApiFileStream`
  - Deprecate `@cumulus/integration-tests/api/distribution.getDistributionApiRedirect`
  - Deprecate `@cumulus/integration-tests/api/distribution.invokeApiDistributionLambda`

### Removed

- **CUMULUS-1684**
  - Remove the deployment script that creates encryption keys and stores them to
    S3

- **CUMULUS-1768**
  - Removed API endpoints `stats/histogram` and `stats/average`. All advanced stats needs should be acquired from Cloud Metrics or similarly configured ELK stack.

### Fixed

- **Fix default values for urs_url in variables.tf files**
  - Remove trailing `/` from default `urs_url` values.

- **CUMULUS-1610** - Add the Elasticsearch security group to the EC2 security groups

- **CUMULUS-1740** - `cumulus_meta.workflow_start_time` is now set in Cumulus
  messages

- **CUMULUS-1753** - Fixed `@cumulus/ingest/HttpProviderClient.js` to properly handle HTTP providers with:
  - Multiple link tags (e.g. `<a>`) per line of source code
  - Link tags in uppercase or lowercase (e.g. `<A>`)
  - Links with filepaths in the link target (e.g. `<a href="/path/to/file.txt">`). These files will be returned from HTTP file discovery **as the file name only** (e.g. `file.txt`).

- **CUMULUS-1768**
  - Fix an issue in the stats endpoints in `@cumulus/api` to send back stats for the correct type

## [v1.18.0] 2020-02-03

### BREAKING CHANGES

- **CUMULUS-1686**

  - `ecs_cluster_instance_image_id` is now a _required_ variable of the `cumulus` module, instead of optional.

- **CUMULUS-1698**

  - Change variable `saml_launchpad_metadata_path` to `saml_launchpad_metadata_url` in the `tf-modules/cumulus` Terraform module.

- **CUMULUS-1703**
  - Remove the unused `forceDownload` option from the `sync-granule` tasks's config
  - Remove the `@cumulus/ingest/granule.Discover` class
  - Remove the `@cumulus/ingest/granule.Granule` class
  - Remove the `@cumulus/ingest/pdr.Discover` class
  - Remove the `@cumulus/ingest/pdr.Granule` class
  - Remove the `@cumulus/ingest/parse-pdr.parsePdr` function

### Added

- **CUMULUS-1040**

  - Added `@cumulus/aws-client` package to provide utilities for working with AWS services and the Node.js AWS SDK
  - Added `@cumulus/errors` package which exports error classes for use in Cumulus workflow code
  - Added `@cumulus/integration-tests/sfnStep` to provide utilities for parsing step function execution histories

- **CUMULUS-1102**

  - Adds functionality to the @cumulus/api package for better local testing.
    - Adds data seeding for @cumulus/api's localAPI.
      - seed functions allow adding collections, executions, granules, pdrs, providers, and rules to a Localstack Elasticsearch and DynamoDB via `addCollections`, `addExecutions`, `addGranules`, `addPdrs`, `addProviders`, and `addRules`.
    - Adds `eraseDataStack` function to local API server code allowing resetting of local datastack for testing (ES and DynamoDB).
    - Adds optional parameters to the @cumulus/api bin serve to allow for launching the api without destroying the current data.

- **CUMULUS-1697**

  - Added the `@cumulus/tf-inventory` package that provides command line utilities for managing Terraform resources in your AWS account

- **CUMULUS-1703**

  - Add `@cumulus/aws-client/S3.createBucket` function
  - Add `@cumulus/aws-client/S3.putFile` function
  - Add `@cumulus/common/string.isNonEmptyString` function
  - Add `@cumulus/ingest/FtpProviderClient` class
  - Add `@cumulus/ingest/HttpProviderClient` class
  - Add `@cumulus/ingest/S3ProviderClient` class
  - Add `@cumulus/ingest/SftpProviderClient` class
  - Add `@cumulus/ingest/providerClientUtils.buildProviderClient` function
  - Add `@cumulus/ingest/providerClientUtils.fetchTextFile` function

- **CUMULUS-1731**

  - Add new optional input variables to the Cumulus Terraform module to support TEA upgrade:
    - `thin_egress_cookie_domain` - Valid domain for Thin Egress App cookie
    - `thin_egress_domain_cert_arn` - Certificate Manager SSL Cert ARN for Thin
      Egress App if deployed outside NGAP/CloudFront
    - `thin_egress_download_role_in_region_arn` - ARN for reading of Thin Egress
      App data buckets for in-region requests
    - `thin_egress_jwt_algo` - Algorithm with which to encode the Thin Egress
      App JWT cookie
    - `thin_egress_jwt_secret_name` - Name of AWS secret where keys for the Thin
      Egress App JWT encode/decode are stored
    - `thin_egress_lambda_code_dependency_archive_key` - Thin Egress App - S3
      Key of packaged python modules for lambda dependency layer

- **CUMULUS-1733**
  - Add `discovery-filtering` operator doc to document previously undocumented functionality.

- **CUMULUS-1737**
  - Added the `cumulus-test-cleanup` module to run a nightly cleanup on resources left over from the integration tests run from the `example/spec` directory.

### Changed

- **CUMULUS-1102**

  - Updates `@cumulus/api/auth/testAuth` to use JWT instead of random tokens.
  - Updates the default AMI for the ecs_cluster_instance_image_id.

- **CUMULUS-1622**

  - Mutex class has been deprecated in `@cumulus/common/concurrency` and will be removed in a future release.

- **CUMULUS-1686**

  - Changed `ecs_cluster_instance_image_id` to be a required variable of the `cumulus` module and removed the default value.
    The default was not available across accounts and regions, nor outside of NGAP and therefore not particularly useful.

- **CUMULUS-1688**

  - Updated `@cumulus/aws.receiveSQSMessages` not to replace `message.Body` with a parsed object. This behavior was undocumented and confusing as received messages appeared to contradict AWS docs that state `message.Body` is always a string.
  - Replaced `sf_watcher` CloudWatch rule from `cloudwatch-events.tf` with an EventSourceMapping on `sqs2sf` mapped to the `start_sf` SQS queue (in `event-sources.tf`).
  - Updated `sqs2sf` with an EventSourceMapping handler and unit test.

- **CUMULUS-1698**

  - Change variable `saml_launchpad_metadata_path` to `saml_launchpad_metadata_url` in the `tf-modules/cumulus` Terraform module.
  - Updated `@cumulus/api/launchpadSaml` to download launchpad IDP metadata from configured location when the metadata in s3 is not valid, and to work with updated IDP metadata and SAML response.

- **CUMULUS-1731**
  - Upgrade the version of the Thin Egress App deployed by Cumulus to v48
    - Note: New variables available, see the 'Added' section of this changelog.

### Fixed

- **CUMULUS-1664**

  - Updated `dbIndexer` Lambda to remove hardcoded references to DynamoDB table names.

- **CUMULUS-1733**
  - Fixed granule discovery recursion algorithm used in S/FTP protocols.

### Removed

- **CUMULUS-1481**
  - removed `process` config and output from PostToCmr as it was not required by the task nor downstream steps, and should still be in the output message's `meta` regardless.

### Deprecated

- **CUMULUS-1040**
  - Deprecated the following code. For cases where the code was moved into another package, the new code location is noted:
    - `@cumulus/common/CloudFormationGateway` -> `@cumulus/aws-client/CloudFormationGateway`
    - `@cumulus/common/DynamoDb` -> `@cumulus/aws-client/DynamoDb`
    - `@cumulus/common/errors` -> `@cumulus/errors`
    - `@cumulus/common/StepFunctions` -> `@cumulus/aws-client/StepFunctions`
    - All of the exported functions in `@cumulus/commmon/aws` (moved into `@cumulus/aws-client`), except:
      - `@cumulus/common/aws/isThrottlingException` -> `@cumulus/errors/isThrottlingException`
      - `@cumulus/common/aws/improveStackTrace` (not deprecated)
      - `@cumulus/common/aws/retryOnThrottlingException` (not deprecated)
    - `@cumulus/common/sfnStep/SfnStep.parseStepMessage` -> `@cumulus/integration-tests/sfnStep/SfnStep.parseStepMessage`
    - `@cumulus/common/sfnStep/ActivityStep` -> `@cumulus/integration-tests/sfnStep/ActivityStep`
    - `@cumulus/common/sfnStep/LambdaStep` -> `@cumulus/integration-tests/sfnStep/LambdaStep`
    - `@cumulus/common/string/unicodeEscape` -> `@cumulus/aws-client/StepFunctions.unicodeEscape`
    - `@cumulus/common/util/setErrorStack` -> `@cumulus/aws-client/util/setErrorStack`
    - `@cumulus/ingest/aws/invoke` -> `@cumulus/aws-client/Lambda/invoke`
    - `@cumulus/ingest/aws/CloudWatch.bucketSize`
    - `@cumulus/ingest/aws/CloudWatch.cw`
    - `@cumulus/ingest/aws/ECS.ecs`
    - `@cumulus/ingest/aws/ECS`
    - `@cumulus/ingest/aws/Events.putEvent` -> `@cumulus/aws-client/CloudwatchEvents.putEvent`
    - `@cumulus/ingest/aws/Events.deleteEvent` -> `@cumulus/aws-client/CloudwatchEvents.deleteEvent`
    - `@cumulus/ingest/aws/Events.deleteTarget` -> `@cumulus/aws-client/CloudwatchEvents.deleteTarget`
    - `@cumulus/ingest/aws/Events.putTarget` -> `@cumulus/aws-client/CloudwatchEvents.putTarget`
    - `@cumulus/ingest/aws/SQS.attributes` -> `@cumulus/aws-client/SQS.getQueueAttributes`
    - `@cumulus/ingest/aws/SQS.deleteMessage` -> `@cumulus/aws-client/SQS.deleteSQSMessage`
    - `@cumulus/ingest/aws/SQS.deleteQueue` -> `@cumulus/aws-client/SQS.deleteQueue`
    - `@cumulus/ingest/aws/SQS.getUrl` -> `@cumulus/aws-client/SQS.getQueueUrlByName`
    - `@cumulus/ingest/aws/SQS.receiveMessage` -> `@cumulus/aws-client/SQS.receiveSQSMessages`
    - `@cumulus/ingest/aws/SQS.sendMessage` -> `@cumulus/aws-client/SQS.sendSQSMessage`
    - `@cumulus/ingest/aws/StepFunction.getExecutionStatus` -> `@cumulus/aws-client/StepFunction.getExecutionStatus`
    - `@cumulus/ingest/aws/StepFunction.getExecutionUrl` -> `@cumulus/aws-client/StepFunction.getExecutionUrl`

## [v1.17.0] - 2019-12-31

### BREAKING CHANGES

- **CUMULUS-1498**
  - The `@cumulus/cmrjs.publish2CMR` function expects that the value of its
    `creds.password` parameter is a plaintext password.
  - Rather than using an encrypted password from the `cmr_password` environment
    variable, the `@cumulus/cmrjs.updateCMRMetadata` function now looks for an
    environment variable called `cmr_password_secret_name` and fetches the CMR
    password from that secret in AWS Secrets Manager.
  - The `@cumulus/post-to-cmr` task now expects a
    `config.cmr.passwordSecretName` value, rather than `config.cmr.password`.
    The CMR password will be fetched from that secret in AWS Secrets Manager.

### Added

- **CUMULUS-630**

  - Added support for replaying Kinesis records on a stream into the Cumulus Kinesis workflow triggering mechanism: either all the records, or some time slice delimited by start and end timestamps.
  - Added `/replays` endpoint to the operator API for triggering replays.
  - Added `Replay Kinesis Messages` documentation to Operator Docs.
  - Added `manualConsumer` lambda function to consume a Kinesis stream. Used by the replay AsyncOperation.

- **CUMULUS-1687**
  - Added new API endpoint for listing async operations at `/asyncOperations`
  - All asyncOperations now include the fields `description` and `operationType`. `operationType` can be one of the following. [`Bulk Delete`, `Bulk Granules`, `ES Index`, `Kinesis Replay`]

### Changed

- **CUMULUS-1626**

  - Updates Cumulus to use node10/CMA 1.1.2 for all of its internal lambdas in prep for AWS node 8 EOL

- **CUMULUS-1498**
  - Remove the DynamoDB Users table. The list of OAuth users who are allowed to
    use the API is now stored in S3.
  - The CMR password and Launchpad passphrase are now stored in Secrets Manager

## [v1.16.1] - 2019-12-6

**Please note**:

- The `region` argument to the `cumulus` Terraform module has been removed. You may see a warning or error if you have that variable populated.
- Your workflow tasks should use the following versions of the CMA libraries to utilize new granule, parentArn, asyncOperationId, and stackName fields on the logs:
  - `cumulus-message-adapter-js` version 1.0.10+
  - `cumulus-message-adapter-python` version 1.1.1+
  - `cumulus-message-adapter-java` version 1.2.11+
- The `data-persistence` module no longer manages the creation of an Elasticsearch service-linked role for deploying Elasticsearch to a VPC. Follow the [deployment instructions on preparing your VPC](https://nasa.github.io/cumulus/docs/deployment/deployment-readme#vpc-subnets-and-security-group) for guidance on how to create the Elasticsearch service-linked role manually.
- There is now a `distribution_api_gateway_stage` variable for the `tf-modules/cumulus` Terraform module that will be used as the API gateway stage name used for the distribution API (Thin Egress App)
- Default value for the `urs_url` variable is now `https://uat.urs.earthdata.nasa.gov/` in the `tf-modules/cumulus` and `tf-modules/archive` Terraform modules. So deploying the `cumulus` module without a `urs_url` variable set will integrate your Cumulus deployment with the UAT URS environment.

### Added

- **CUMULUS-1563**

  - Added `custom_domain_name` variable to `tf-modules/data-persistence` module

- **CUMULUS-1654**
  - Added new helpers to `@cumulus/common/execution-history`:
    - `getStepExitedEvent()` returns the `TaskStateExited` event in a workflow execution history after the given step completion/failure event
    - `getTaskExitedEventOutput()` returns the output message for a `TaskStateExited` event in a workflow execution history

### Changed

- **CUMULUS-1578**

  - Updates SAML launchpad configuration to authorize via configured userGroup.
    [See the NASA specific documentation (protected)](https://wiki.earthdata.nasa.gov/display/CUMULUS/Cumulus+SAML+Launchpad+Integration)

- **CUMULUS-1579**

  - Elasticsearch list queries use `match` instead of `term`. `term` had been analyzing the terms and not supporting `-` in the field values.

- **CUMULUS-1619**

  - Adds 4 new keys to `@cumulus/logger` to display granules, parentArn, asyncOperationId, and stackName.
  - Depends on `cumulus-message-adapter-js` version 1.0.10+. Cumulus tasks updated to use this version.

- **CUMULUS-1654**

  - Changed `@cumulus/common/SfnStep.parseStepMessage()` to a static class method

- **CUMULUS-1641**
  - Added `meta.retries` and `meta.visibilityTimeout` properties to sqs-type rule. To create sqs-type rule, you're required to configure a dead-letter queue on your queue.
  - Added `sqsMessageRemover` lambda which removes the message from SQS queue upon successful workflow execution.
  - Updated `sqsMessageConsumer` lambda to not delete message from SQS queue, and to retry the SQS message for configured number of times.

### Removed

- Removed `create_service_linked_role` variable from `tf-modules/data-persistence` module.

- **CUMULUS-1321**
  - The `region` argument to the `cumulus` Terraform module has been removed

### Fixed

- **CUMULUS-1668** - Fixed a race condition where executions may not have been
  added to the database correctly
- **CUMULUS-1654** - Fixed issue with `publishReports` Lambda not including workflow execution error information for failed workflows with a single step
- Fixed `tf-modules/cumulus` module so that the `urs_url` variable is passed on to its invocation of the `tf-modules/archive` module

## [v1.16.0] - 2019-11-15

### Added

- **CUMULUS-1321**

  - A `deploy_distribution_s3_credentials_endpoint` variable has been added to
    the `cumulus` Terraform module. If true, the NGAP-backed S3 credentials
    endpoint will be added to the Thin Egress App's API. Default: true

- **CUMULUS-1544**

  - Updated the `/granules/bulk` endpoint to correctly query Elasticsearch when
    granule ids are not provided.

- **CUMULUS-1580**
  - Added `/granules/bulk` endpoint to `@cumulus/api` to perform bulk actions on granules given either a list of granule ids or an Elasticsearch query and the workflow to perform.

### Changed

- **CUMULUS-1561**

  - Fix the way that we are handling Terraform provider version requirements
  - Pass provider configs into child modules using the method that the
    [Terraform documentation](https://www.terraform.io/docs/configuration/modules.html#providers-within-modules)
    suggests
  - Remove the `region` input variable from the `s3_access_test` Terraform module
  - Remove the `aws_profile` and `aws_region` input variables from the
    `s3-replicator` Terraform module

- **CUMULUS-1639**
  - Because of
    [S3's Data Consistency Model](https://docs.aws.amazon.com/AmazonS3/latest/dev/Introduction.html#BasicsObjects),
    there may be situations where a GET operation for an object can temporarily
    return a `NoSuchKey` response even if that object _has_ been created. The
    `@cumulus/common/aws.getS3Object()` function has been updated to support
    retries if a `NoSuchKey` response is returned by S3. This behavior can be
    enabled by passing a `retryOptions` object to that function. Supported
    values for that object can be found here:
    <https://github.com/tim-kos/node-retry#retryoperationoptions>

### Removed

- **CUMULUS-1559**
  - `logToSharedDestination` has been migrated to the Terraform deployment as `log_api_gateway_to_cloudwatch` and will ONLY apply to egress lambdas.
    Due to the differences in the Terraform deployment model, we cannot support a global log subscription toggle for a configurable subset of lambdas.
    However, setting up your own log forwarding for a Lambda with Terraform is fairly simple, as you will only need to add SubscriptionFilters to your Terraform configuration, one per log group.
    See [the Terraform documentation](https://www.terraform.io/docs/providers/aws/r/cloudwatch_log_subscription_filter.html) for details on how to do this.
    An empty FilterPattern ("") will capture all logs in a group.

## [v1.15.0] - 2019-11-04

### BREAKING CHANGES

- **CUMULUS-1644** - When a workflow execution begins or ends, the workflow
  payload is parsed and any new or updated PDRs or granules referenced in that
  workflow are stored to the Cumulus archive. The defined interface says that a
  PDR in `payload.pdr` will be added to the archive, and any granules in
  `payload.granules` will also be added to the archive. In previous releases,
  PDRs found in `meta.pdr` and granules found in `meta.input_granules` were also
  added to the archive. This caused unexpected behavior and has been removed.
  Only PDRs from `payload.pdr` and granules from `payload.granules` will now be
  added to the Cumulus archive.

- **CUMULUS-1449** - Cumulus now uses a universal workflow template when
  starting a workflow that contains general information specific to the
  deployment, but not specific to the workflow. Workflow task configs must be
  defined using AWS step function parameters. As part of this change,
  `CumulusConfig` has been retired and task configs must now be defined under
  the `cma.task_config` key in the Parameters section of a step function
  definition.

  **Migration instructions**:

  NOTE: These instructions require the use of Cumulus Message Adapter v1.1.x+.
  Please ensure you are using a compatible version before attempting to migrate
  workflow configurations. When defining workflow steps, remove any
  `CumulusConfig` section, as shown below:

  ```yaml
  ParsePdr:
    CumulusConfig:
      provider: "{$.meta.provider}"
      bucket: "{$.meta.buckets.internal.name}"
      stack: "{$.meta.stack}"
  ```

  Instead, use AWS Parameters to pass `task_config` for the task directly into
  the Cumulus Message Adapter:

  ```yaml
  ParsePdr:
    Parameters:
      cma:
        event.$: "$"
        task_config:
          provider: "{$.meta.provider}"
          bucket: "{$.meta.buckets.internal.name}"
          stack: "{$.meta.stack}"
  ```

  In this example, the `cma` key is used to pass parameters to the message
  adapter. Using `task_config` in combination with `event.$: '$'` allows the
  message adapter to process `task_config` as the `config` passed to the Cumulus
  task. See `example/workflows/sips.yml` in the core repository for further
  examples of how to set the Parameters.

  Additionally, workflow configurations for the `QueueGranules` and `QueuePdrs`
  tasks need to be updated:

  - `queue-pdrs` config changes:
    - `parsePdrMessageTemplateUri` replaced with `parsePdrWorkflow`, which is
      the workflow name (i.e. top-level name in `config.yml`, e.g. 'ParsePdr').
    - `internalBucket` and `stackName` configs now required to look up
      configuration from the deployment. Brings the task config in line with
      that of `queue-granules`.
  - `queue-granules` config change: `ingestGranuleMessageTemplateUri` replaced
    with `ingestGranuleWorkflow`, which is the workflow name (e.g.
    'IngestGranule').

- **CUMULUS-1396** - **Workflow steps at the beginning and end of a workflow
  using the `SfSnsReport` Lambda have now been deprecated (e.g. `StartStatus`,
  `StopStatus`) and should be removed from your workflow definitions**. These
  steps were used for publishing ingest notifications and have been replaced by
  an implementation using Cloudwatch events for Step Functions to trigger a
  Lambda that publishes ingest notifications. For further detail on how ingest
  notifications are published, see the notes below on **CUMULUS-1394**. For
  examples of how to update your workflow definitions, see our
  [example workflow definitions](https://github.com/nasa/cumulus/blob/master/example/workflows/).

- **CUMULUS-1470**
  - Remove Cumulus-defined ECS service autoscaling, allowing integrators to
    better customize autoscaling to meet their needs. In order to use
    autoscaling with ECS services, appropriate
    `AWS::ApplicationAutoScaling::ScalableTarget`,
    `AWS::ApplicationAutoScaling::ScalingPolicy`, and `AWS::CloudWatch::Alarm`
    resources should be defined in a kes overrides file. See
    [this example](https://github.com/nasa/cumulus/blob/release-1.15.x/example/overrides/app/cloudformation.template.yml)
    for an example.
  - The following config parameters are no longer used:
    - ecs.services.\<NAME\>.minTasks
    - ecs.services.\<NAME\>.maxTasks
    - ecs.services.\<NAME\>.scaleInActivityScheduleTime
    - ecs.services.\<NAME\>.scaleInAdjustmentPercent
    - ecs.services.\<NAME\>.scaleOutActivityScheduleTime
    - ecs.services.\<NAME\>.scaleOutAdjustmentPercent
    - ecs.services.\<NAME\>.activityName

### Added

- **CUMULUS-1100**

  - Added 30-day retention properties to all log groups that were missing those policies.

- **CUMULUS-1396**

  - Added `@cumulus/common/sfnStep`:
    - `LambdaStep` - A class for retrieving and parsing input and output to Lambda steps in AWS Step Functions
    - `ActivityStep` - A class for retrieving and parsing input and output to ECS activity steps in AWS Step Functions

- **CUMULUS-1574**

  - Added `GET /token` endpoint for SAML authorization when cumulus is protected by Launchpad.
    This lets a user retieve a token by hand that can be presented to the API.

- **CUMULUS-1625**

  - Added `sf_start_rate` variable to the `ingest` Terraform module, equivalent to `sqs_consumer_rate` in the old model, but will not be automatically applied to custom queues as that was.

- **CUMULUS-1513**
  - Added `sqs`-type rule support in the Cumulus API `@cumulus/api`
  - Added `sqsMessageConsumer` lambda which processes messages from the SQS queues configured in the `sqs` rules.

### Changed

- **CUMULUS-1639**

  - Because of
    [S3's Data Consistency Model](https://docs.aws.amazon.com/AmazonS3/latest/dev/Introduction.html#BasicsObjects),
    there may be situations where a GET operation for an object can temporarily
    return a `NoSuchKey` response even if that object _has_ been created. The
    `@cumulus/common/aws.getS3Object()` function will now retry up to 10 times
    if a `NoSuchKey` response is returned by S3. This can behavior can be
    overridden by passing `{ retries: 0 }` as the `retryOptions` argument.

- **CUMULUS-1449**

  - `queue-pdrs` & `queue-granules` config changes. Details in breaking changes section.
  - Cumulus now uses a universal workflow template when starting workflow that contains general information specific to the deployment, but not specific to the workflow.
  - Changed the way workflow configs are defined, from `CumulusConfig` to a `task_config` AWS Parameter.

- **CUMULUS-1452**

  - Changed the default ECS docker storage drive to `devicemapper`

- **CUMULUS-1453**
  - Removed config schema for `@cumulus/sf-sns-report` task
  - Updated `@cumulus/sf-sns-report` to always assume that it is running as an intermediate step in a workflow, not as the first or last step

### Removed

- **CUMULUS-1449**
  - Retired `CumulusConfig` as part of step function definitions, as this is an artifact of the way Kes parses workflow definitions that was not possible to migrate to Terraform. Use AWS Parameters and the `task_config` key instead. See change note above.
  - Removed individual workflow templates.

### Fixed

- **CUMULUS-1620** - Fixed bug where `message_adapter_version` does not correctly inject the CMA

- **CUMULUS-1396** - Updated `@cumulus/common/StepFunctions.getExecutionHistory()` to recursively fetch execution history when `nextToken` is returned in response

- **CUMULUS-1571** - Updated `@cumulus/common/DynamoDb.get()` to throw any errors encountered when trying to get a record and the record does exist

- **CUMULUS-1452**
  - Updated the EC2 initialization scripts to use full volume size for docker storage
  - Changed the default ECS docker storage drive to `devicemapper`

## [v1.14.5] - 2019-12-30 - [BACKPORT]

### Updated

- **CUMULUS-1626**
  - Updates Cumulus to use node10/CMA 1.1.2 for all of its internal lambdas in prep for AWS node 8 EOL

## [v1.14.4] - 2019-10-28

### Fixed

- **CUMULUS-1632** - Pinned `aws-elasticsearch-connector` package in `@cumulus/api` to version `8.1.3`, since `8.2.0` includes breaking changes

## [v1.14.3] - 2019-10-18

### Fixed

- **CUMULUS-1620** - Fixed bug where `message_adapter_version` does not correctly inject the CMA

- **CUMULUS-1572** - A granule is now included in discovery results even when
  none of its files has a matching file type in the associated collection
  configuration. Previously, if all files for a granule were unmatched by a file
  type configuration, the granule was excluded from the discovery results.
  Further, added support for a `boolean` property
  `ignoreFilesConfigForDiscovery`, which controls how a granule's files are
  filtered at discovery time.

## [v1.14.2] - 2019-10-08

### BREAKING CHANGES

Your Cumulus Message Adapter version should be pinned to `v1.0.13` or lower in your `app/config.yml` using `message_adapter_version: v1.0.13` OR you should use the workflow migration steps below to work with CMA v1.1.1+.

- **CUMULUS-1394** - The implementation of the `SfSnsReport` Lambda requires additional environment variables for integration with the new ingest notification SNS topics. Therefore, **you must update the definition of `SfSnsReport` in your `lambdas.yml` like so**:

```yaml
SfSnsReport:
  handler: index.handler
  timeout: 300
  source: node_modules/@cumulus/sf-sns-report/dist
  tables:
    - ExecutionsTable
  envs:
    execution_sns_topic_arn:
      function: Ref
      value: reportExecutionsSns
    granule_sns_topic_arn:
      function: Ref
      value: reportGranulesSns
    pdr_sns_topic_arn:
      function: Ref
      value: reportPdrsSns
```

- **CUMULUS-1447** -
  The newest release of the Cumulus Message Adapter (v1.1.1) requires that parameterized configuration be used for remote message functionality. Once released, Kes will automatically bring in CMA v1.1.1 without additional configuration.

  **Migration instructions**
  Oversized messages are no longer written to S3 automatically. In order to utilize remote messaging functionality, configure a `ReplaceConfig` AWS Step Function parameter on your CMA task:

  ```yaml
  ParsePdr:
    Parameters:
      cma:
        event.$: "$"
        ReplaceConfig:
          FullMessage: true
  ```

  Accepted fields in `ReplaceConfig` include `MaxSize`, `FullMessage`, `Path` and `TargetPath`.
  See https://github.com/nasa/cumulus-message-adapter/blob/master/CONTRACT.md#remote-message-configuration for full details.

  As this change is backward compatible in Cumulus Core, users wishing to utilize the previous version of the CMA may opt to transition to using a CMA lambda layer, or set `message_adapter_version` in their configuration to a version prior to v1.1.0.

### PLEASE NOTE

- **CUMULUS-1394** - Ingest notifications are now provided via 3 separate SNS topics for executions, granules, and PDRs, instead of a single `sftracker` SNS topic. Whereas the `sftracker` SNS topic received a full Cumulus execution message, the new topics all receive generated records for the given object. The new topics are only published to if the given object exists for the current execution. For a given execution/granule/PDR, **two messages will be received by each topic**: one message indicating that ingest is running and another message indicating that ingest has completed or failed. The new SNS topics are:

  - `reportExecutions` - Receives 1 message per execution
  - `reportGranules` - Receives 1 message per granule in an execution
  - `reportPdrs` - Receives 1 message per PDR

### Added

- **CUMULUS-639**

  - Adds SAML JWT and launchpad token authentication to Cumulus API (configurable)
    - **NOTE** to authenticate with Launchpad ensure your launchpad user_id is in the `<prefix>-UsersTable`
    - when Cumulus configured to protect API via Launchpad:
      - New endpoints
        - `GET /saml/login` - starting point for SAML SSO creates the login request url and redirects to the SAML Identity Provider Service (IDP)
        - `POST /saml/auth` - SAML Assertion Consumer Service. POST receiver from SAML IDP. Validates response, logs the user in, and returnes a SAML-based JWT.
    - Disabled endpoints
      - `POST /refresh`
      - Changes authorization worklow:
      - `ensureAuthorized` now presumes the bearer token is a JWT and tries to validate. If the token is malformed, it attempts to validate the token against Launchpad. This allows users to bring their own token as described here https://wiki.earthdata.nasa.gov/display/CUMULUS/Cumulus+API+with+Launchpad+Authentication. But it also allows dashboard users to manually authenticate via Launchpad SAML to receive a Launchpad-based JWT.

- **CUMULUS-1394**
  - Added `Granule.generateGranuleRecord()` method to granules model to generate a granule database record from a Cumulus execution message
  - Added `Pdr.generatePdrRecord()` method to PDRs model to generate a granule database record from a Cumulus execution message
  - Added helpers to `@cumulus/common/message`:
    - `getMessageExecutionName()` - Get the execution name from a Cumulus execution message
    - `getMessageStateMachineArn()` - Get the state machine ARN from a Cumulus execution message
    - `getMessageExecutionArn()` - Get the execution ARN for a Cumulus execution message
    - `getMessageGranules()` - Get the granules from a Cumulus execution message, if any.
  - Added `@cumulus/common/cloudwatch-event/isFailedSfStatus()` to determine if a Step Function status from a Cloudwatch event is a failed status

### Changed

- **CUMULUS-1308**

  - HTTP PUT of a Collection, Provider, or Rule via the Cumulus API now
    performs full replacement of the existing object with the object supplied
    in the request payload. Previous behavior was to perform a modification
    (partial update) by merging the existing object with the (possibly partial)
    object in the payload, but this did not conform to the HTTP standard, which
    specifies PATCH as the means for modifications rather than replacements.

- **CUMULUS-1375**

  - Migrate Cumulus from deprecated Elasticsearch JS client to new, supported one in `@cumulus/api`

- **CUMULUS-1485** Update `@cumulus/cmr-client` to return error message from CMR for validation failures.

- **CUMULUS-1394**

  - Renamed `Execution.generateDocFromPayload()` to `Execution.generateRecord()` on executions model. The method generates an execution database record from a Cumulus execution message.

- **CUMULUS-1432**

  - `logs` endpoint takes the level parameter as a string and not a number
  - Elasticsearch term query generation no longer converts numbers to boolean

- **CUMULUS-1447**

  - Consolidated all remote message handling code into @common/aws
  - Update remote message code to handle updated CMA remote message flags
  - Update example SIPS workflows to utilize Parameterized CMA configuration

- **CUMULUS-1448** Refactor workflows that are mutating cumulus_meta to utilize meta field

- **CUMULUS-1451**

  - Elasticsearch cluster setting `auto_create_index` will be set to false. This had been causing issues in the bootstrap lambda on deploy.

- **CUMULUS-1456**
  - `@cumulus/api` endpoints default error handler uses `boom` package to format errors, which is consistent with other API endpoint errors.

### Fixed

- **CUMULUS-1432** `logs` endpoint filter correctly filters logs by level
- **CUMULUS-1484** `useMessageAdapter` now does not set CUMULUS_MESSAGE_ADAPTER_DIR when `true`

### Removed

- **CUMULUS-1394**
  - Removed `sfTracker` SNS topic. Replaced by three new SNS topics for granule, execution, and PDR ingest notifications.
  - Removed unused functions from `@cumulus/common/aws`:
    - `getGranuleS3Params()`
    - `setGranuleStatus()`

## [v1.14.1] - 2019-08-29

### Fixed

- **CUMULUS-1455**

  - CMR token links updated to point to CMR legacy services rather than echo

- **CUMULUS-1211**
  - Errors thrown during granule discovery are no longer swallowed and ignored.
    Rather, errors are propagated to allow for proper error-handling and
    meaningful messaging.

## [v1.14.0] - 2019-08-22

### PLEASE NOTE

- We have encountered transient lambda service errors in our integration testing. Please handle transient service errors following [these guidelines](https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html). The workflows in the `example/workflows` folder have been updated with retries configured for these errors.

- **CUMULUS-799** added additional IAM permissions to support reading CloudWatch and API Gateway, so **you will have to redeploy your IAM stack.**

- **CUMULUS-800** Several items:

  - **Delete existing API Gateway stages**: To allow enabling of API Gateway logging, Cumulus now creates and manages a Stage resource during deployment. Before upgrading Cumulus, it is necessary to delete the API Gateway stages on both the Backend API and the Distribution API. Instructions are included in the documenation under [Delete API Gateway Stages](https://nasa.github.io/cumulus/docs/additional-deployment-options/delete-api-gateway-stages).

  - **Set up account permissions for API Gateway to write to CloudWatch**: In a one time operation for your AWS account, to enable CloudWatch Logs for API Gateway, you must first grant the API Gateway permission to read and write logs to CloudWatch for your account. The `AmazonAPIGatewayPushToCloudWatchLogs` managed policy (with an ARN of `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`) has all the required permissions. You can find a simple how to in the documentation under [Enable API Gateway Logging.](https://nasa.github.io/cumulus/docs/additional-deployment-options/enable-gateway-logging-permissions)

  - **Configure API Gateway to write logs to CloudWatch** To enable execution logging for the distribution API set `config.yaml` `apiConfigs.distribution.logApigatewayToCloudwatch` value to `true`. More information [Enable API Gateway Logs](https://nasa.github.io/cumulus/docs/additional-deployment-options/enable-api-logs)

  - **Configure CloudWatch log delivery**: It is possible to deliver CloudWatch API execution and access logs to a cross-account shared AWS::Logs::Destination. An operator does this by adding the key `logToSharedDestination` to the `config.yml` at the default level with a value of a writable log destination. More information in the documenation under [Configure CloudWatch Logs Delivery.](https://nasa.github.io/cumulus/docs/additional-deployment-options/configure-cloudwatch-logs-delivery)

  - **Additional Lambda Logging**: It is now possible to configure any lambda to deliver logs to a shared subscriptions by setting `logToSharedDestination` to the ARN of a writable location (either an AWS::Logs::Destination or a Kinesis Stream) on any lambda config. Documentation for [Lambda Log Subscriptions](https://nasa.github.io/cumulus/docs/additional-deployment-options/additional-lambda-logging)

  - **Configure S3 Server Access Logs**: If you are running Cumulus in an NGAP environment you may [configure S3 Server Access Logs](https://nasa.github.io/cumulus/docs/next/deployment/server_access_logging) to be delivered to a shared bucket where the Metrics Team will ingest the logs into their ELK stack. Contact the Metrics team for permission and location.

- **CUMULUS-1368** The Cumulus distribution API has been deprecated and is being replaced by ASF's Thin Egress App. By default, the distribution API will not deploy. Please follow [the instructions for deploying and configuring Thin Egress](https://nasa.github.io/cumulus/docs/deployment/thin_egress_app).

To instead continue to deploy and use the legacy Cumulus distribution app, add the following to your `config.yml`:

```yaml
deployDistributionApi: true
```

If you deploy with no distribution app your deployment will succeed but you may encounter errors in your workflows, particularly in the `MoveGranule` task.

- **CUMULUS-1418** Users who are packaging the CMA in their Lambdas outside of Cumulus may need to update their Lambda configuration. Please see `BREAKING CHANGES` below for details.

### Added

- **CUMULUS-642**
  - Adds Launchpad as an authentication option for the Cumulus API.
  - Updated deployment documentation and added [instructions to setup Cumulus API Launchpad authentication](https://wiki.earthdata.nasa.gov/display/CUMULUS/Cumulus+API+with+Launchpad+Authentication)
- **CUMULUS-1418**
  - Adds usage docs/testing of lambda layers (introduced in PR1125), updates Core example tasks to use the updated `cumulus-ecs-task` and a CMA layer instead of kes CMA injection.
  - Added Terraform module to publish CMA as layer to user account.
- **PR1125** - Adds `layers` config option to support deploying Lambdas with layers
- **PR1128** - Added `useXRay` config option to enable AWS X-Ray for Lambdas.
- **CUMULUS-1345**
  - Adds new variables to the app deployment under `cmr`.
  - `cmrEnvironment` values are `SIT`, `UAT`, or `OPS` with `UAT` as the default.
  - `cmrLimit` and `cmrPageSize` have been added as configurable options.
- **CUMULUS-1273**
  - Added lambda function EmsProductMetadataReport to generate EMS Product Metadata report
- **CUMULUS-1226**
  - Added API endpoint `elasticsearch/index-from-database` to index to an Elasticsearch index from the database for recovery purposes and `elasticsearch/indices-status` to check the status of Elasticsearch indices via the API.
- **CUMULUS-824**
  - Added new Collection parameter `reportToEms` to configure whether the collection is reported to EMS
- **CUMULUS-1357**
  - Added new BackendApi endpoint `ems` that generates EMS reports.
- **CUMULUS-1241**
  - Added information about queues with maximum execution limits defined to default workflow templates (`meta.queueExecutionLimits`)
- **CUMULUS-1311**
  - Added `@cumulus/common/message` with various message parsing/preparation helpers
- **CUMULUS-812**

  - Added support for limiting the number of concurrent executions started from a queue. [See the data cookbook](https://nasa.github.io/cumulus/docs/data-cookbooks/throttling-queued-executions) for more information.

- **CUMULUS-1337**

  - Adds `cumulus.stackName` value to the `instanceMetadata` endpoint.

- **CUMULUS-1368**

  - Added `cmrGranuleUrlType` to the `@cumulus/move-granules` task. This determines what kind of links go in the CMR files. The options are `distribution`, `s3`, or `none`, with the default being distribution. If there is no distribution API being used with Cumulus, you must set the value to `s3` or `none`.

- Added `packages/s3-replicator` Terraform module to allow same-region s3 replication to metrics bucket.

- **CUMULUS-1392**

  - Added `tf-modules/report-granules` Terraform module which processes granule ingest notifications received via SNS and stores granule data to a database. The module includes:
    - SNS topic for publishing granule ingest notifications
    - Lambda to process granule notifications and store data
    - IAM permissions for the Lambda
    - Subscription for the Lambda to the SNS topic

- **CUMULUS-1393**

  - Added `tf-modules/report-pdrs` Terraform module which processes PDR ingest notifications received via SNS and stores PDR data to a database. The module includes:
    - SNS topic for publishing PDR ingest notifications
    - Lambda to process PDR notifications and store data
    - IAM permissions for the Lambda
    - Subscription for the Lambda to the SNS topic
  - Added unit tests for `@cumulus/api/models/pdrs.createPdrFromSns()`

- **CUMULUS-1400**

  - Added `tf-modules/report-executions` Terraform module which processes workflow execution information received via SNS and stores it to a database. The module includes:
    - SNS topic for publishing execution data
    - Lambda to process and store execution data
    - IAM permissions for the Lambda
    - Subscription for the Lambda to the SNS topic
  - Added `@cumulus/common/sns-event` which contains helpers for SNS events:
    - `isSnsEvent()` returns true if event is from SNS
    - `getSnsEventMessage()` extracts and parses the message from an SNS event
    - `getSnsEventMessageObject()` extracts and parses message object from an SNS event
  - Added `@cumulus/common/cloudwatch-event` which contains helpers for Cloudwatch events:
    - `isSfExecutionEvent()` returns true if event is from Step Functions
    - `isTerminalSfStatus()` determines if a Step Function status from a Cloudwatch event is a terminal status
    - `getSfEventStatus()` gets the Step Function status from a Cloudwatch event
    - `getSfEventDetailValue()` extracts a Step Function event detail field from a Cloudwatch event
    - `getSfEventMessageObject()` extracts and parses Step Function detail object from a Cloudwatch event

- **CUMULUS-1429**

  - Added `tf-modules/data-persistence` Terraform module which includes resources for data persistence in Cumulus:
    - DynamoDB tables
    - Elasticsearch with optional support for VPC
    - Cloudwatch alarm for number of Elasticsearch nodes

- **CUMULUS-1379** CMR Launchpad Authentication
  - Added `launchpad` configuration to `@cumulus/deployment/app/config.yml`, and cloudformation templates, workflow message, lambda configuration, api endpoint configuration
  - Added `@cumulus/common/LaunchpadToken` and `@cumulus/common/launchpad` to provide methods to get token and validate token
  - Updated lambdas to use Launchpad token for CMR actions (ingest and delete granules)
  - Updated deployment documentation and added [instructions to setup CMR client for Launchpad authentication](https://wiki.earthdata.nasa.gov/display/CUMULUS/CMR+Launchpad+Authentication)

## Changed

- **CUMULUS-1232**

  - Added retries to update `@cumulus/cmr-client` `updateToken()`

- **CUMULUS-1245 CUMULUS-795**

  - Added additional `ems` configuration parameters for sending the ingest reports to EMS
  - Added functionality to send daily ingest reports to EMS

- **CUMULUS-1241**

  - Removed the concept of "priority levels" and added ability to define a number of maximum concurrent executions per SQS queue
  - Changed mapping of Cumulus message properties for the `sqs2sfThrottle` lambda:
    - Queue name is read from `cumulus_meta.queueName`
    - Maximum executions for the queue is read from `meta.queueExecutionLimits[queueName]`, where `queueName` is `cumulus_meta.queueName`
  - Changed `sfSemaphoreDown` lambda to only attempt decrementing semaphores when:
    - the message is for a completed/failed/aborted/timed out workflow AND
    - `cumulus_meta.queueName` exists on the Cumulus message AND
    - An entry for the queue name (`cumulus_meta.queueName`) exists in the the object `meta.queueExecutionLimits` on the Cumulus message

- **CUMULUS-1338**

  - Updated `sfSemaphoreDown` lambda to be triggered via AWS Step Function Cloudwatch events instead of subscription to `sfTracker` SNS topic

- **CUMULUS-1311**

  - Updated `@cumulus/queue-granules` to set `cumulus_meta.queueName` for queued execution messages
  - Updated `@cumulus/queue-pdrs` to set `cumulus_meta.queueName` for queued execution messages
  - Updated `sqs2sfThrottle` lambda to immediately decrement queue semaphore value if dispatching Step Function execution throws an error

- **CUMULUS-1362**

  - Granule `processingStartTime` and `processingEndTime` will be set to the execution start time and end time respectively when there is no sync granule or post to cmr task present in the workflow

- **CUMULUS-1400**
  - Deprecated `@cumulus/ingest/aws/getExecutionArn`. Use `@cumulus/common/aws/getExecutionArn` instead.

### Fixed

- **CUMULUS-1439**

  - Fix bug with rule.logEventArn deletion on Kinesis rule update and fix unit test to verify

- **CUMULUS-796**

  - Added production information (collection ShortName and Version, granuleId) to EMS distribution report
  - Added functionality to send daily distribution reports to EMS

- **CUMULUS-1319**

  - Fixed a bug where granule ingest times were not being stored to the database

- **CUMULUS-1356**

  - The `Collection` model's `delete` method now _removes_ the specified item
    from the collection config store that was inserted by the `create` method.
    Previously, this behavior was missing.

- **CUMULUS-1374**
  - Addressed audit concerns (https://www.npmjs.com/advisories/782) in api package

### BREAKING CHANGES

### Changed

- **CUMULUS-1418**
  - Adding a default `cmaDir` key to configuration will cause `CUMULUS_MESSAGE_ADAPTER_DIR` to be set by default to `/opt` for any Lambda not setting `useCma` to true, or explicitly setting the CMA environment variable. In lambdas that package the CMA independently of the Cumulus packaging. Lambdas manually packaging the CMA should have their Lambda configuration updated to set the CMA path, or alternately if not using the CMA as a Lambda layer in this deployment set `cmaDir` to `./cumulus-message-adapter`.

### Removed

- **CUMULUS-1337**

  - Removes the S3 Access Metrics package added in CUMULUS-799

- **PR1130**
  - Removed code deprecated since v1.11.1:
    - Removed `@cumulus/common/step-functions`. Use `@cumulus/common/StepFunctions` instead.
    - Removed `@cumulus/api/lib/testUtils.fakeFilesFactory`. Use `@cumulus/api/lib/testUtils.fakeFileFactory` instead.
    - Removed `@cumulus/cmrjs/cmr` functions: `searchConcept`, `ingestConcept`, `deleteConcept`. Use the functions in `@cumulus/cmr-client` instead.
    - Removed `@cumulus/ingest/aws.getExecutionHistory`. Use `@cumulus/common/StepFunctions.getExecutionHistory` instead.

## [v1.13.5] - 2019-08-29 - [BACKPORT]

### Fixed

- **CUMULUS-1455** - CMR token links updated to point to CMR legacy services rather than echo

## [v1.13.4] - 2019-07-29

- **CUMULUS-1411** - Fix deployment issue when using a template override

## [v1.13.3] - 2019-07-26

- **CUMULUS-1345** Full backport of CUMULUS-1345 features - Adds new variables to the app deployment under `cmr`.
  - `cmrEnvironment` values are `SIT`, `UAT`, or `OPS` with `UAT` as the default.
  - `cmrLimit` and `cmrPageSize` have been added as configurable options.

## [v1.13.2] - 2019-07-25

- Re-release of v1.13.1 to fix broken npm packages.

## [v1.13.1] - 2019-07-22

- **CUMULUS-1374** - Resolve audit compliance with lodash version for api package subdependency
- **CUMULUS-1412** - Resolve audit compliance with googleapi package
- **CUMULUS-1345** - Backported CMR environment setting in getUrl to address immediate user need. CMR_ENVIRONMENT can now be used to set the CMR environment to OPS/SIT

## [v1.13.0] - 2019-5-20

### PLEASE NOTE

**CUMULUS-802** added some additional IAM permissions to support ECS autoscaling, so **you will have to redeploy your IAM stack.**
As a result of the changes for **CUMULUS-1193**, **CUMULUS-1264**, and **CUMULUS-1310**, **you must delete your existing stacks (except IAM) before deploying this version of Cumulus.**
If running Cumulus within a VPC and extended downtime is acceptable, we recommend doing this at the end of the day to allow AWS backend resources and network interfaces to be cleaned up overnight.

### BREAKING CHANGES

- **CUMULUS-1228**

  - The default AMI used by ECS instances is now an NGAP-compliant AMI. This
    will be a breaking change for non-NGAP deployments. If you do not deploy to
    NGAP, you will need to find the AMI ID of the
    [most recent Amazon ECS-optimized AMI](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html),
    and set the `ecs.amiid` property in your config. Instructions for finding
    the most recent NGAP AMI can be found using
    [these instructions](https://wiki.earthdata.nasa.gov/display/ESKB/Select+an+NGAP+Created+AMI).

- **CUMULUS-1310**

  - Database resources (DynamoDB, ElasticSearch) have been moved to an independent `db` stack.
    Migrations for this version will need to be user-managed. (e.g. [elasticsearch](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-version-migration.html#snapshot-based-migration) and [dynamoDB](https://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/dp-template-exports3toddb.html)).
    Order of stack deployment is `iam` -> `db` -> `app`.
  - All stacks can now be deployed using a single `config.yml` file, i.e.: `kes cf deploy --kes-folder app --template node_modules/@cumulus/deployment/[iam|db|app] [...]`
    Backwards-compatible. For development, please re-run `npm run bootstrap` to build new `kes` overrides.
    Deployment docs have been updated to show how to deploy a single-config Cumulus instance.
  - `params` have been moved: Nest `params` fields under `app`, `db` or `iam` to override all Parameters for a particular stack's cloudformation template. Backwards-compatible with multi-config setups.
  - `stackName` and `stackNameNoDash` have been retired. Use `prefix` and `prefixNoDash` instead.
  - The `iams` section in `app/config.yml` IAM roles has been deprecated as a user-facing parameter,
    _unless_ your IAM role ARNs do not match the convention shown in `@cumulus/deployment/app/config.yml`
  - The `vpc.securityGroup` will need to be set with a pre-existing security group ID to use Cumulus in a VPC. Must allow inbound HTTP(S) (Port 443).

- **CUMULUS-1212**

  - `@cumulus/post-to-cmr` will now fail if any granules being processed are missing a metadata file. You can set the new config option `skipMetaCheck` to `true` to pass post-to-cmr without a metadata file.

- **CUMULUS-1232**

  - `@cumulus/sync-granule` will no longer silently pass if no checksum data is provided. It will use input
    from the granule object to:
    - Verify checksum if `checksumType` and `checksumValue` are in the file record OR a checksum file is provided
      (throws `InvalidChecksum` on fail), else log warning that no checksum is available.
    - Then, verify synced S3 file size if `file.size` is in the file record (throws `UnexpectedFileSize` on fail),
      else log warning that no file size is available.
    - Pass the step.

- **CUMULUS-1264**

  - The Cloudformation templating and deployment configuration has been substantially refactored.
    - `CumulusApiDefault` nested stack resource has been renamed to `CumulusApiDistribution`
    - `CumulusApiV1` nested stack resource has been renamed to `CumulusApiBackend`
  - The `urs: true` config option for when defining your lambdas (e.g. in `lambdas.yml`) has been deprecated. There are two new options to replace it:
    - `urs_redirect: 'token'`: This will expose a `TOKEN_REDIRECT_ENDPOINT` environment variable to your lambda that references the `/token` endpoint on the Cumulus backend API
    - `urs_redirect: 'distribution'`: This will expose a `DISTRIBUTION_REDIRECT_ENDPOINT` environment variable to your lambda that references the `/redirect` endpoint on the Cumulus distribution API

- **CUMULUS-1193**

  - The elasticsearch instance is moved behind the VPC.
  - Your account will need an Elasticsearch Service Linked role. This is a one-time setup for the account. You can follow the instructions to use the AWS console or AWS CLI [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/using-service-linked-roles.html) or use the following AWS CLI command: `aws iam create-service-linked-role --aws-service-name es.amazonaws.com`

- **CUMULUS-802**

  - ECS `maxInstances` must be greater than `minInstances`. If you use defaults, no change is required.

- **CUMULUS-1269**
  - Brought Cumulus data models in line with CNM JSON schema:
    - Renamed file object `fileType` field to `type`
    - Renamed file object `fileSize` field to `size`
    - Renamed file object `checksumValue` field to `checksum` where not already done.
    - Added `ancillary` and `linkage` type support to file objects.

### Added

- **CUMULUS-799**

  - Added an S3 Access Metrics package which will take S3 Server Access Logs and
    write access metrics to CloudWatch

- **CUMULUS-1242** - Added `sqs2sfThrottle` lambda. The lambda reads SQS messages for queued executions and uses semaphores to only start new executions if the maximum number of executions defined for the priority key (`cumulus_meta.priorityKey`) has not been reached. Any SQS messages that are read but not used to start executions remain in the queue.

- **CUMULUS-1240**

  - Added `sfSemaphoreDown` lambda. This lambda receives SNS messages and for each message it decrements the semaphore used to track the number of running executions if:
    - the message is for a completed/failed workflow AND
    - the message contains a level of priority (`cumulus_meta.priorityKey`)
  - Added `sfSemaphoreDown` lambda as a subscriber to the `sfTracker` SNS topic

- **CUMULUS-1265**

  - Added `apiConfigs` configuration option to configure API Gateway to be private
  - All internal lambdas configured to run inside the VPC by default
  - Removed references to `NoVpc` lambdas from documentation and `example` folder.

- **CUMULUS-802**
  - Adds autoscaling of ECS clusters
  - Adds autoscaling of ECS services that are handling StepFunction activities

## Changed

- Updated `@cumulus/ingest/http/httpMixin.list()` to trim trailing spaces on discovered filenames

- **CUMULUS-1310**

  - Database resources (DynamoDB, ElasticSearch) have been moved to an independent `db` stack.
    This will enable future updates to avoid affecting database resources or requiring migrations.
    Migrations for this version will need to be user-managed.
    (e.g. [elasticsearch](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-version-migration.html#snapshot-based-migration) and [dynamoDB](https://docs.aws.amazon.com/datapipeline/latest/DeveloperGuide/dp-template-exports3toddb.html)).
    Order of stack deployment is `iam` -> `db` -> `app`.
  - All stacks can now be deployed using a single `config.yml` file, i.e.: `kes cf deploy --kes-folder app --template node_modules/@cumulus/deployment/[iam|db|app] [...]`
    Backwards-compatible. Please re-run `npm run bootstrap` to build new `kes` overrides.
    Deployment docs have been updated to show how to deploy a single-config Cumulus instance.
  - `params` fields should now be nested under the stack key (i.e. `app`, `db` or `iam`) to provide Parameters for a particular stack's cloudformation template,
    for use with single-config instances. Keys _must_ match the name of the deployment package folder (`app`, `db`, or `iam`).
    Backwards-compatible with multi-config setups.
  - `stackName` and `stackNameNoDash` have been retired as user-facing config parameters. Use `prefix` and `prefixNoDash` instead.
    This will be used to create stack names for all stacks in a single-config use case.
    `stackName` may still be used as an override in multi-config usage, although this is discouraged.
    Warning: overriding the `db` stack's `stackName` will require you to set `dbStackName` in your `app/config.yml`.
    This parameter is required to fetch outputs from the `db` stack to reference in the `app` stack.
  - The `iams` section in `app/config.yml` IAM roles has been retired as a user-facing parameter,
    _unless_ your IAM role ARNs do not match the convention shown in `@cumulus/deployment/app/config.yml`
    In that case, overriding `iams` in your own config is recommended.
  - `iam` and `db` `cloudformation.yml` file names will have respective prefixes (e.g `iam.cloudformation.yml`).
  - Cumulus will now only attempt to create reconciliation reports for buckets of the `private`, `public` and `protected` types.
  - Cumulus will no longer set up its own security group.
    To pass a pre-existing security group for in-VPC deployments as a parameter to the Cumulus template, populate `vpc.securityGroup` in `config.yml`.
    This security group must allow inbound HTTP(S) traffic (Port 443). SSH traffic (Port 22) must be permitted for SSH access to ECS instances.
  - Deployment docs have been updated with examples for the new deployment model.

- **CUMULUS-1236**

  - Moves access to public files behind the distribution endpoint. Authentication is not required, but direct http access has been disallowed.

- **CUMULUS-1223**

  - Adds unauthenticated access for public bucket files to the Distribution API. Public files should be requested the same way as protected files, but for public files a redirect to a self-signed S3 URL will happen without requiring authentication with Earthdata login.

- **CUMULUS-1232**

  - Unifies duplicate handling in `ingest/granule.handleDuplicateFile` for maintainability.
  - Changed `ingest/granule.ingestFile` and `move-granules/index.moveFileRequest` to use new function.
  - Moved file versioning code to `ingest/granule.moveGranuleFileWithVersioning`
  - `ingest/granule.verifyFile` now also tests `file.size` for verification if it is in the file record and throws
    `UnexpectedFileSize` error for file size not matching input.
  - `ingest/granule.verifyFile` logs warnings if checksum and/or file size are not available.

- **CUMULUS-1193**

  - Moved reindex CLI functionality to an API endpoint. See [API docs](https://nasa.github.io/cumulus-api/#elasticsearch-1)

- **CUMULUS-1207**
  - No longer disable lambda event source mappings when disabling a rule

### Fixed

- Updated Lerna publish script so that published Cumulus packages will pin their dependencies on other Cumulus packages to exact versions (e.g. `1.12.1` instead of `^1.12.1`)

- **CUMULUS-1203**

  - Fixes IAM template's use of intrinsic functions such that IAM template overrides now work with kes

- **CUMULUS-1268**
  - Deployment will not fail if there are no ES alarms or ECS services

## [v1.12.1] - 2019-4-8

## [v1.12.0] - 2019-4-4

Note: There was an issue publishing 1.12.0. Upgrade to 1.12.1.

### BREAKING CHANGES

- **CUMULUS-1139**

  - `granule.applyWorkflow` uses the new-style granule record as input to workflows.

- **CUMULUS-1171**

  - Fixed provider handling in the API to make it consistent between protocols.
    NOTE: This is a breaking change. When applying this upgrade, users will need to:
    1. Disable all workflow rules
    2. Update any `http` or `https` providers so that the host field only
       contains a valid hostname or IP address, and the port field contains the
       provider port.
    3. Perform the deployment
    4. Re-enable workflow rules

- **CUMULUS-1176**:

  - `@cumulus/move-granules` input expectations have changed. `@cumulus/files-to-granules` is a new intermediate task to perform input translation in the old style.
    See the Added and Changed sections of this release changelog for more information.

- **CUMULUS-670**

  - The behavior of ParsePDR and related code has changed in this release. PDRs with FILE_TYPEs that do not conform to the PDR ICD (+ TGZ) (https://cdn.earthdata.nasa.gov/conduit/upload/6376/ESDS-RFC-030v1.0.pdf) will fail to parse.

- **CUMULUS-1208**
  - The granule object input to `@cumulus/queue-granules` will now be added to ingest workflow messages **as is**. In practice, this means that if you are using `@cumulus/queue-granules` to trigger ingest workflows and your granule objects input have invalid properties, then your ingest workflows will fail due to schema validation errors.

### Added

- **CUMULUS-777**
  - Added new cookbook entry on configuring Cumulus to track ancillary files.
- **CUMULUS-1183**
  - Kes overrides will now abort with a warning if a workflow step is configured without a corresponding
    lambda configuration
- **CUMULUS-1223**

  - Adds convenience function `@cumulus/common/bucketsConfigJsonObject` for fetching stack's bucket configuration as an object.

- **CUMULUS-853**
  - Updated FakeProcessing example lambda to include option to generate fake browse
  - Added feature documentation for ancillary metadata export, a new cookbook entry describing a workflow with ancillary metadata generation(browse), and related task definition documentation
- **CUMULUS-805**
  - Added a CloudWatch alarm to check running ElasticSearch instances, and a CloudWatch dashboard to view the health of ElasticSearch
  - Specify `AWS_REGION` in `.env` to be used by deployment script
- **CUMULUS-803**
  - Added CloudWatch alarms to check running tasks of each ECS service, and add the alarms to CloudWatch dashboard
- **CUMULUS-670**
  - Added Ancillary Metadata Export feature (see https://nasa.github.io/cumulus/docs/features/ancillary_metadata for more information)
  - Added new Collection file parameter "fileType" that allows configuration of workflow granule file fileType
- **CUMULUS-1184** - Added kes logging output to ensure we always see the state machine reference before failures due to configuration
- **CUMULUS-1105** - Added a dashboard endpoint to serve the dashboard from an S3 bucket
- **CUMULUS-1199** - Moves `s3credentials` endpoint from the backend to the distribution API.
- **CUMULUS-666**
  - Added `@api/endpoints/s3credentials` to allow EarthData Login authorized users to retrieve temporary security credentials for same-region direct S3 access.
- **CUMULUS-671**
  - Added `@packages/integration-tests/api/distribution/getDistributionApiS3SignedUrl()` to return the S3 signed URL for a file protected by the distribution API
- **CUMULUS-672**
  - Added `cmrMetadataFormat` and `cmrConceptId` to output for individual granules from `@cumulus/post-to-cmr`. `cmrMetadataFormat` will be read from the `cmrMetadataFormat` generated for each granule in `@cumulus/cmrjs/publish2CMR()`
  - Added helpers to `@packages/integration-tests/api/distribution`:
    - `getDistributionApiFileStream()` returns a stream to download files protected by the distribution API
    - `getDistributionFileUrl()` constructs URLs for requesting files from the distribution API
- **CUMULUS-1185** `@cumulus/api/models/Granule.removeGranuleFromCmrByGranule` to replace `@cumulus/api/models/Granule.removeGranuleFromCmr` and use the Granule UR from the CMR metadata to remove the granule from CMR

- **CUMULUS-1101**

  - Added new `@cumulus/checksum` package. This package provides functions to calculate and validate checksums.
  - Added new checksumming functions to `@cumulus/common/aws`: `calculateS3ObjectChecksum` and `validateS3ObjectChecksum`, which depend on the `checksum` package.

- CUMULUS-1171

  - Added `@cumulus/common` API documentation to `packages/common/docs/API.md`
  - Added an `npm run build-docs` task to `@cumulus/common`
  - Added `@cumulus/common/string#isValidHostname()`
  - Added `@cumulus/common/string#match()`
  - Added `@cumulus/common/string#matches()`
  - Added `@cumulus/common/string#toLower()`
  - Added `@cumulus/common/string#toUpper()`
  - Added `@cumulus/common/URLUtils#buildURL()`
  - Added `@cumulus/common/util#isNil()`
  - Added `@cumulus/common/util#isNull()`
  - Added `@cumulus/common/util#isUndefined()`
  - Added `@cumulus/common/util#negate()`

- **CUMULUS-1176**

  - Added new `@cumulus/files-to-granules` task to handle converting file array output from `cumulus-process` tasks into granule objects.
    Allows simplification of `@cumulus/move-granules` and `@cumulus/post-to-cmr`, see Changed section for more details.

- CUMULUS-1151 Compare the granule holdings in CMR with Cumulus' internal data store
- CUMULUS-1152 Compare the granule file holdings in CMR with Cumulus' internal data store

### Changed

- **CUMULUS-1216** - Updated `@cumulus/ingest/granule/ingestFile` to download files to expected staging location.
- **CUMULUS-1208** - Updated `@cumulus/ingest/queue/enqueueGranuleIngestMessage()` to not transform granule object passed to it when building an ingest message
- **CUMULUS-1198** - `@cumulus/ingest` no longer enforces any expectations about whether `provider_path` contains a leading slash or not.
- **CUMULUS-1170**
  - Update scripts and docs to use `npm` instead of `yarn`
  - Use `package-lock.json` files to ensure matching versions of npm packages
  - Update CI builds to use `npm ci` instead of `npm install`
- **CUMULUS-670**
  - Updated ParsePDR task to read standard PDR types+ (+ tgz as an external customer requirement) and add a fileType to granule-files on Granule discovery
  - Updated ParsePDR to fail if unrecognized type is used
  - Updated all relevant task schemas to include granule->files->filetype as a string value
  - Updated tests/test fixtures to include the fileType in the step function/task inputs and output validations as needed
  - Updated MoveGranules task to handle incoming configuration with new "fileType" values and to add them as appropriate to the lambda output.
  - Updated DiscoverGranules step/related workflows to read new Collection file parameter fileType that will map a discovered file to a workflow fileType
  - Updated CNM parser to add the fileType to the defined granule file fileType on ingest and updated integration tests to verify/validate that behavior
  - Updated generateEcho10XMLString in cmr-utils.js to use a map/related library to ensure order as CMR requires ordering for their online resources.
  - Updated post-to-cmr task to appropriately export CNM filetypes to CMR in echo10/UMM exports
- **CUMULUS-1139** - Granules stored in the API contain a `files` property. That schema has been greatly
  simplified and now better matches the CNM format.
  - The `name` property has been renamed to `fileName`.
  - The `filepath` property has been renamed to `key`.
  - The `checksumValue` property has been renamed to `checksum`.
  - The `path` property has been removed.
  - The `url_path` property has been removed.
  - The `filename` property (which contained an `s3://` URL) has been removed, and the `bucket`
    and `key` properties should be used instead. Any requests sent to the API containing a `granule.files[].filename`
    property will be rejected, and any responses coming back from the API will not contain that
    `filename` property.
  - A `source` property has been added, which is a URL indicating the original source of the file.
  - `@cumulus/ingest/granule.moveGranuleFiles()` no longer includes a `filename` field in its
    output. The `bucket` and `key` fields should be used instead.
- **CUMULUS-672**

  - Changed `@cumulus/integration-tests/api/EarthdataLogin.getEarthdataLoginRedirectResponse` to `@cumulus/integration-tests/api/EarthdataLogin.getEarthdataAccessToken`. The new function returns an access response from Earthdata login, if successful.
  - `@cumulus/integration-tests/cmr/getOnlineResources` now accepts an object of options, including `cmrMetadataFormat`. Based on the `cmrMetadataFormat`, the function will correctly retrieve the online resources for each metadata format (ECHO10, UMM-G)

- **CUMULUS-1101**

  - Moved `@cumulus/common/file/getFileChecksumFromStream` into `@cumulus/checksum`, and renamed it to `generateChecksumFromStream`.
    This is a breaking change for users relying on `@cumulus/common/file/getFileChecksumFromStream`.
  - Refactored `@cumulus/ingest/Granule` to depend on new `common/aws` checksum functions and remove significantly present checksumming code.
    - Deprecated `@cumulus/ingest/granule.validateChecksum`. Replaced with `@cumulus/ingest/granule.verifyFile`.
    - Renamed `granule.getChecksumFromFile` to `granule.retrieveSuppliedFileChecksumInformation` to be more accurate.
  - Deprecated `@cumulus/common/aws.checksumS3Objects`. Use `@cumulus/common/aws.calculateS3ObjectChecksum` instead.

- CUMULUS-1171

  - Fixed provider handling in the API to make it consistent between protocols.
    Before this change, FTP providers were configured using the `host` and
    `port` properties. HTTP providers ignored `port` and `protocol`, and stored
    an entire URL in the `host` property. Updated the API to only accept valid
    hostnames or IP addresses in the `provider.host` field. Updated ingest code
    to properly build HTTP and HTTPS URLs from `provider.protocol`,
    `provider.host`, and `provider.port`.
  - The default provider port was being set to 21, no matter what protocol was
    being used. Removed that default.

- **CUMULUS-1176**

  - `@cumulus/move-granules` breaking change:
    Input to `move-granules` is now expected to be in the form of a granules object (i.e. `{ granules: [ { ... }, { ... } ] }`);
    For backwards compatibility with array-of-files outputs from processing steps, use the new `@cumulus/files-to-granules` task as an intermediate step.
    This task will perform the input translation. This change allows `move-granules` to be simpler and behave more predictably.
    `config.granuleIdExtraction` and `config.input_granules` are no longer needed/used by `move-granules`.
  - `@cumulus/post-to-cmr`: `config.granuleIdExtraction` is no longer needed/used by `post-to-cmr`.

- CUMULUS-1174
  - Better error message and stacktrace for S3KeyPairProvider error reporting.

### Fixed

- **CUMULUS-1218** Reconciliation report will now scan only completed granules.
- `@cumulus/api` files and granules were not getting indexed correctly because files indexing was failing in `db-indexer`
- `@cumulus/deployment` A bug in the Cloudformation template was preventing the API from being able to be launched in a VPC, updated the IAM template to give the permissions to be able to run the API in a VPC

### Deprecated

- `@cumulus/api/models/Granule.removeGranuleFromCmr`, instead use `@cumulus/api/models/Granule.removeGranuleFromCmrByGranule`
- `@cumulus/ingest/granule.validateChecksum`, instead use `@cumulus/ingest/granule.verifyFile`
- `@cumulus/common/aws.checksumS3Objects`, instead use `@cumulus/common/aws.calculateS3ObjectChecksum`
- `@cumulus/cmrjs`: `getGranuleId` and `getCmrFiles` are deprecated due to changes in input handling.

## [v1.11.3] - 2019-3-5

### Added

- **CUMULUS-1187** - Added `@cumulus/ingest/granule/duplicateHandlingType()` to determine how duplicate files should be handled in an ingest workflow

### Fixed

- **CUMULUS-1187** - workflows not respecting the duplicate handling value specified in the collection
- Removed refreshToken schema requirement for OAuth

## [v1.11.2] - 2019-2-15

### Added

- CUMULUS-1169
  - Added a `@cumulus/common/StepFunctions` module. It contains functions for querying the AWS
    StepFunctions API. These functions have the ability to retry when a ThrottlingException occurs.
  - Added `@cumulus/common/aws.retryOnThrottlingException()`, which will wrap a function in code to
    retry on ThrottlingExceptions.
  - Added `@cumulus/common/test-utils.throttleOnce()`, which will cause a function to return a
    ThrottlingException the first time it is called, then return its normal result after that.
- CUMULUS-1103 Compare the collection holdings in CMR with Cumulus' internal data store
- CUMULUS-1099 Add support for UMMG JSON metadata versions > 1.4.
  - If a version is found in the metadata object, that version is used for processing and publishing to CMR otherwise, version 1.4 is assumed.
- CUMULUS-678
  - Added support for UMMG json v1.4 metadata files.
    `reconcileCMRMetadata` added to `@cumulus/cmrjs` to update metadata record with new file locations.
    `@cumulus/common/errors` adds two new error types `CMRMetaFileNotFound` and `InvalidArgument`.
    `@cumulus/common/test-utils` adds new function `randomId` to create a random string with id to help in debugging.
    `@cumulus/common/BucketsConfig` adds a new helper class `BucketsConfig` for working with bucket stack configuration and bucket names.
    `@cumulus/common/aws` adds new function `s3PutObjectTagging` as a convenience for the aws [s3().putObjectTagging](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObjectTagging-property) function.
    `@cumulus/cmrjs` Adds: - `isCMRFile` - Identify an echo10(xml) or UMMG(json) metadata file. - `metadataObjectFromCMRFile` Read and parse CMR XML file from s3. - `updateCMRMetadata` Modify a cmr metadata (xml/json) file with updated information. - `publish2CMR` Posts XML or UMMG CMR data to CMR service. - `reconcileCMRMetadata` Reconciles cmr metadata file after a file moves.
- Adds some ECS and other permissions to StepRole to enable running ECS tasks from a workflow
- Added Apache logs to cumulus api and distribution lambdas
- **CUMULUS-1119** - Added `@cumulus/integration-tests/api/EarthdataLogin.getEarthdataLoginRedirectResponse` helper for integration tests to handle login with Earthdata and to return response from redirect to Cumulus API
- **CUMULUS-673** Added `@cumulus/common/file/getFileChecksumFromStream` to get file checksum from a readable stream

### Fixed

- CUMULUS-1123
  - Cloudformation template overrides now work as expected

### Changed

- CUMULUS-1169
  - Deprecated the `@cumulus/common/step-functions` module.
  - Updated code that queries the StepFunctions API to use the retry-enabled functions from
    `@cumulus/common/StepFunctions`
- CUMULUS-1121
  - Schema validation is now strongly enforced when writing to the database.
    Additional properties are not allowed and will result in a validation error.
- CUMULUS-678
  `tasks/move-granules` simplified and refactored to use functionality from cmrjs.
  `ingest/granules.moveGranuleFiles` now just moves granule files and returns a list of the updated files. Updating metadata now handled by `@cumulus/cmrjs/reconcileCMRMetadata`.
  `move-granules.updateGranuleMetadata` refactored and bugs fixed in the case of a file matching multiple collection.files.regexps.
  `getCmrXmlFiles` simplified and now only returns an object with the cmrfilename and the granuleId.
  `@cumulus/test-processing` - test processing task updated to generate UMM-G metadata

- CUMULUS-1043

  - `@cumulus/api` now uses [express](http://expressjs.com/) as the API engine.
  - All `@cumulus/api` endpoints on ApiGateway are consolidated to a single endpoint the uses `{proxy+}` definition.
  - All files under `packages/api/endpoints` along with associated tests are updated to support express's request and response objects.
  - Replaced environment variables `internal`, `bucket` and `systemBucket` with `system_bucket`.
  - Update `@cumulus/integration-tests` to work with updated cumulus-api express endpoints

- `@cumulus/integration-tests` - `buildAndExecuteWorkflow` and `buildWorkflow` updated to take a `meta` param to allow for additional fields to be added to the workflow `meta`

- **CUMULUS-1049** Updated `Retrieve Execution Status API` in `@cumulus/api`: If the execution doesn't exist in Step Function API, Cumulus API returns the execution status information from the database.

- **CUMULUS-1119**
  - Renamed `DISTRIBUTION_URL` environment variable to `DISTRIBUTION_ENDPOINT`
  - Renamed `DEPLOYMENT_ENDPOINT` environment variable to `DISTRIBUTION_REDIRECT_ENDPOINT`
  - Renamed `API_ENDPOINT` environment variable to `TOKEN_REDIRECT_ENDPOINT`

### Removed

- Functions deprecated before 1.11.0:
  - @cumulus/api/models/base: static Manager.createTable() and static Manager.deleteTable()
  - @cumulus/ingest/aws/S3
  - @cumulus/ingest/aws/StepFunction.getExecution()
  - @cumulus/ingest/aws/StepFunction.pullEvent()
  - @cumulus/ingest/consumer.Consume
  - @cumulus/ingest/granule/Ingest.getBucket()

### Deprecated

`@cmrjs/ingestConcept`, instead use the CMR object methods. `@cmrjs/CMR.ingestGranule` or `@cmrjs/CMR.ingestCollection`
`@cmrjs/searchConcept`, instead use the CMR object methods. `@cmrjs/CMR.searchGranules` or `@cmrjs/CMR.searchCollections`
`@cmrjs/deleteConcept`, instead use the CMR object methods. `@cmrjs/CMR.deleteGranule` or `@cmrjs/CMR.deleteCollection`

## [v1.11.1] - 2018-12-18

**Please Note**

- Ensure your `app/config.yml` has a `clientId` specified in the `cmr` section. This will allow CMR to identify your requests for better support and metrics.
  - For an example, please see [the example config](https://github.com/nasa/cumulus/blob/1c7e2bf41b75da9f87004c4e40fbcf0f39f56794/example/app/config.yml#L128).

### Added

- Added a `/tokenDelete` endpoint in `@cumulus/api` to delete access token records

### Changed

- CUMULUS-678
  `@cumulus/ingest/crypto` moved and renamed to `@cumulus/common/key-pair-provider`
  `@cumulus/ingest/aws` function: `KMSDecryptionFailed` and class: `KMS` extracted and moved to `@cumulus/common` and `KMS` is exported as `KMSProvider` from `@cumulus/common/key-pair-provider`
  `@cumulus/ingest/granule` functions: `publish`, `getGranuleId`, `getXMLMetadataAsString`, `getMetadataBodyAndTags`, `parseXmlString`, `getCmrXMLFiles`, `postS3Object`, `contructOnlineAccessUrls`, `updateMetadata`, extracted and moved to `@cumulus/cmrjs`
  `getGranuleId`, `getCmrXMLFiles`, `publish`, `updateMetadata` removed from `@cumulus/ingest/granule` and added to `@cumulus/cmrjs`;
  `updateMetadata` renamed `updateCMRMetadata`.
  `@cumulus/ingest` test files renamed.
- **CUMULUS-1070**
  - Add `'Client-Id'` header to all `@cumulus/cmrjs` requests (made via `searchConcept`, `ingestConcept`, and `deleteConcept`).
  - Updated `cumulus/example/app/config.yml` entry for `cmr.clientId` to use stackName for easier CMR-side identification.

## [v1.11.0] - 2018-11-30

**Please Note**

- Redeploy IAM roles:
  - CUMULUS-817 includes a migration that requires reconfiguration/redeployment of IAM roles. Please see the [upgrade instructions](https://nasa.github.io/cumulus/docs/upgrade/1.11.0) for more information.
  - CUMULUS-977 includes a few new SNS-related permissions added to the IAM roles that will require redeployment of IAM roles.
- `cumulus-message-adapter` v1.0.13+ is required for `@cumulus/api` granule reingest API to work properly. The latest version should be downloaded automatically by kes.
- A `TOKEN_SECRET` value (preferably 256-bit for security) must be added to `.env` to securely sign JWTs used for authorization in `@cumulus/api`

### Changed

- **CUUMULUS-1000** - Distribution endpoint now persists logins, instead of
  redirecting to Earthdata Login on every request
- **CUMULUS-783 CUMULUS-790** - Updated `@cumulus/sync-granule` and `@cumulus/move-granules` tasks to always overwrite existing files for manually-triggered reingest.
- **CUMULUS-906** - Updated `@cumulus/api` granule reingest API to
  - add `reingestGranule: true` and `forceDuplicateOverwrite: true` to Cumulus message `cumulus_meta.cumulus_context` field to indicate that the workflow is a manually triggered re-ingest.
  - return warning message to operator when duplicateHandling is not `replace`
  - `cumulus-message-adapter` v1.0.13+ is required.
- **CUMULUS-793** - Updated the granule move PUT request in `@cumulus/api` to reject the move with a 409 status code if one or more of the files already exist at the destination location
- Updated `@cumulus/helloworld` to use S3 to store state for pass on retry tests
- Updated `@cumulus/ingest`:
  - [Required for MAAP] `http.js#list` will now find links with a trailing whitespace
  - Removed code from `granule.js` which looked for files in S3 using `{ Bucket: discoveredFile.bucket, Key: discoveredFile.name }`. This is obsolete since `@cumulus/ingest` uses a `file-staging` and `constructCollectionId()` directory prefixes by default.
- **CUMULUS-989**
  - Updated `@cumulus/api` to use [JWT (JSON Web Token)](https://jwt.io/introduction/) as the transport format for API authorization tokens and to use JWT verification in the request authorization
  - Updated `/token` endpoint in `@cumulus/api` to return tokens as JWTs
  - Added a `/refresh` endpoint in `@cumulus/api` to request new access tokens from the OAuth provider using the refresh token
  - Added `refreshAccessToken` to `@cumulus/api/lib/EarthdataLogin` to manage refresh token requests with the Earthdata OAuth provider

### Added

- **CUMULUS-1050**
  - Separated configuration flags for originalPayload/finalPayload cleanup such that they can be set to different retention times
- **CUMULUS-798**
  - Added daily Executions cleanup CloudWatch event that triggers cleanExecutions lambda
  - Added cleanExecutions lambda that removes finalPayload/originalPayload field entries for records older than configured timeout value (execution_payload_retention_period), with a default of 30 days
- **CUMULUS-815/816**
  - Added 'originalPayload' and 'finalPayload' fields to Executions table
  - Updated Execution model to populate originalPayload with the execution payload on record creation
  - Updated Execution model code to populate finalPayload field with the execution payload on execution completion
  - Execution API now exposes the above fields
- **CUMULUS-977**
  - Rename `kinesisConsumer` to `messageConsumer` as it handles both Kinesis streams and SNS topics as of this version.
  - Add `sns`-type rule support. These rules create a subscription between an SNS topic and the `messageConsumer`.
    When a message is received, `messageConsumer` is triggered and passes the SNS message (JSON format expected) in
    its entirety to the workflow in the `payload` field of the Cumulus message. For more information on sns-type rules,
    see the [documentation](https://nasa.github.io/cumulus/docs/data-cookbooks/setup#rules).
- **CUMULUS-975**
  - Add `KinesisInboundEventLogger` and `KinesisOutboundEventLogger` API lambdas. These lambdas
    are utilized to dump incoming and outgoing ingest workflow kinesis streams
    to cloudwatch for analytics in case of AWS/stream failure.
  - Update rules model to allow tracking of log_event ARNs related to
    Rule event logging. Kinesis rule types will now automatically log
    incoming events via a Kinesis event triggered lambda.
    CUMULUS-975-migration-4
  - Update migration code to require explicit migration names per run
  - Added migration_4 to migrate/update exisitng Kinesis rules to have a log event mapping
  - Added new IAM policy for migration lambda
- **CUMULUS-775**
  - Adds a instance metadata endpoint to the `@cumulus/api` package.
  - Adds a new convenience function `hostId` to the `@cumulus/cmrjs` to help build environment specific cmr urls.
  - Fixed `@cumulus/cmrjs.searchConcept` to search and return CMR results.
  - Modified `@cumulus/cmrjs.CMR.searchGranule` and `@cumulus/cmrjs.CMR.searchCollection` to include CMR's provider as a default parameter to searches.
- **CUMULUS-965**
  - Add `@cumulus/test-data.loadJSONTestData()`,
    `@cumulus/test-data.loadTestData()`, and
    `@cumulus/test-data.streamTestData()` to safely load test data. These
    functions should be used instead of using `require()` to load test data,
    which could lead to tests interferring with each other.
  - Add a `@cumulus/common/util/deprecate()` function to mark a piece of code as
    deprecated
- **CUMULUS-986**
  - Added `waitForTestExecutionStart` to `@cumulus/integration-tests`
- **CUMULUS-919**
  - In `@cumulus/deployment`, added support for NGAP permissions boundaries for IAM roles with `useNgapPermissionBoundary` flag in `iam/config.yml`. Defaults to false.

### Fixed

- Fixed a bug where FTP sockets were not closed after an error, keeping the Lambda function active until it timed out [CUMULUS-972]
- **CUMULUS-656**
  - The API will no longer allow the deletion of a provider if that provider is
    referenced by a rule
  - The API will no longer allow the deletion of a collection if that collection
    is referenced by a rule
- Fixed a bug where `@cumulus/sf-sns-report` was not pulling large messages from S3 correctly.

### Deprecated

- `@cumulus/ingest/aws/StepFunction.pullEvent()`. Use `@cumulus/common/aws.pullStepFunctionEvent()`.
- `@cumulus/ingest/consumer.Consume` due to unpredictable implementation. Use `@cumulus/ingest/consumer.Consumer`.
  Call `Consumer.consume()` instead of `Consume.read()`.

## [v1.10.4] - 2018-11-28

### Added

- **CUMULUS-1008**
  - New `config.yml` parameter for SQS consumers: `sqs_consumer_rate: (default 500)`, which is the maximum number of
    messages the consumer will attempt to process per execution. Currently this is only used by the sf-starter consumer,
    which runs every minute by default, making this a messages-per-minute upper bound. SQS does not guarantee the number
    of messages returned per call, so this is not a fixed rate of consumption, only attempted number of messages received.

### Deprecated

- `@cumulus/ingest/consumer.Consume` due to unpredictable implementation. Use `@cumulus/ingest/consumer.Consumer`.

### Changed

- Backported update of `packages/api` dependency `@mapbox/dyno` to `1.4.2` to mitigate `event-stream` vulnerability.

## [v1.10.3] - 2018-10-31

### Added

- **CUMULUS-817**
  - Added AWS Dead Letter Queues for lambdas that are scheduled asynchronously/such that failures show up only in cloudwatch logs.
- **CUMULUS-956**
  - Migrated developer documentation and data-cookbooks to Docusaurus
    - supports versioning of documentation
  - Added `docs/docs-how-to.md` to outline how to do things like add new docs or locally install for testing.
  - Deployment/CI scripts have been updated to work with the new format
- **CUMULUS-811**
  - Added new S3 functions to `@cumulus/common/aws`:
    - `aws.s3TagSetToQueryString`: converts S3 TagSet array to querystring (for use with upload()).
    - `aws.s3PutObject`: Returns promise of S3 `putObject`, which puts an object on S3
    - `aws.s3CopyObject`: Returns promise of S3 `copyObject`, which copies an object in S3 to a new S3 location
    - `aws.s3GetObjectTagging`: Returns promise of S3 `getObjectTagging`, which returns an object containing an S3 TagSet.
  - `@/cumulus/common/aws.s3PutObject` defaults to an explicit `ACL` of 'private' if not overridden.
  - `@/cumulus/common/aws.s3CopyObject` defaults to an explicit `TaggingDirective` of 'COPY' if not overridden.

### Deprecated

- **CUMULUS-811**
  - Deprecated `@cumulus/ingest/aws.S3`. Member functions of this class will now
    log warnings pointing to similar functionality in `@cumulus/common/aws`.

## [v1.10.2] - 2018-10-24

### Added

- **CUMULUS-965**
  - Added a `@cumulus/logger` package
- **CUMULUS-885**
  - Added 'human readable' version identifiers to Lambda Versioning lambda aliases
- **CUMULUS-705**
  - Note: Make sure to update the IAM stack when deploying this update.
  - Adds an AsyncOperations model and associated DynamoDB table to the
    `@cumulus/api` package
  - Adds an /asyncOperations endpoint to the `@cumulus/api` package, which can
    be used to fetch the status of an AsyncOperation.
  - Adds a /bulkDelete endpoint to the `@cumulus/api` package, which performs an
    asynchronous bulk-delete operation. This is a stub right now which is only
    intended to demonstration how AsyncOperations work.
  - Adds an AsyncOperation ECS task to the `@cumulus/api` package, which will
    fetch an Lambda function, run it in ECS, and then store the result to the
    AsyncOperations table in DynamoDB.
- **CUMULUS-851** - Added workflow lambda versioning feature to allow in-flight workflows to use lambda versions that were in place when a workflow was initiated

  - Updated Kes custom code to remove logic that used the CMA file key to determine template compilation logic. Instead, utilize a `customCompilation` template configuration flag to indicate a template should use Cumulus's kes customized methods instead of 'core'.
  - Added `useWorkflowLambdaVersions` configuration option to enable the lambdaVersioning feature set. **This option is set to true by default** and should be set to false to disable the feature.
  - Added uniqueIdentifier configuration key to S3 sourced lambdas to optionally support S3 lambda resource versioning within this scheme. This key must be unique for each modified version of the lambda package and must be updated in configuration each time the source changes.
  - Added a new nested stack template that will create a `LambdaVersions` stack that will take lambda parameters from the base template, generate lambda versions/aliases and return outputs with references to the most 'current' lambda alias reference, and updated 'core' template to utilize these outputs (if `useWorkflowLambdaVersions` is enabled).

- Created a `@cumulus/api/lib/OAuth2` interface, which is implemented by the
  `@cumulus/api/lib/EarthdataLogin` and `@cumulus/api/lib/GoogleOAuth2` classes.
  Endpoints that need to handle authentication will determine which class to use
  based on environment variables. This also greatly simplifies testing.
- Added `@cumulus/api/lib/assertions`, containing more complex AVA test assertions
- Added PublishGranule workflow to publish a granule to CMR without full reingest. (ingest-in-place capability)

- `@cumulus/integration-tests` new functionality:
  - `listCollections` to list collections from a provided data directory
  - `deleteCollection` to delete list of collections from a deployed stack
  - `cleanUpCollections` combines the above in one function.
  - `listProviders` to list providers from a provided data directory
  - `deleteProviders` to delete list of providers from a deployed stack
  - `cleanUpProviders` combines the above in one function.
  - `@cumulus/integrations-tests/api.js`: `deleteGranule` and `deletePdr` functions to make `DELETE` requests to Cumulus API
  - `rules` API functionality for posting and deleting a rule and listing all rules
  - `wait-for-deploy` lambda for use in the redeployment tests
- `@cumulus/ingest/granule.js`: `ingestFile` inserts new `duplicate_found: true` field in the file's record if a duplicate file already exists on S3.
- `@cumulus/api`: `/execution-status` endpoint requests and returns complete execution output if execution output is stored in S3 due to size.
- Added option to use environment variable to set CMR host in `@cumulus/cmrjs`.
- **CUMULUS-781** - Added integration tests for `@cumulus/sync-granule` when `duplicateHandling` is set to `replace` or `skip`
- **CUMULUS-791** - `@cumulus/move-granules`: `moveFileRequest` inserts new `duplicate_found: true` field in the file's record if a duplicate file already exists on S3. Updated output schema to document new `duplicate_found` field.

### Removed

- Removed `@cumulus/common/fake-earthdata-login-server`. Tests can now create a
  service stub based on `@cumulus/api/lib/OAuth2` if testing requires handling
  authentication.

### Changed

- **CUMULUS-940** - modified `@cumulus/common/aws` `receiveSQSMessages` to take a parameter object instead of positional parameters. All defaults remain the same, but now access to long polling is available through `options.waitTimeSeconds`.
- **CUMULUS-948** - Update lambda functions `CNMToCMA` and `CnmResponse` in the `cumulus-data-shared` bucket and point the default stack to them.
- **CUMULUS-782** - Updated `@cumulus/sync-granule` task and `Granule.ingestFile` in `@cumulus/ingest` to keep both old and new data when a destination file with different checksum already exists and `duplicateHandling` is `version`
- Updated the config schema in `@cumulus/move-granules` to include the `moveStagedFiles` param.
- **CUMULUS-778** - Updated config schema and documentation in `@cumulus/sync-granule` to include `duplicateHandling` parameter for specifying how duplicate filenames should be handled
- **CUMULUS-779** - Updated `@cumulus/sync-granule` to throw `DuplicateFile` error when destination files already exist and `duplicateHandling` is `error`
- **CUMULUS-780** - Updated `@cumulus/sync-granule` to use `error` as the default for `duplicateHandling` when it is not specified
- **CUMULUS-780** - Updated `@cumulus/api` to use `error` as the default value for `duplicateHandling` in the `Collection` model
- **CUMULUS-785** - Updated the config schema and documentation in `@cumulus/move-granules` to include `duplicateHandling` parameter for specifying how duplicate filenames should be handled
- **CUMULUS-786, CUMULUS-787** - Updated `@cumulus/move-granules` to throw `DuplicateFile` error when destination files already exist and `duplicateHandling` is `error` or not specified
- **CUMULUS-789** - Updated `@cumulus/move-granules` to keep both old and new data when a destination file with different checksum already exists and `duplicateHandling` is `version`

### Fixed

- `getGranuleId` in `@cumulus/ingest` bug: `getGranuleId` was constructing an error using `filename` which was undefined. The fix replaces `filename` with the `uri` argument.
- Fixes to `del` in `@cumulus/api/endpoints/granules.js` to not error/fail when not all files exist in S3 (e.g. delete granule which has only 2 of 3 files ingested).
- `@cumulus/deployment/lib/crypto.js` now checks for private key existence properly.

## [v1.10.1] - 2018-09-4

### Fixed

- Fixed cloudformation template errors in `@cumulus/deployment/`
  - Replaced references to Fn::Ref: with Ref:
  - Moved long form template references to a newline

## [v1.10.0] - 2018-08-31

### Removed

- Removed unused and broken code from `@cumulus/common`
  - Removed `@cumulus/common/test-helpers`
  - Removed `@cumulus/common/task`
  - Removed `@cumulus/common/message-source`
  - Removed the `getPossiblyRemote` function from `@cumulus/common/aws`
  - Removed the `startPromisedSfnExecution` function from `@cumulus/common/aws`
  - Removed the `getCurrentSfnTask` function from `@cumulus/common/aws`

### Changed

- **CUMULUS-839** - In `@cumulus/sync-granule`, 'collection' is now an optional config parameter

### Fixed

- **CUMULUS-859** Moved duplicate code in `@cumulus/move-granules` and `@cumulus/post-to-cmr` to `@cumulus/ingest`. Fixed imports making assumptions about directory structure.
- `@cumulus/ingest/consumer` correctly limits the number of messages being received and processed from SQS. Details:
  - **Background:** `@cumulus/api` includes a lambda `<stack-name>-sqs2sf` which processes messages from the `<stack-name>-startSF` SQS queue every minute. The `sqs2sf` lambda uses `@cumulus/ingest/consumer` to receive and process messages from SQS.
  - **Bug:** More than `messageLimit` number of messages were being consumed and processed from the `<stack-name>-startSF` SQS queue. Many step functions were being triggered simultaneously by the lambda `<stack-name>-sqs2sf` (which consumes every minute from the `startSF` queue) and resulting in step function failure with the error: `An error occurred (ThrottlingException) when calling the GetExecutionHistory`.
  - **Fix:** `@cumulus/ingest/consumer#processMessages` now processes messages until `timeLimit` has passed _OR_ once it receives up to `messageLimit` messages. `sqs2sf` is deployed with a [default `messageLimit` of 10](https://github.com/nasa/cumulus/blob/670000c8a821ff37ae162385f921c40956e293f7/packages/deployment/app/config.yml#L147).
  - **IMPORTANT NOTE:** `consumer` will actually process up to `messageLimit * 2 - 1` messages. This is because sometimes `receiveSQSMessages` will return less than `messageLimit` messages and thus the consumer will continue to make calls to `receiveSQSMessages`. For example, given a `messageLimit` of 10 and subsequent calls to `receiveSQSMessages` returns up to 9 messages, the loop will continue and a final call could return up to 10 messages.

## [v1.9.1] - 2018-08-22

**Please Note** To take advantage of the added granule tracking API functionality, updates are required for the message adapter and its libraries. You should be on the following versions:

- `cumulus-message-adapter` 1.0.9+
- `cumulus-message-adapter-js` 1.0.4+
- `cumulus-message-adapter-java` 1.2.7+
- `cumulus-message-adapter-python` 1.0.5+

### Added

- **CUMULUS-687** Added logs endpoint to search for logs from a specific workflow execution in `@cumulus/api`. Added integration test.
- **CUMULUS-836** - `@cumulus/deployment` supports a configurable docker storage driver for ECS. ECS can be configured with either `devicemapper` (the default storage driver for AWS ECS-optimized AMIs) or `overlay2` (the storage driver used by the NGAP 2.0 AMI). The storage driver can be configured in `app/config.yml` with `ecs.docker.storageDriver: overlay2 | devicemapper`. The default is `overlay2`.
  - To support this configuration, a [Handlebars](https://handlebarsjs.com/) helper `ifEquals` was added to `packages/deployment/lib/kes.js`.
- **CUMULUS-836** - `@cumulus/api` added IAM roles required by the NGAP 2.0 AMI. The NGAP 2.0 AMI runs a script `register_instances_with_ssm.py` which requires the ECS IAM role to include `ec2:DescribeInstances` and `ssm:GetParameter` permissions.

### Fixed

- **CUMULUS-836** - `@cumulus/deployment` uses `overlay2` driver by default and does not attempt to write `--storage-opt dm.basesize` to fix [this error](https://github.com/moby/moby/issues/37039).
- **CUMULUS-413** Kinesis processing now captures all errrors.
  - Added kinesis fallback mechanism when errors occur during record processing.
  - Adds FallbackTopicArn to `@cumulus/api/lambdas.yml`
  - Adds fallbackConsumer lambda to `@cumulus/api`
  - Adds fallbackqueue option to lambda definitions capture lambda failures after three retries.
  - Adds kinesisFallback SNS topic to signal incoming errors from kinesis stream.
  - Adds kinesisFailureSQS to capture fully failed events from all retries.
- **CUMULUS-855** Adds integration test for kinesis' error path.
- **CUMULUS-686** Added workflow task name and version tracking via `@cumulus/api` executions endpoint under new `tasks` property, and under `workflow_tasks` in step input/output.
  - Depends on `cumulus-message-adapter` 1.0.9+, `cumulus-message-adapter-js` 1.0.4+, `cumulus-message-adapter-java` 1.2.7+ and `cumulus-message-adapter-python` 1.0.5+
- **CUMULUS-771**
  - Updated sync-granule to stream the remote file to s3
  - Added integration test for ingesting granules from ftp provider
  - Updated http/https integration tests for ingesting granules from http/https providers
- **CUMULUS-862** Updated `@cumulus/integration-tests` to handle remote lambda output
- **CUMULUS-856** Set the rule `state` to have default value `ENABLED`

### Changed

- In `@cumulus/deployment`, changed the example app config.yml to have additional IAM roles

## [v1.9.0] - 2018-08-06

**Please note** additional information and upgrade instructions [here](https://nasa.github.io/cumulus/docs/upgrade/1.9.0)

### Added

- **CUMULUS-712** - Added integration tests verifying expected behavior in workflows
- **GITC-776-2** - Add support for versioned collections

### Fixed

- **CUMULUS-832**
  - Fixed indentation in example config.yml in `@cumulus/deployment`
  - Fixed issue with new deployment using the default distribution endpoint in `@cumulus/deployment` and `@cumulus/api`

## [v1.8.1] - 2018-08-01

**Note** IAM roles should be re-deployed with this release.

- **Cumulus-726**
  - Added function to `@cumulus/integration-tests`: `sfnStep` includes `getStepInput` which returns the input to the schedule event of a given step function step.
  - Added IAM policy `@cumulus/deployment`: Lambda processing IAM role includes `kinesis::PutRecord` so step function lambdas can write to kinesis streams.
- **Cumulus Community Edition**
  - Added Google OAuth authentication token logic to `@cumulus/api`. Refactored token endpoint to use environment variable flag `OAUTH_PROVIDER` when determining with authentication method to use.
  - Added API Lambda memory configuration variable `api_lambda_memory` to `@cumulus/api` and `@cumulus/deployment`.

### Changed

- **Cumulus-726**
  - Changed function in `@cumulus/api`: `models/rules.js#addKinesisEventSource` was modified to call to `deleteKinesisEventSource` with all required parameters (rule's name, arn and type).
  - Changed function in `@cumulus/integration-tests`: `getStepOutput` can now be used to return output of failed steps. If users of this function want the output of a failed event, they can pass a third parameter `eventType` as `'failure'`. This function will work as always for steps which completed successfully.

### Removed

- **Cumulus-726**

  - Configuration change to `@cumulus/deployment`: Removed default auto scaling configuration for Granules and Files DynamoDB tables.

- **CUMULUS-688**
  - Add integration test for ExecutionStatus
  - Function addition to `@cumulus/integration-tests`: `api` includes `getExecutionStatus` which returns the execution status from the Cumulus API

## [v1.8.0] - 2018-07-23

### Added

- **CUMULUS-718** Adds integration test for Kinesis triggering a workflow.

- **GITC-776-3** Added more flexibility for rules. You can now edit all fields on the rule's record
  We may need to update the api documentation to reflect this.

- **CUMULUS-681** - Add ingest-in-place action to granules endpoint

  - new applyWorkflow action at PUT /granules/{granuleid} Applying a workflow starts an execution of the provided workflow and passes the granule record as payload.
    Parameter(s):
    - workflow - the workflow name

- **CUMULUS-685** - Add parent exeuction arn to the execution which is triggered from a parent step function

### Changed

- **CUMULUS-768** - Integration tests get S3 provider data from shared data folder

### Fixed

- **CUMULUS-746** - Move granule API correctly updates record in dynamo DB and cmr xml file
- **CUMULUS-766** - Populate database fileSize field from S3 if value not present in Ingest payload

## [v1.7.1] - 2018-07-27 - [BACKPORT]

### Fixed

- **CUMULUS-766** - Backport from 1.8.0 - Populate database fileSize field from S3 if value not present in Ingest payload

## [v1.7.0] - 2018-07-02

### Please note: [Upgrade Instructions](https://nasa.github.io/cumulus/docs/upgrade/1.7.0)

### Added

- **GITC-776-2** - Add support for versioned collectons
- **CUMULUS-491** - Add granule reconciliation API endpoints.
- **CUMULUS-480** Add suport for backup and recovery:
  - Add DynamoDB tables for granules, executions and pdrs
  - Add ability to write all records to S3
  - Add ability to download all DynamoDB records in form json files
  - Add ability to upload records to DynamoDB
  - Add migration scripts for copying granule, pdr and execution records from ElasticSearch to DynamoDB
  - Add IAM support for batchWrite on dynamoDB
-
- **CUMULUS-508** - `@cumulus/deployment` cloudformation template allows for lambdas and ECS clusters to have multiple AZ availability.
  - `@cumulus/deployment` also ensures docker uses `devicemapper` storage driver.
- **CUMULUS-755** - `@cumulus/deployment` Add DynamoDB autoscaling support.
  - Application developers can add autoscaling and override default values in their deployment's `app/config.yml` file using a `{TableName}Table:` key.

### Fixed

- **CUMULUS-747** - Delete granule API doesn't delete granule files in s3 and granule in elasticsearch
  - update the StreamSpecification DynamoDB tables to have StreamViewType: "NEW_AND_OLD_IMAGES"
  - delete granule files in s3
- **CUMULUS-398** - Fix not able to filter executions by workflow
- **CUMULUS-748** - Fix invalid lambda .zip files being validated/uploaded to AWS
- **CUMULUS-544** - Post to CMR task has UAT URL hard-coded
  - Made configurable: PostToCmr now requires CMR_ENVIRONMENT env to be set to 'SIT' or 'OPS' for those CMR environments. Default is UAT.

### Changed

- **GITC-776-4** - Changed Discover-pdrs to not rely on collection but use provider_path in config. It also has an optional filterPdrs regex configuration parameter

- **CUMULUS-710** - In the integration test suite, `getStepOutput` returns the output of the first successful step execution or last failed, if none exists

## [v1.6.0] - 2018-06-06

### Please note: [Upgrade Instructions](https://nasa.github.io/cumulus/docs/upgrade/1.6.0)

### Fixed

- **CUMULUS-602** - Format all logs sent to Elastic Search.
  - Extract cumulus log message and index it to Elastic Search.

### Added

- **CUMULUS-556** - add a mechanism for creating and running migration scripts on deployment.
- **CUMULUS-461** Support use of metadata date and other components in `url_path` property

### Changed

- **CUMULUS-477** Update bucket configuration to support multiple buckets of the same type:
  - Change the structure of the buckets to allow for more than one bucket of each type. The bucket structure is now:
    bucket-key:
    name: <bucket-name>
    type: <type> i.e. internal, public, etc.
  - Change IAM and app deployment configuration to support new bucket structure
  - Update tasks and workflows to support new bucket structure
  - Replace instances where buckets.internal is relied upon to either use the system bucket or a configured bucket
  - Move IAM template to the deployment package. NOTE: You now have to specify '--template node_modules/@cumulus/deployment/iam' in your IAM deployment
  - Add IAM cloudformation template support to filter buckets by type

## [v1.5.5] - 2018-05-30

### Added

- **CUMULUS-530** - PDR tracking through Queue-granules
  - Add optional `pdr` property to the sync-granule task's input config and output payload.
- **CUMULUS-548** - Create a Lambda task that generates EMS distribution reports
  - In order to supply EMS Distribution Reports, you must enable S3 Server
    Access Logging on any S3 buckets used for distribution. See [How Do I Enable Server Access Logging for an S3 Bucket?](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/server-access-logging.html)
    The "Target bucket" setting should point at the Cumulus internal bucket.
    The "Target prefix" should be
    "<STACK_NAME>/ems-distribution/s3-server-access-logs/", where "STACK_NAME"
    is replaced with the name of your Cumulus stack.

### Fixed

- **CUMULUS-546 - Kinesis Consumer should catch and log invalid JSON**
  - Kinesis Consumer lambda catches and logs errors so that consumer doesn't get stuck in a loop re-processing bad json records.
- EMS report filenames are now based on their start time instead of the time
  instead of the time that the report was generated
- **CUMULUS-552 - Cumulus API returns different results for the same collection depending on query**
  - The collection, provider and rule records in elasticsearch are now replaced with records from dynamo db when the dynamo db records are updated.

### Added

- `@cumulus/deployment`'s default cloudformation template now configures storage for Docker to match the configured ECS Volume. The template defines Docker's devicemapper basesize (`dm.basesize`) using `ecs.volumeSize`. This addresses ECS default of limiting Docker containers to 10GB of storage ([Read more](https://aws.amazon.com/premiumsupport/knowledge-center/increase-default-ecs-docker-limit/)).

## [v1.5.4] - 2018-05-21

### Added

- **CUMULUS-535** - EMS Ingest, Archive, Archive Delete reports
  - Add lambda EmsReport to create daily EMS Ingest, Archive, Archive Delete reports
  - ems.provider property added to `@cumulus/deployment/app/config.yml`.
    To change the provider name, please add `ems: provider` property to `app/config.yml`.
- **CUMULUS-480** Use DynamoDB to store granules, pdrs and execution records
  - Activate PointInTime feature on DynamoDB tables
  - Increase test coverage on api package
  - Add ability to restore metadata records from json files to DynamoDB
- **CUMULUS-459** provide API endpoint for moving granules from one location on s3 to another

## [v1.5.3] - 2018-05-18

### Fixed

- **CUMULUS-557 - "Add dataType to DiscoverGranules output"**
  - Granules discovered by the DiscoverGranules task now include dataType
  - dataType is now a required property for granules used as input to the
    QueueGranules task
- **CUMULUS-550** Update deployment app/config.yml to force elasticsearch updates for deleted granules

## [v1.5.2] - 2018-05-15

### Fixed

- **CUMULUS-514 - "Unable to Delete the Granules"**
  - updated cmrjs.deleteConcept to return success if the record is not found
    in CMR.

### Added

- **CUMULUS-547** - The distribution API now includes an
  "earthdataLoginUsername" query parameter when it returns a signed S3 URL
- **CUMULUS-527 - "parse-pdr queues up all granules and ignores regex"**
  - Add an optional config property to the ParsePdr task called
    "granuleIdFilter". This property is a regular expression that is applied
    against the filename of the first file of each granule contained in the
    PDR. If the regular expression matches, then the granule is included in
    the output. Defaults to '.', which will match all granules in the PDR.
- File checksums in PDRs now support MD5
- Deployment support to subscribe to an SNS topic that already exists
- **CUMULUS-470, CUMULUS-471** In-region S3 Policy lambda added to API to update bucket policy for in-region access.
- **CUMULUS-533** Added fields to granule indexer to support EMS ingest and archive record creation
- **CUMULUS-534** Track deleted granules
  - added `deletedgranule` type to `cumulus` index.
  - **Important Note:** Force custom bootstrap to re-run by adding this to
    app/config.yml `es: elasticSearchMapping: 7`
- You can now deploy cumulus without ElasticSearch. Just add `es: null` to your `app/config.yml` file. This is only useful for debugging purposes. Cumulus still requires ElasticSearch to properly operate.
- `@cumulus/integration-tests` includes and exports the `addRules` function, which seeds rules into the DynamoDB table.
- Added capability to support EFS in cloud formation template. Also added
  optional capability to ssh to your instance and privileged lambda functions.
- Added support to force discovery of PDRs that have already been processed
  and filtering of selected data types
- `@cumulus/cmrjs` uses an environment variable `USER_IP_ADDRESS` or fallback
  IP address of `10.0.0.0` when a public IP address is not available. This
  supports lambda functions deployed into a VPC's private subnet, where no
  public IP address is available.

### Changed

- **CUMULUS-550** Custom bootstrap automatically adds new types to index on
  deployment

## [v1.5.1] - 2018-04-23

### Fixed

- add the missing dist folder to the hello-world task
- disable uglifyjs on the built version of the pdr-status-check (read: https://github.com/webpack-contrib/uglifyjs-webpack-plugin/issues/264)

## [v1.5.0] - 2018-04-23

### Changed

- Removed babel from all tasks and packages and increased minimum node requirements to version 8.10
- Lambda functions created by @cumulus/deployment will use node8.10 by default
- Moved [cumulus-integration-tests](https://github.com/nasa/cumulus-integration-tests) to the `example` folder CUMULUS-512
- Streamlined all packages dependencies (e.g. remove redundant dependencies and make sure versions are the same across packages)
- **CUMULUS-352:** Update Cumulus Elasticsearch indices to use [index aliases](https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-aliases.html).
- **CUMULUS-519:** ECS tasks are no longer restarted after each CF deployment unless `ecs.restartTasksOnDeploy` is set to true
- **CUMULUS-298:** Updated log filterPattern to include all CloudWatch logs in ElasticSearch
- **CUMULUS-518:** Updates to the SyncGranule config schema
  - `granuleIdExtraction` is no longer a property
  - `process` is now an optional property
  - `provider_path` is no longer a property

### Fixed

- **CUMULUS-455 "Kes deployments using only an updated message adapter do not get automatically deployed"**
  - prepended the hash value of cumulus-message-adapter.zip file to the zip file name of lambda which uses message adapter.
  - the lambda function will be redeployed when message adapter or lambda function are updated
- Fixed a bug in the bootstrap lambda function where it stuck during update process
- Fixed a bug where the sf-sns-report task did not return the payload of the incoming message as the output of the task [CUMULUS-441]

### Added

- **CUMULUS-352:** Add reindex CLI to the API package.
- **CUMULUS-465:** Added mock http/ftp/sftp servers to the integration tests
- Added a `delete` method to the `@common/CollectionConfigStore` class
- **CUMULUS-467 "@cumulus/integration-tests or cumulus-integration-tests should seed provider and collection in deployed DynamoDB"**
  - `example` integration-tests populates providers and collections to database
  - `example` workflow messages are populated from workflow templates in s3, provider and collection information in database, and input payloads. Input templates are removed.
  - added `https` protocol to provider schema

## [v1.4.1] - 2018-04-11

### Fixed

- Sync-granule install

## [v1.4.0] - 2018-04-09

### Fixed

- **CUMULUS-392 "queue-granules not returning the sfn-execution-arns queued"**
  - updated queue-granules to return the sfn-execution-arns queued and pdr if exists.
  - added pdr to ingest message meta.pdr instead of payload, so the pdr information doesn't get lost in the ingest workflow, and ingested granule in elasticsearch has pdr name.
  - fixed sf-sns-report schema, remove the invalid part
  - fixed pdr-status-check schema, the failed execution contains arn and reason
- **CUMULUS-206** make sure homepage and repository urls exist in package.json files of tasks and packages

### Added

- Example folder with a cumulus deployment example

### Changed

- [CUMULUS-450](https://bugs.earthdata.nasa.gov/browse/CUMULUS-450) - Updated
  the config schema of the **queue-granules** task
  - The config no longer takes a "collection" property
  - The config now takes an "internalBucket" property
  - The config now takes a "stackName" property
- [CUMULUS-450](https://bugs.earthdata.nasa.gov/browse/CUMULUS-450) - Updated
  the config schema of the **parse-pdr** task
  - The config no longer takes a "collection" property
  - The "stack", "provider", and "bucket" config properties are now
    required
- **CUMULUS-469** Added a lambda to the API package to prototype creating an S3 bucket policy for direct, in-region S3 access for the prototype bucket

### Removed

- Removed the `findTmpTestDataDirectory()` function from
  `@cumulus/common/test-utils`

### Fixed

- [CUMULUS-450](https://bugs.earthdata.nasa.gov/browse/CUMULUS-450)
  - The **queue-granules** task now enqueues a **sync-granule** task with the
    correct collection config for that granule based on the granule's
    data-type. It had previously been using the collection config from the
    config of the **queue-granules** task, which was a problem if the granules
    being queued belonged to different data-types.
  - The **parse-pdr** task now handles the case where a PDR contains granules
    with different data types, and uses the correct granuleIdExtraction for
    each granule.

### Added

- **CUMULUS-448** Add code coverage checking using [nyc](https://github.com/istanbuljs/nyc).

## [v1.3.0] - 2018-03-29

### Deprecated

- discover-s3-granules is deprecated. The functionality is provided by the discover-granules task

### Fixed

- **CUMULUS-331:** Fix aws.downloadS3File to handle non-existent key
- Using test ftp provider for discover-granules testing [CUMULUS-427]
- **CUMULUS-304: "Add AWS API throttling to pdr-status-check task"** Added concurrency limit on SFN API calls. The default concurrency is 10 and is configurable through Lambda environment variable CONCURRENCY.
- **CUMULUS-414: "Schema validation not being performed on many tasks"** revised npm build scripts of tasks that use cumulus-message-adapter to place schema directories into dist directories.
- **CUMULUS-301:** Update all tests to use test-data package for testing data.
- **CUMULUS-271: "Empty response body from rules PUT endpoint"** Added the updated rule to response body.
- Increased memory allotment for `CustomBootstrap` lambda function. Resolves failed deployments where `CustomBootstrap` lambda function was failing with error `Process exited before completing request`. This was causing deployments to stall, fail to update and fail to rollback. This error is thrown when the lambda function tries to use more memory than it is allotted.
- Cumulus repository folders structure updated:
  - removed the `cumulus` folder altogether
  - moved `cumulus/tasks` to `tasks` folder at the root level
  - moved the tasks that are not converted to use CMA to `tasks/.not_CMA_compliant`
  - updated paths where necessary

### Added

- `@cumulus/integration-tests` - Added support for testing the output of an ECS activity as well as a Lambda function.

## [v1.2.0] - 2018-03-20

### Fixed

- Update vulnerable npm packages [CUMULUS-425]
- `@cumulus/api`: `kinesis-consumer.js` uses `sf-scheduler.js#schedule` instead of placing a message directly on the `startSF` SQS queue. This is a fix for [CUMULUS-359](https://bugs.earthdata.nasa.gov/browse/CUMULUS-359) because `sf-scheduler.js#schedule` looks up the provider and collection data in DynamoDB and adds it to the `meta` object of the enqueued message payload.
- `@cumulus/api`: `kinesis-consumer.js` catches and logs errors instead of doing an error callback. Before this change, `kinesis-consumer` was failing to process new records when an existing record caused an error because it would call back with an error and stop processing additional records. It keeps trying to process the record causing the error because it's "position" in the stream is unchanged. Catching and logging the errors is part 1 of the fix. Proposed part 2 is to enqueue the error and the message on a "dead-letter" queue so it can be processed later ([CUMULUS-413](https://bugs.earthdata.nasa.gov/browse/CUMULUS-413)).
- **CUMULUS-260: "PDR page on dashboard only shows zeros."** The PDR stats in LPDAAC are all 0s, even if the dashboard has been fixed to retrieve the correct fields. The current version of pdr-status-check has a few issues.
  - pdr is not included in the input/output schema. It's available from the input event. So the pdr status and stats are not updated when the ParsePdr workflow is complete. Adding the pdr to the input/output of the task will fix this.
  - pdr-status-check doesn't update pdr stats which prevent the real time pdr progress from showing up in the dashboard. To solve this, added lambda function sf-sns-report which is copied from @cumulus/api/lambdas/sf-sns-broadcast with modification, sf-sns-report can be used to report step function status anywhere inside a step function. So add step sf-sns-report after each pdr-status-check, we will get the PDR status progress at real time.
  - It's possible an execution is still in the queue and doesn't exist in sfn yet. Added code to handle 'ExecutionDoesNotExist' error when checking the execution status.
- Fixed `aws.cloudwatchevents()` typo in `packages/ingest/aws.js`. This typo was the root cause of the error: `Error: Could not process scheduled_ingest, Error: : aws.cloudwatchevents is not a constructor` seen when trying to update a rule.

### Removed

- `@cumulus/ingest/aws`: Remove queueWorkflowMessage which is no longer being used by `@cumulus/api`'s `kinesis-consumer.js`.

## [v1.1.4] - 2018-03-15

### Added

- added flag `useList` to parse-pdr [CUMULUS-404]

### Fixed

- Pass encrypted password to the ApiGranule Lambda function [CUMULUS-424]

## [v1.1.3] - 2018-03-14

### Fixed

- Changed @cumulus/deployment package install behavior. The build process will happen after installation

## [v1.1.2] - 2018-03-14

### Added

- added tools to @cumulus/integration-tests for local integration testing
- added end to end testing for discovering and parsing of PDRs
- `yarn e2e` command is available for end to end testing

### Fixed

- **CUMULUS-326: "Occasionally encounter "Too Many Requests" on deployment"** The api gateway calls will handle throttling errors
- **CUMULUS-175: "Dashboard providers not in sync with AWS providers."** The root cause of this bug - DynamoDB operations not showing up in Elasticsearch - was shared by collections and rules. The fix was to update providers', collections' and rules; POST, PUT and DELETE endpoints to operate on DynamoDB and using DynamoDB streams to update Elasticsearch. The following packages were made:
  - `@cumulus/deployment` deploys DynamoDB streams for the Collections, Providers and Rules tables as well as a new lambda function called `dbIndexer`. The `dbIndexer` lambda has an event source mapping which listens to each of the DynamoDB streams. The dbIndexer lambda receives events referencing operations on the DynamoDB table and updates the elasticsearch cluster accordingly.
  - The `@cumulus/api` endpoints for collections, providers and rules _only_ query DynamoDB, with the exception of LIST endpoints and the collections' GET endpoint.

### Updated

- Broke up `kes.override.js` of @cumulus/deployment to multiple modules and moved to a new location
- Expanded @cumulus/deployment test coverage
- all tasks were updated to use cumulus-message-adapter-js 1.0.1
- added build process to integration-tests package to babelify it before publication
- Update @cumulus/integration-tests lambda.js `getLambdaOutput` to return the entire lambda output. Previously `getLambdaOutput` returned only the payload.

## [v1.1.1] - 2018-03-08

### Removed

- Unused queue lambda in api/lambdas [CUMULUS-359]

### Fixed

- Kinesis message content is passed to the triggered workflow [CUMULUS-359]
- Kinesis message queues a workflow message and does not write to rules table [CUMULUS-359]

## [v1.1.0] - 2018-03-05

### Added

- Added a `jlog` function to `common/test-utils` to aid in test debugging
- Integration test package with command line tool [CUMULUS-200] by @laurenfrederick
- Test for FTP `useList` flag [CUMULUS-334] by @kkelly51

### Updated

- The `queue-pdrs` task now uses the [cumulus-message-adapter-js](https://github.com/nasa/cumulus-message-adapter-js)
  library
- Updated the `queue-pdrs` JSON schemas
- The test-utils schema validation functions now throw an error if validation
  fails
- The `queue-granules` task now uses the [cumulus-message-adapter-js](https://github.com/nasa/cumulus-message-adapter-js)
  library
- Updated the `queue-granules` JSON schemas

### Removed

- Removed the `getSfnExecutionByName` function from `common/aws`
- Removed the `getGranuleStatus` function from `common/aws`

## [v1.0.1] - 2018-02-27

### Added

- More tests for discover-pdrs, dicover-granules by @yjpa7145
- Schema validation utility for tests by @yjpa7145

### Changed

- Fix an FTP listing bug for servers that do not support STAT [CUMULUS-334] by @kkelly51

## [v1.0.0] - 2018-02-23

[unreleased]: https://github.com/nasa/cumulus/compare/v1.19.0...HEAD
[v1.19.0]: https://github.com/nasa/cumulus/compare/v1.18.0...v1.19.0
[v1.18.0]: https://github.com/nasa/cumulus/compare/v1.17.0...v1.18.0
[v1.17.0]: https://github.com/nasa/cumulus/compare/v1.16.1...v1.17.0
[v1.16.1]: https://github.com/nasa/cumulus/compare/v1.16.0...v1.16.1
[v1.16.0]: https://github.com/nasa/cumulus/compare/v1.15.0...v1.16.0
[v1.15.0]: https://github.com/nasa/cumulus/compare/v1.14.5...v1.15.0
[v1.14.5]: https://github.com/nasa/cumulus/compare/v1.14.4...v1.14.5
[v1.14.4]: https://github.com/nasa/cumulus/compare/v1.14.3...v1.14.4
[v1.14.3]: https://github.com/nasa/cumulus/compare/v1.14.2...v1.14.3
[v1.14.2]: https://github.com/nasa/cumulus/compare/v1.14.1...v1.14.2
[v1.14.1]: https://github.com/nasa/cumulus/compare/v1.14.0...v1.14.1
[v1.14.0]: https://github.com/nasa/cumulus/compare/v1.13.5...v1.14.0
[v1.13.5]: https://github.com/nasa/cumulus/compare/v1.13.4...v1.13.5
[v1.13.4]: https://github.com/nasa/cumulus/compare/v1.13.3...v1.13.4
[v1.13.3]: https://github.com/nasa/cumulus/compare/v1.13.2...v1.13.3
[v1.13.2]: https://github.com/nasa/cumulus/compare/v1.13.1...v1.13.2
[v1.13.1]: https://github.com/nasa/cumulus/compare/v1.13.0...v1.13.1
[v1.13.0]: https://github.com/nasa/cumulus/compare/v1.12.1...v1.13.0
[v1.12.1]: https://github.com/nasa/cumulus/compare/v1.12.0...v1.12.1
[v1.12.0]: https://github.com/nasa/cumulus/compare/v1.11.3...v1.12.0
[v1.11.3]: https://github.com/nasa/cumulus/compare/v1.11.2...v1.11.3
[v1.11.2]: https://github.com/nasa/cumulus/compare/v1.11.1...v1.11.2
[v1.11.1]: https://github.com/nasa/cumulus/compare/v1.11.0...v1.11.1
[v1.11.0]: https://github.com/nasa/cumulus/compare/v1.10.4...v1.11.0
[v1.10.4]: https://github.com/nasa/cumulus/compare/v1.10.3...v1.10.4
[v1.10.3]: https://github.com/nasa/cumulus/compare/v1.10.2...v1.10.3
[v1.10.2]: https://github.com/nasa/cumulus/compare/v1.10.1...v1.10.2
[v1.10.1]: https://github.com/nasa/cumulus/compare/v1.10.0...v1.10.1
[v1.10.0]: https://github.com/nasa/cumulus/compare/v1.9.1...v1.10.0
[v1.9.1]: https://github.com/nasa/cumulus/compare/v1.9.0...v1.9.1
[v1.9.0]: https://github.com/nasa/cumulus/compare/v1.8.1...v1.9.0
[v1.8.1]: https://github.com/nasa/cumulus/compare/v1.8.0...v1.8.1
[v1.8.0]: https://github.com/nasa/cumulus/compare/v1.7.0...v1.8.0
[v1.7.0]: https://github.com/nasa/cumulus/compare/v1.6.0...v1.7.0
[v1.6.0]: https://github.com/nasa/cumulus/compare/v1.5.5...v1.6.0
[v1.5.5]: https://github.com/nasa/cumulus/compare/v1.5.4...v1.5.5
[v1.5.4]: https://github.com/nasa/cumulus/compare/v1.5.3...v1.5.4
[v1.5.3]: https://github.com/nasa/cumulus/compare/v1.5.2...v1.5.3
[v1.5.2]: https://github.com/nasa/cumulus/compare/v1.5.1...v1.5.2
[v1.5.1]: https://github.com/nasa/cumulus/compare/v1.5.0...v1.5.1
[v1.5.0]: https://github.com/nasa/cumulus/compare/v1.4.1...v1.5.0
[v1.4.1]: https://github.com/nasa/cumulus/compare/v1.4.0...v1.4.1
[v1.4.0]: https://github.com/nasa/cumulus/compare/v1.3.0...v1.4.0
[v1.3.0]: https://github.com/nasa/cumulus/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/nasa/cumulus/compare/v1.1.4...v1.2.0
[v1.1.4]: https://github.com/nasa/cumulus/compare/v1.1.3...v1.1.4
[v1.1.3]: https://github.com/nasa/cumulus/compare/v1.1.2...v1.1.3
[v1.1.2]: https://github.com/nasa/cumulus/compare/v1.1.1...v1.1.2
[v1.1.1]: https://github.com/nasa/cumulus/compare/v1.0.1...v1.1.1
[v1.1.0]: https://github.com/nasa/cumulus/compare/v1.0.1...v1.1.0
[v1.0.1]: https://github.com/nasa/cumulus/compare/v1.0.0...v1.0.1
[v1.0.0]: https://github.com/nasa/cumulus/compare/pre-v1-release...v1.0.0
