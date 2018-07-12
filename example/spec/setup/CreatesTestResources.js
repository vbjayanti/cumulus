
const { loadConfig } = require('../helpers/testUtils');
const { createOrUseTestStream, waitForActiveStream } = require('../helpers/kinesisHelpers');
const config = loadConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 550000;

describe('Creates Necessary Test Resources', () => {
  it('Creates a kinesis test stream.', async () => {
    await createOrUseTestStream(config.streamName);
  });

  it('Waits for the stream to be active', async () => {
    await waitForActiveStream(config.streamName);
  });
});
