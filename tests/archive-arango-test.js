import test from 'ava';
import { StepArchiveArango } from '../src/archive-arangodb';

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const kronosStepArchive = require('../index');
const step = require('kronos-step');
const messageFactory = require('kronos-message');
const kronos = require('kronos-service-manager');

// The URL used to execite the test
const url = 'http://localhost:8529';
// The database name used for the tests
const dbname = 'archive_arango_test';

// the db to create and remove the database
const db = require('arangojs')(url);

const testConfiguration = {
  // Defines the names used for the collections
  collections: {
    collectionNameMetaData: 'archiveMetaData',
    collectionNameEdge: 'archiveEdges',
    collectionNameBlob: 'archiveBlobData'
  },

  // defines the data base connection. See arango documentation for more details
  dataBase: {
    url: url,
    databaseName: dbname
  }
};

const options = {
  type: 'kronos-step-archive-arangodb',
  name: 'myArchiveStep',
  db: testConfiguration
};

test('Test archive step', async t => {
  await db.createDatabase(dbname)

	let db2 = require('arangojs')(testConfiguration.dataBase);

	await db2.truncate();

  const filePath = path.join(FIXTURES_DIR, 'existing_file.csv');

    const msg = messageFactory({
      filename: 'existing_file.csv',
      path: filePath
    });

  const fileStream = fs.createReadStream(filePath);
    msg.payload = fileStream;

    testme(manager, options, msg, 'existing_file.csv', done);

	await db.dropDatabase(dbname);
});

function async testme(manager, stepConfig, messageToSend, expectedMessage) {
  const kronosStepArchiveArango = manager.getStepInstance(stepConfig);

  /*
	 * Set up the endpoints for later tests
	 */
  // the out endpoint to receive the messages from
  const outEndPoint = kronosStepArchiveArango.endpoints.outAcknowledge;
  const inEndPoint = kronosStepArchiveArango.endpoints.inData;

  // This endpoint is the OUT endpoint of the previous step.
  // It will be connected with the OUT endpoint of the Adpater
  const sendEndpoint = step.createEndpoint('testEndpointOut', {
    out: true,
    active: true
  });

  // This generator emulates the IN endpoint of the next step.
  // It will be connected with the OUT endpoint of the adapter
  let generatorFunction = function*() {
    while (true) {
      const message = yield;
      assert.deepEqual(message.header.filename, expectedMessage);
      done();
    }
  };

  outEndPoint.connectedEndpoint = generatorFunction;
  outEndPoint.outActiveIterator = generatorFunction();
  outEndPoint.outActiveIterator.next();

  inEndPoint.connect(sendEndpoint);

  kronosStepArchiveArango.start().then(
    function(step) {
      sendEndpoint.send(messageToSend);
    },
    function(error) {
      done(error); // 'uh oh: something bad happened’
    }
  );
}
