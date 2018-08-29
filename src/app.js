'use strict';
// ITOps SGR Yelling script

// ------------- includes ------------------
var fs = require('fs'),
	moment = require('moment'),
	Slack = require('machinepack-slack'),
	_ = require('lodash');

// -------------- config -------------------
const usersettings = JSON.parse(fs.readFileSync(process.cwd() + '/settings.json'));


// -------- constants & variables ----------
var	DEBUG = {
	status: true
};

// -------- { errors & errorhandling } ----------
process.on('unhandledRejection', error => {
	console.log('unhandledRejection', error.message);
	process.exit(1);
});


// -------------- { MAIN } -----------------
console.log("Started on " + Date());
// var yesterdaysdate = moment().add(-1, 'days').format('MM/D/YYYY');
var date_today = moment().format("MM-DD-YYYY");

// Ideal Output::
// SLACK: TVGVPRTGP01 - [Closed Races: 0] [Official Races: 0] 
// SLACK: TVGVPRTGP02 - [Closed Races: 10] [Official Races: 22] 
var results = fn_FindClosedRaces(usersettings.sgrfilelocations); //"TVGVPRTGP01","TVGVPRTGP02","NJAOPSTGP01","NJAOPSTGP02"
// Possible future improvement {"open": x, "closed": y, "official": z}

//exit with error code 1 if fn_FindClosedRaces was not successful
console.log(results);
if (results != 0) {
	process.exit(1);
}

//	Quit after 10 seconds (allows slack messages to finish being sent) 
setTimeout(function(){ 
	process.exit(0); //0 is success
}, 10000);


// -------------- { top functions } -------------
function fn_FindClosedRaces(para_FileArray) {
	for (let index = 0; index < para_FileArray.length; index++) {
		const element = para_FileArray[index];
		var thefile = fs.readFileSync("\\\\" + element + "\\tvg\\LogFiles\\" + date_today + "\\SGRData" + date_today + ".txt", "utf8");
		console.log("Parsing file on: " + element);
		var txtArray = thefile.split(/\r?\n/);

		var allData = [];
			var trackCode, trackName, messageType, currentRace, officialRace

		for (let lineindex = 0; lineindex < txtArray.length; lineindex++) {
			const txtline = txtArray[lineindex];
			
			var messagetype_REGEX = new RegExp(usersettings.messagetype_REGEX, 'gi');
			messageType = messagetype_REGEX.exec(txtline); //OD\d+([A-Z]{2})
			// console.log(messageType[1])
			if (messageType == null) {
				if (txtline.length > 40) {
					console.log("No MessageType found in " + txtline);
				}
				continue;
			}
			if (messageType == null || messageType[1] != "RI") {
				continue;
			}

			var trackCode_REGEX = new RegExp(usersettings.trackcode_REGEX, 'gi');
			trackCode = undefined
			trackCode = trackCode_REGEX.exec(txtline); //\d{5}(\w{3})
			if (!trackCode) {
				console.log("No TrackCode found in:" + txtline);
			}

			
			trackName = /[RI]{2}([\w ]+)\s{7}/gi.exec(txtline);
			// console.log(trackName[1])
			var officialRace_REGEX = new RegExp(usersettings.officialrace_REGEX, 'gi');
			officialRace = undefined
			officialRace = parseInt(officialRace_REGEX.exec(txtline)[1]);
			if (officialRace && fn_InStr(txtline, "TRACK      OFFICIAL")) {
				// console.log(officialRace + " on the track " + trackName[1] + "("+messageType[1]+")");

				//find the index of any already seen trackCode
				var thisTrackIndex = _.findIndex(allData,{'trackCode': trackCode[1]})

				if (thisTrackIndex == -1) {
					allData.push({'trackCode': trackCode[1], "officialRace": officialRace})
					continue
				}
				// Assign new value if race number is larger
				if (allData[thisTrackIndex].officialRace < officialRace) {
					allData[thisTrackIndex].officialRace = officialRace;
				}
			}
			
		} //end of each file
		console.log(allData);
		var slackString = "";
		var officialCount = 0;
		for (let thisTrackIndex = 0; thisTrackIndex < allData.length; thisTrackIndex++) {
			const track = allData[thisTrackIndex];
			if (track.officialRace > 0) {
				officialCount += track.officialRace
			}
		}
		slackString = element + " - [Official Races: " + officialCount + "] Racedate: " + moment().format('MM/DD');
		console.log(slackString);
		// SlackPost(slackString);

	} //end of each server
	
	return 0;
}





// --------------- { functions } -----------------
function fn_InStr(para_Haystack, para_Needle) {
	var Output = para_Haystack.indexOf(para_Needle);
	if (Output === -1) {
		return false;
	} else {
		return true;
	}
}


function SlackPost(para_Message) {
	Slack.postToChannel({
	webhookUrl: usersettings.SlackAPIEndpoint,
	channel: '#wager-ops',
	message: para_Message,
	username: 'Gekkō',
	iconEmoji: ':new_moon:',
	linkNames: true,
	}).exec({
	// An unexpected error occurred.
	error: function (err){
		console.log("Slack Error:" + err);
	},
	// Specified subdomain and webhook token combination
	notFound: function (){
		console.log("Slack Error:" + err);
	},
	// OK.
	success: function (){

	},
	});
}
