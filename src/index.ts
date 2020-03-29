import * as PIXI from 'pixi.js'

let type = "WebGL";
if (!PIXI.utils.isWebGLSupported()) {
	type = "canvas";
}

PIXI.utils.sayHello(type);

let app = new PIXI.Application({
	width: 256,
	height: 256,
	antialias: true,
	backgroundColor: 0xff0000,
	autoDensity: true
});
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";
app.renderer.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', (event: UIEvent) => {
	app.renderer.resize(window.innerWidth, window.innerHeight);
});

document.body.appendChild(app.view);

