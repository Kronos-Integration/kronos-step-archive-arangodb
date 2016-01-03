/* jslint node: true, esnext: true */

"use strict";

const archive = require('archive-arangodb');
const messageFactory = require('kronos-message');

// This is used to store and retrieve the configuration of the
// arangodb database from the service manager
const KEY_REGISTER_CONFIG_ARANGODB = "kronos-archive-arangodb:config";

const defaultConfiguration = {
	// Defines the names used for the collections
	"collections": {
		"collectionNameMetaData": "archiveMetaData",
		"collectionNameEdge": "archiveEdges",
		"collectionNameBlob": "archiveBlobData"
	},

	// defines the data base connection. See arango documentation for more details
	"dataBase": {
		"url": "http://localhost:8529",
		"databaseName": "archive"
	}
};


/**
 * This step just write a stream to a file.
 * The file name may be given direct via the step.config or via
 * the  content info of the reading endpoint 'in'. But it must be there.
 * The step configuration will overwrite the contentInfo
 */
const StepArchiveArango = {
	"name": "kronos-step-archive-arangodb",
	"description": "Saves an element to the archive store",
	"endpoints": {
		"inData": {
			"in": "true",
			"uti": "public.data"
		},
		"outAcknowledge": {
			"out": "true",
			"uti": "public.data"
		}
	},

	finalize(manager, scopeReporter, stepConfiguration) {

		const inDataEndpoint = this.endpoints.inData;
		const outAcknowledgeEndpoint = this.endpoints.outAcknowledge;


		// get the config from the service manager
		const config = manager.serviceGet(KEY_REGISTER_CONFIG_ARANGODB);
		if (config) {
			this.config = config;
		} else if (stepConfiguration.db) {
			this.config = stepConfiguration.db;
			manager.serviceRegister(KEY_REGISTER_CONFIG_ARANGODB, this.config);
		} else {
			this.config = defaultConfiguration;
			manager.serviceRegister(KEY_REGISTER_CONFIG_ARANGODB, this.config);
		}

		// throw an error if no database configuration is available
		if (!this.config) {
			const self = this;
			throw new Error({
				"step": "kronos-step-archive-arangodb",
				"name": self.name,
				"short_message": "Now database configuration available"
			});
		}

		// initialize the ArangoDB
		archive.initialize(this.config);


		const self = this;
		const inDataFunc = function (message) {
			// Store the data from the message

			self.info(`have to stored '${message.header.filename}'`);

			let stream = message.payload;
			archive.save(message.header, stream).then(function (id) {
				self.info(`Stored in archive '${id}'`);

				const newMessage = messageFactory(undefined, message);
				outAcknowledgeEndpoint.send(newMessage);

			}).catch(function (err) {
				self.error(err);
			});
		};

		inDataEndpoint.receive = inDataFunc;
	}


};


module.exports = Object.assign({}, require('kronos-step').Step, StepArchiveArango);
