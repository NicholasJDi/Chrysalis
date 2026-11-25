const discord = require("discord-rpc");
let API;

function _init(api) {
	API = api;
}

function _metadataChanged(metadata) {

}

function _stateChanged(playing) {

}

module.exports = {
	_init,
	_metadataChanged,
	_stateChanged
};