const rpc = require("../rpc");
const musicMetadata = require("music-metadata");

rpc.handle("metadata:update", async (event, context) => {
	try {
		if (context) {
			const id = context.id;
			const path = context.url;

		}
		rpc.invoke('plugins:metadata-changed', context);
	} catch (e) {
		console.error(`metadata:update exception: ${e}`);
	}
});

rpc.handle('metadata:position-changed', (event, time) => {

})