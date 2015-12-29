/*global require, describe, it, before, after, beforeEach*/
/* jslint node: true, esnext: true */
"use strict";

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const should = chai.should();

const fs = require('fs');
const path = require("path");

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const kronosStepArchive = require('../index');
const step = require('kronos-step');
const messageFactory = require('kronos-message');
const kronos = require('kronos-service-manager');



// The URL used to execite the test
const url = "http://localhost:8529";
// The database name used for the tests
const dbname = "archive_arango_test";

// the db to create and remove the database
const db = require('arangojs')(url);


const testConfiguration = {
	// Defines the names used for the collections
	"collections": {
		"collectionNameMetaData": "archiveMetaData",
		"collectionNameEdge": "archiveEdges",
		"collectionNameBlob": "archiveBlobData"
	},

	// defines the data base connection. See arango documentation for more details
	"dataBase": {
		"url": url,
		"databaseName": dbname
	}
};

const options = {
	"type": "kronos-step-archive-arangodb",
	"name": "myArchiveStep",
	"db": testConfiguration
};

// the db to cleanup the collections
let db2;


describe('Test archive step', function () {
	this.timeout(5000);
	let manager;
	// let messages = [];
	// let sendEndpoint;

	before('Create the database for testing', function () {
		// create the database
		// console.log('BEFORE');
		return db.createDatabase(dbname).then(function (db) {
			return Promise.resolve(db);
		}, function (err) {
			if (err.errorNum == 1207) {
				// The database already exists
				return Promise.resolve(true);
			} else {
				return Promise.reject(err);
			}
		});
	});

	after('Remove the test database', function () {
		// delete the collection
		return db.dropDatabase(dbname);
	});

	beforeEach('Cleanup the collections', function () {
		if (!db2) {
			db2 = require('arangojs')(testConfiguration.dataBase);
		}
		// clears all the collections
		return db2.truncate();
	});



	it('Start Manager', function (done) {
		kronos.manager().then(function (man) {
			manager = man;
			// register the new steps
			kronosStepArchive.registerWithManager(manager);

			done();
		}, function (reason) {
			done(reason);
		});
	});


	it('store one file', function (done) {
		// clean the array
		//	messages = [];
		const filePath = path.join(FIXTURES_DIR, 'existing_file.csv');

		const msg = messageFactory({
			"filename": "existing_file.csv",
			"path": filePath
		});

		const fileStream = fs.createReadStream(filePath);
		msg.payload = fileStream;


		testme(manager, options, msg, "existing_file.csv", done);
	});

});


function testme(manager, stepConfig, messageToSend, expectedMessage, done) {
	const kronosStepArchiveArango = manager.getStepInstance(stepConfig);

	/*
	 * Set up the endpoints for later tests
	 */
	// the out endpoint to receive the messages from
	const outEndPoint = kronosStepArchiveArango.endpoints.outAcknowledge;
	const inEndPoint = kronosStepArchiveArango.endpoints.inData;

	// This endpoint is the OUT endpoint of the previous step.
	// It will be connected with the OUT endpoint of the Adpater
	const sendEndpoint = step.createEndpoint("testEndpointOut", {
		"out": true,
		"active": true
	});

	// This generator emulates the IN endpoint of the next step.
	// It will be connected with the OUT endpoint of the adapter
	let generatorFunction = function* () {
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

	kronosStepArchiveArango.start().then(function (step) {
		sendEndpoint.send(messageToSend);
	}, function (error) {
		done(error); // 'uh oh: something bad happened’
	});

}
