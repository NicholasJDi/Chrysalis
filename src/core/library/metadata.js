const rpc = require("../rpc");
const musicMetadata = require("music-metadata");

rpc.handle("library:get-metadata", async (event, path) => {
	try {
		const metadata = await musicMetadata.parseFile(path);
		return metadata.common;
	} catch (err) {
		console.warn(`Could not obtain metadata from file: ${path}`);
		return err;
	}
});