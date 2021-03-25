import * as PIXI from 'pixi.js';

import {World} from './world';

class Position {
	constructor (public x: number, public y: number) {
	}
}


class Wall {
	p: Position;
	pixi = new PIXI.Container();
	selectionLine = new PIXI.Graphics();
	line = new PIXI.Graphics();
	selected: boolean = false;

	constructor(private world: World, x: number, y: number, public positive: boolean) {
		this.p = new Position(x, y);

		this.pixi.x = x * 80;
		this.pixi.y = -y * 80;

		this.selectionLine.filters = [new PIXI.filters.BlurFilter(4)];
		this.selectionLine.lineStyle(16, 0x2277bb);
		if (this.positive) {
			this.selectionLine.moveTo(0, 0);
			this.selectionLine.lineTo(80, -80);
		} else {
			this.selectionLine.moveTo(0, -80);
			this.selectionLine.lineTo(80, 0);
		}
		this.pixi.addChild(this.selectionLine);

		Wall.drawPixi(this.line, this.positive);
		this.pixi.addChild(this.line);

		this.updatePosition(0, 0);
	}

	static drawPixi(p: PIXI.Graphics, positive: boolean): void {
		p.lineStyle(4, 0x222222);
		if (positive) {
			p.moveTo(0, 0);
			p.lineTo(80, -80);
		} else {
			p.moveTo(0, -80);
			p.lineTo(80, 0);
		}
	}

	updatePosition(time: number, timeStep: number) {
		this.selectionLine.visible = this.selected;
	}
}

export {Wall};

