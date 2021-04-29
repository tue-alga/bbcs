import * as PIXI from 'pixi.js';

import {World} from './world';
import {Constants} from './bbcs';

class Line {

	pixi = new PIXI.Container();
	linePixi: PIXI.Graphics;
	selectionPixi: PIXI.Graphics;
	selected: boolean = false;

	constructor(private world: World, public p1: [number, number], public p2: [number, number]) {
		this.selectionPixi = new PIXI.Graphics();
		this.selectionPixi.filters = [new PIXI.filters.BlurFilter(4)];
		this.selectionPixi.lineStyle(16, 0x2277bb);
		this.selectionPixi.moveTo(p1[0] * 80, p1[1] * -80);
		this.selectionPixi.lineTo(p2[0] * 80, p2[1] * -80);
		this.pixi.addChild(this.selectionPixi);

		this.linePixi = new PIXI.Graphics();
		Line.drawPixi(this.linePixi, p1, p2);
		this.pixi.addChild(this.linePixi);

		this.updatePosition(0, 0);
	}

	static drawPixi(p: PIXI.Graphics, p1: [number, number], p2: [number, number]): void {
		p.lineStyle(8, 0xb0b0b0);
		p.moveTo(p1[0] * 80, p1[1] * -80);
		p.lineTo(p2[0] * 80, p2[1] * -80);
	}

	updatePosition(time: number, timeStep: number): void {
		this.selectionPixi.visible = this.selected;
	}
}

export {Line};

