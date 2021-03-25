import * as PIXI from 'pixi.js';

import {World} from './world';
import {Constants} from './bbcs';

class Annotation {

	pixi = new PIXI.Container();
	selected: boolean = false;
	selectionLine: PIXI.Text;

	constructor(private world: World, public p: [number, number], public text: string) {
		this.selectionLine = new PIXI.Text(text, Constants.annotationSelectionStyle);
		this.selectionLine.anchor.set(0.5);
		this.selectionLine.filters = [new PIXI.filters.BlurFilter(4)];
		this.pixi.addChild(this.selectionLine);

		const textPixi = new PIXI.Text(text, Constants.annotationStyle);
		textPixi.anchor.set(0.5);
		this.pixi.addChild(textPixi);

		this.pixi.position.x = p[0] * 80;
		this.pixi.position.y = -p[1] * 80;
		this.pixi.rotation = Math.PI / 4;

		const textWidth = PIXI.TextMetrics.measureText(text, Constants.annotationStyle).width;

		/*this.selectionLine.lineStyle(12, 0x2277bb);
		this.selectionLine.moveTo(-textWidth / 2, 40);
		this.selectionLine.lineTo(textWidth / 2, 40);*/

		this.updatePosition(0, 0);
	}

	updatePosition(time: number, timeStep: number): void {
		this.selectionLine.visible = this.selected;
	}
}

export {Annotation};

