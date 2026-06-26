async function grabAccentColor() {
	const accent = await electron.getAccentColor();
	console.log(accent)
	document.body.style.setProperty("--system-accent-color", accent);
}

grabAccentColor();