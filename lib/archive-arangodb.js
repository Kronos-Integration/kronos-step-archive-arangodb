/* jslint node: true, esnext: true */

"use strict";

const log4js = require('log4js');
const logger = log4js.getLogger('hyperion-step-archive-arango:archive-save');

const BaseStep = require('kronos-step').Step;
const archive = require('archive-arangodb');

const KEY_REGISTER_CONFIG_ARANGODB = "kronos-archive-arangodb:config";


/**
 * This step just write a stream to a file.
 * The file name may be given direct via the step.config or via
 * the  content info of the reading endpoint 'in'. But it must be there.
 * The step configuration will overwrite the contentInfo
 */
const StepArchiveArango = {
	"description": "Saves an element to the archive store",
	"endpoints": {
		"inData": {
			"direction": "in",
			"passive": true,
			"uti": "public.data"
		}
	},

	// defines the possible config elements
	"config": {
		// The configuration used to connect to the arango database.
		// see hyperion-archive-arango for more details
	},

	"initialize": function (manager, step) {

		archive.initialize(step.config);

		step.endpoints.inData.initialize(manager, function* () {
			while (true) {

				const myRequest = yield;
				this.debug({
					"message": myRequest,
					"txt": "Got a save request",
					"endpoint": "inData"
				});

				let blob = '';
				// Now read the stream and build the blob

				archive.save(myRequest.info, myRequest.stream).then(function (id) {
					step.debug(`Stored in archive '${id}'`);
				}).catch(step.error(err));

				//
				//
				// readStream.on('readable', function () {
				// 		let chunk;
				// 		while (null !== (chunk = readStream.read())) {
				// 			blob += chunk;
				// 		}
				// 	})
				// 	.on('end', function () {
				// 		// now store it to the database
				// 		archive.save(myRequest.info, blob).then(function (id) {
				// 			step.debug(`Stored in archive '${id}'`);
				// 		}, function (err) {
				// 			// log the error
				// 			step.error(err);
				// 		});
				// 	});
			}
		});

	}
};
