import * as PIXI from 'pixi.js'
import {BBCS} from './bbcs'

const bbcs = document.getElementById('bbcs')!;
const canvas = <HTMLCanvasElement> document.getElementById('bbcs-canvas');
let app = new PIXI.Application({
	antialias: true,
	backgroundColor: 0xfafafa,
	autoDensity: true,
	view: canvas,
	resizeTo: bbcs
});
app.renderer.resize(bbcs.offsetWidth, bbcs.offsetHeight);

// set up the interaction manager such that it fires mousemove events only
// when hovering over an object (why is this not default?)
app.renderer.plugins.interaction.moveWhenInside = true;

let ticker = PIXI.Ticker.shared;
ticker.maxFPS = 30;

PIXI.Loader.shared.add([
	'icons/play.png',
	'icons/step.png',
	'icons/pause.png',
	'icons/reset.png',
	'icons/help.png',
	'icons/pan.png',
	'icons/select.png',
	'icons/move.png',
	'icons/add-ball.png',
	'icons/add-wall.png',
	'icons/add-annotation.png',
	'icons/add-line.png',
	'icons/rotate-left.png',
	'icons/rotate-right.png',
	'icons/color.png',
	'icons/delete.png',
	'icons/save.png',
	'icons/load.png'
]).load(() => {
	let bbcs = new BBCS(app);
});

