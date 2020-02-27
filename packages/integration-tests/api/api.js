'use strict';

const cloneDeep = require('lodash.clonedeep');
const pRetry = require('p-retry');
const { lambda } = require('@cumulus/aws-client/services');
const launchpad = require('@cumulus/common/launchpad');
const { deprecate } = require('@cumulus/common/util');
const {
  models: { AccessToken },
  testUtils: { fakeAccessTokenFactory },
  tokenUtils: { createJwtToken }
} = require('@cumulus/api');
const { loadConfig } = require('../config');

function invokeApi(prefix, payload) {
  return pRetry(
    async () => {
      const apiOutput = await lambda().invoke({
        Payload: JSON.stringify(payload),
        FunctionName: `${prefix}-ApiEndpoints`
      }).promise();

      const outputPayload = JSON.parse(apiOutput.Payload);

      if (outputPayload.errorMessage
        && outputPayload.errorMessage.includes('Task timed out')) {
        throw new Error(`Error calling ${payload.path}: ${outputPayload.errorMessage}`);
      }

      return outputPayload;
    },
    {
      retries: 3,
      maxTimeout: 10000,
      onFailedAttempt: (error) => console.log(`API invoke error: ${error.message}. Retrying.`)
    }
  );
}

async function getApiOauthProvider(prefix) {
  if (process.env.OAUTH_PROVIDER) {
    return process.env.OAUTH_PROVIDER;
  }
  const config = await lambda().getFunctionConfiguration({ FunctionName: `${prefix}-ApiEndpoints` }).promise();
  return config.Environment.Variables.OAUTH_PROVIDER;
}

/**
 * Call the Cumulus API by invoking the Lambda function that backs the API
 * Gateway endpoint.
 *
 * Intended for use with integration tests.  Will invoke the function in AWS
 * Lambda.  This function will handle authorization of the request.
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 *   backs the API Gateway endpoint.  Does not include the stack prefix in the
 *   name.
 * @param {string} params.payload - the payload to send to the Lambda function.
 *   See https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @returns {Promise<Object>} - the parsed payload of the response.  See
 *   https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
 */
async function callCumulusApi({ prefix, payload: userPayload }) {
  const payload = cloneDeep(userPayload);

  process.env.AccessTokensTable = `${prefix}-AccessTokensTable`;
  const accessTokenModel = new AccessToken();

  let authToken;
  const provider = await getApiOauthProvider(prefix);

  if (provider === 'launchpad') {
    authToken = await launchpad.getLaunchpadToken({
      passphrase: process.env.LAUNCHPAD_PASSPHRASE,
      api: 'https://api.launchpad.nasa.gov/icam/api/sm/v1/gettoken',
      certificate: 'launchpad.pfx'
    });
  } else {
    const {
      accessToken,
      refreshToken,
      expirationTime
    } = fakeAccessTokenFactory();
    await accessTokenModel.create({ accessToken, refreshToken });

    const { apiUsername } = await loadConfig();

    authToken = createJwtToken({
      accessToken,
      expirationTime,
      username: apiUsername
    });
  }
  // Add authorization header to the request
  payload.headers = payload.headers || {};
  payload.headers.Authorization = `Bearer ${authToken}`;

  let apiOutput;
  try {
    apiOutput = await invokeApi(prefix, payload);
  } finally {
    if (provider !== 'launchpad') {
      await accessTokenModel.delete({ accessToken: authToken });
    }
  }
  return apiOutput;
}

/**
 * Check API Lambda response for errors.
 *
 * Invoking Lambda directly will return 200 as long as the Lambda execution
 * itself did not fail, ignoring any HTTP response codes internal to the
 * object returned by the execution. Manually check those codes so we can
 * throw any encountered errors.
 *
 * @param {Object} response - the parsed payload of the API response
 * @param {Array<number>} acceptedCodes - additional HTTP status codes to consider successful
 * @throws {Error} - error from the API response
 * @returns {Object} - the original response
 */
function verifyCumulusApiResponse(response, acceptedCodes = []) {
  const successCodes = [200].concat(acceptedCodes);
  if (!successCodes.includes(response.statusCode)) {
    const errorText = response.body ? response.body : response.errorMessage;
    throw new Error(errorText);
  }
  return response;
}

/**
 * GET /asyncOperations/{id}
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.id - an AsyncOperation id
 * @returns {Promise<Object>} - the AsyncOperation fetched by the API
 */
async function getAsyncOperation({ prefix, id }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: `/asyncOperations/${id}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * POST /bulkDelete
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.granuleIds - the granules to be deleted
 * @returns {Promise<Object>} - the granule fetched by the API
 */
async function postBulkDelete({ prefix, granuleIds }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'POST',
      resource: '/{proxy+}',
      path: '/bulkDelete/',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ granuleIds })
    }
  });
  return verifyCumulusApiResponse(response, [202]);
}

/**
 * Delete a pdr from Cumulus via the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.pdr - a pdr name
 * @returns {Promise<Object>} - the delete confirmation from the API
 */
async function deletePdr({ prefix, pdr }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'DELETE',
      resource: '/{proxy+}',
      path: `/pdrs/${pdr}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch logs from the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @returns {Promise<Object>} - the logs fetched by the API
 */
async function getLogs({ prefix }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: '/logs'
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch logs from an execution from the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.executionName - execution name
 * @returns {Promise<Object>} - the logs fetched by the API
 */
async function getExecutionLogs({ prefix, executionName }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: `/logs/${executionName}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Add a collection to Cumulus via the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {Object} params.collection - a collection object
 * @returns {Promise<Object>} - the POST confirmation from the API
 */
async function addCollectionApi({ prefix, collection }) {
  deprecate('@cumulus/integration-tests/api/api.addCollectionApi', '1.18.0', '@cumulus/integration-tests/api/collections.createCollection');
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'POST',
      resource: '/{proxy+}',
      path: '/collections',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(collection)
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Add a provider to Cumulus via the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {Object} params.provider - a provider object
 * @returns {Promise<Object>} - the POST confirmation from the API
 */
async function addProviderApi({ prefix, provider }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'POST',
      resource: '/{proxy+}',
      path: '/providers/',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(provider)
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a list of providers from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @returns {Promise<Object>} - the list of providers fetched by the API
 */
async function getProviders({ prefix }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: '/providers'
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a provider from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.providerId - the ID of the provider to fetch
 * @returns {Promise<Object>} - the provider fetched by the API
 */
async function getProvider({ prefix, providerId }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: `/providers/${providerId}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a list of collections from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @returns {Promise<Object>} - the list of collections fetched by the API
 */
async function getCollections({ prefix }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: '/collections'
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a collection from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.collectionId - the ID of the collection to fetch
 * @param {string} params.collectionVersion - the version of the collection to fetch
 * @returns {Promise<Object>} - the collection fetched by the API
 */
async function getCollection({ prefix, collectionName, collectionVersion }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: `/collections/${collectionName}/${collectionVersion}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a list of workflows from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @returns {Promise<Object>} - the list of workflows fetched by the API
 */
async function getWorkflows({ prefix }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: '/workflows'
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Fetch a  workflow from the Cumulus API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {string} params.workflowName - name of the workflow to be fetched
 * @returns {Promise<Object>} - the workflow fetched by the API
 */
async function getWorkflow({ prefix, workflowName }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'GET',
      resource: '/{proxy+}',
      path: `/workflows/${workflowName}`
    }
  });
  return verifyCumulusApiResponse(response);
}

/**
 * Update a collection in Cumulus via the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {Object} params.collection - the collection object
 * @param {string} params.collection.name - the collection name (required)
 * @param {string} params.collection.version - the collection version (required)
 * @param {Object} params.updateParams - key/value to update on the collection
 * @returns {Promise<Object>} - the updated collection from the API
 */
async function updateCollection({ prefix, collection, updateParams }) {
  const originalCollection = JSON.parse((await getCollection({
    prefix,
    collectionName: collection.name,
    collectionVersion: collection.version
  })).body);

  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'PUT',
      resource: '/{proxy+}',
      path: `/collections/${collection.name}/${collection.version}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...originalCollection,
        ...updateParams
      })
    }
  });

  return verifyCumulusApiResponse(response);
}

/**
 * Update a provider in Cumulus via the API
 *
 * @param {Object} params - params
 * @param {string} params.prefix - the prefix configured for the stack
 * @param {Object} params.collection - the provider object
 * @param {string} params.collection.id - the provider id (required)
 * @param {Object} params.updateParams - key/value to update on the provider
 * @returns {Promise<Object>} - the updated provider from the API
 */
async function updateProvider({ prefix, provider, updateParams }) {
  const response = await callCumulusApi({
    prefix: prefix,
    payload: {
      httpMethod: 'PUT',
      resource: '/{proxy+}',
      path: `/providers/${provider.id}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(Object.assign(provider, updateParams))
    }
  });
  return verifyCumulusApiResponse(response);
}

module.exports = {
  callCumulusApi,
  getAsyncOperation,
  deletePdr,
  getExecutionLogs,
  addCollectionApi,
  addProviderApi,
  getProviders,
  getCollections,
  getWorkflows,
  getWorkflow,
  getProvider,
  getCollection,
  getLogs,
  postBulkDelete,
  updateCollection,
  updateProvider
};
