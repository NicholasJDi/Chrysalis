const discord = require("discord-rpc");
let API

function _init(api) {
	API = api
}

function _playerMetadataChanged(metadata) {

}

function _playerStateChanged(playing) {

}

module.exports = {
	_init,
	_playerMetadataChanged,
	_playerStateChanged
};