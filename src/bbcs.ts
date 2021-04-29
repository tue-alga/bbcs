import * as PIXI from 'pixi.js';

import {Direction, Ball, Color} from './ball';
import {Wall} from './wall';
import {Annotation} from './annotation';
import {Line} from './line';
import {World} from './world';
import {Button, Separator, Toolbar} from './ui';

enum EditMode {
	PAN, SELECT, MOVE, ADD_BALL, ADD_WALL, ADD_TEXT, ADD_LINE
}

enum SimulationMode {
	RUNNING, PAUSED, RESET
}

class BBCS {
	private app: PIXI.Application;

	editMode: EditMode = EditMode.PAN;
	time: number = 0.0;
	timeStep: number = 0;
	runUntil: number = Infinity;

	simulationMode: SimulationMode = SimulationMode.RESET;
	timeSpeed: number = 0.05;

	world: World;

	// the "shadow" appearing below the cursor when in an addition mode
	dropHint = new PIXI.Graphics();
	selectionRectangle = new PIXI.Graphics();
	selectionBase: [number, number] | null = null;
	mousePressed = false;
	isDragging = false;

	lineStart: [number, number] | null = null;

	// selected objects
	private selection: (Ball | Wall | Annotation | Line) [] = [];

	// direction and color of last-edited ball
	// (remembered to insert new balls with the same direction and color)
	private lastDirection = Direction.RIGHT;
	private lastColor = Color.BLUE;

	// main toolbars
	private topBar: Toolbar;
	private bottomBar: Toolbar;
	private bottomBarOffset = 0;

	private runButton: Button;
	private stepButton: Button;
	private resetButton: Button;
	private helpButton: Button;
	
	private panButton: Button;
	private selectButton: Button;
	private moveButton: Button;
	private addBallButton: Button;
	private addWallButton: Button;
	private annotateButton: Button;

	private rotateLeftButton: Button;
	private rotateRightButton: Button;
	private colorButton: Button;
	private deleteButton: Button;

	private saveButton: Button;

	// annotations toolbar
	private annotationsBar: Toolbar;

	private addTextButton: Button;
	private addLineButton: Button;

	private textArea = document.getElementById('save-textarea') as HTMLTextAreaElement;

	private shiftKeyHeld = false;

	constructor(app: PIXI.Application) {
		this.app = app;

		this.world = new World(this.app.renderer);

		this.topBar = new Toolbar(false);

		this.runButton = new Button("play", "Run simulation", false, "Space");
		this.runButton.onClick(this.run.bind(this));
		this.topBar.addChild(this.runButton);

		this.stepButton = new Button("step", "Run one step", false);
		this.stepButton.onClick(this.step.bind(this));
		this.topBar.addChild(this.stepButton);

		this.resetButton = new Button("reset", "Reset simulation", false, "R");
		this.resetButton.onClick(this.reset.bind(this));
		this.resetButton.setEnabled(false);
		this.topBar.addChild(this.resetButton);

		this.topBar.addChild(new Separator());
		
		this.helpButton = new Button("help", "Help & tutorial", false);
		this.helpButton.onClick(this.help.bind(this));
		this.topBar.addChild(this.helpButton);

		this.bottomBar = new Toolbar(true);

		this.panButton = new Button(
			"pan", "Pan the canvas", true, "P");
		this.panButton.setPressed(true);
		this.panButton.onClick(this.panMode.bind(this));
		this.bottomBar.addChild(this.panButton);

		this.selectButton = new Button(
			"select", "Select objects", true, "S");
		this.selectButton.onClick(this.selectMode.bind(this));
		this.bottomBar.addChild(this.selectButton);

		this.moveButton = new Button(
			"move", "Move objects", true, "M");
		this.moveButton.onClick(this.moveMode.bind(this));
		//this.bottomBar.addChild(this.moveButton);

		this.addBallButton = new Button(
			"add-ball", "Add balls", true, "B");
		this.addBallButton.onClick(this.addBallsMode.bind(this));
		this.bottomBar.addChild(this.addBallButton);

		this.addWallButton = new Button(
			"add-wall", "Add walls", true, "W");
		this.addWallButton.onClick(this.addWallsMode.bind(this));
		this.bottomBar.addChild(this.addWallButton);

		this.annotateButton = new Button(
			"add-annotation", "Add annotations", true);
		this.annotateButton.onClick(this.addTextMode.bind(this));
		this.bottomBar.addChild(this.annotateButton);

		this.bottomBar.addChild(new Separator());

		this.rotateLeftButton = new Button(
			"rotate-left", "Rotate left", true);
		this.rotateLeftButton.onClick(
			() => {
				this.selection.forEach((ball) => {
					if (ball instanceof Ball) {
						ball.rotateCounterClockwise();
						if (this.selection.length === 1) {
							this.lastDirection = ball.d;
						}
					}
				});
			}
		);
		this.rotateLeftButton.setEnabled(false);
		this.bottomBar.addChild(this.rotateLeftButton);

		this.rotateRightButton = new Button(
			"rotate-right", "Rotate right", true);
		this.rotateRightButton.onClick(
			() => {
				this.selection.forEach((ball) => {
					if (ball instanceof Ball) {
						ball.rotateClockwise();
						if (this.selection.length === 1) {
							this.lastDirection = ball.d;
						}
					}
				});
			}
		);
		this.rotateRightButton.setEnabled(false);
		this.bottomBar.addChild(this.rotateRightButton);

		this.colorButton = new Button(
			"color", "Change color", true);
		this.colorButton.onClick(
			() => {
				this.selection.forEach((ball) => {
					if (ball instanceof Ball) {
						ball.nextColor();
						if (this.selection.length === 1) {
							this.lastColor = ball.color;
						}
					}
				});
			}
		);
		this.colorButton.setEnabled(false);
		this.bottomBar.addChild(this.colorButton);

		this.deleteButton = new Button(
			"delete", "Delete selected", true, "Delete");
		this.deleteButton.onClick(this.delete.bind(this));
		this.deleteButton.setEnabled(false);
		this.bottomBar.addChild(this.deleteButton);

		this.bottomBar.addChild(new Separator());

		this.saveButton = new Button(
			"save", "Save & load", true);
		this.saveButton.onClick(this.save.bind(this));
		this.bottomBar.addChild(this.saveButton);

		this.annotationsBar = new Toolbar(true);

		this.addTextButton = new Button(
			"add-annotation", "Add text", true, "T");
		this.addTextButton.onClick(this.addTextMode.bind(this));
		this.annotationsBar.addChild(this.addTextButton);

		this.addLineButton = new Button(
			"add-line", "Add lines", true, "L");
		this.addLineButton.onClick(this.addLinesMode.bind(this));
		this.annotationsBar.addChild(this.addLineButton);

		// set up event handlers for dialog buttons
		const loadButton = document.getElementById('load-button');
		loadButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
			document.getElementById('save-dialog')!.style.display = 'none';
			this.load(this.textArea.value);
		});

		const closeButton = document.getElementById('close-button');
		closeButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
			document.getElementById('save-dialog')!.style.display = 'none';
		});

		this.setupSolutionButtons();

		this.app.ticker.add((delta) => {
			this.renderFrame(delta);
		});


		this.setup();
	}

	setup() {
		this.app.stage.addChild(this.world.viewport);
		this.world.pixi.addChild(this.dropHint);
		this.dropHint.filters = [new PIXI.filters.AlphaFilter(0.4)];
		this.world.pixi.addChild(this.selectionRectangle);

		this.topBar.rebuildPixi();
		this.app.stage.addChild(this.topBar.getPixi());

		this.annotationsBar.rebuildPixi();
		this.annotationsBar.setVisible(false);
		this.app.stage.addChild(this.annotationsBar.getPixi());

		this.bottomBar.rebuildPixi();
		this.app.stage.addChild(this.bottomBar.getPixi());

		this.world.balls.forEach((ball) => {
			ball.placeDots(0);
		});

		// click handler
		this.world.pixi.interactive = true;
		this.world.pixi.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);  // TODO should be infinite ...
		this.world.pixi.on('click', this.worldClickHandler.bind(this));
		this.world.pixi.on('mousedown', this.worldMouseDownHandler.bind(this));
		this.world.pixi.on('mouseup', this.worldMouseUpHandler.bind(this));
		this.world.pixi.on('tap', this.worldClickHandler.bind(this));
		this.world.pixi.on('mousemove', this.worldMouseMoveHandler.bind(this));

		// key handlers
		window.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key === " ") {
				this.run();
			} else if (event.key === "r") {
				this.reset();
			} else if (event.key === "p") {
				this.panMode();
			} else if (event.key === "s") {
				this.selectMode();
			} else if (event.key === "m") {
				this.moveMode();
			} else if (event.key === "b") {
				this.addBallsMode();
			} else if (event.key === "w") {
				this.addWallsMode();
			} else if (event.key === "t") {
				this.addTextMode();
			} else if (event.key === "l") {
				this.addLinesMode();
			} else if (event.key === "Delete") {
				this.delete();
			}
			this.shiftKeyHeld = event.shiftKey;
		});
		window.addEventListener("keyup", (event: KeyboardEvent) => {
			this.shiftKeyHeld = event.shiftKey;
		});

		this.update();
	}

	update(): void {
	}

	setupSolutionButtons(): void {
		const self = this;
		document.getElementById('and-gate-step-0-button')!.onclick =
				function() {
			self.load(`{"_version":3,"balls":[],"walls":[],"texts":[{"x":0,"y":6,"text":"Input 1"},{"x":-3,"y":3,"text":"Input 2"},{"x":5,"y":1,"text":"Output"}],"lines":[{"p1":[-5,2],"p2":[-4,3]},{"p1":[-4,3],"p2":[-3,2]},{"p1":[-3,2],"p2":[-4,1]},{"p1":[-4,1],"p2":[-5,2]},{"p1":[-1,4],"p2":[-2,5]},{"p1":[-2,5],"p2":[-1,6]},{"p1":[-1,6],"p2":[0,5]},{"p1":[0,5],"p2":[-1,4]},{"p1":[3,0],"p2":[4,1]},{"p1":[4,1],"p2":[5,0]},{"p1":[5,0],"p2":[4,-1]},{"p1":[4,-1],"p2":[3,0]}]}`);
		};
		document.getElementById('and-gate-step-1-button')!.onclick =
				function() {
			self.load(`{"_version":3,"balls":[{"x":-1,"y":5,"vx":0,"vy":-1,"color":[68,187,248]},{"x":-4,"y":2,"vx":1,"vy":0,"color":[248,78,94]}],"walls":[],"texts":[{"x":0,"y":6,"text":"Input 1"},{"x":-3,"y":3,"text":"Input 2"},{"x":5,"y":1,"text":"Output"}],"lines":[{"p1":[-5,2],"p2":[-4,3]},{"p1":[-4,3],"p2":[-3,2]},{"p1":[-3,2],"p2":[-4,1]},{"p1":[-4,1],"p2":[-5,2]},{"p1":[-1,4],"p2":[-2,5]},{"p1":[-2,5],"p2":[-1,6]},{"p1":[-1,6],"p2":[0,5]},{"p1":[0,5],"p2":[-1,4]},{"p1":[3,0],"p2":[4,1]},{"p1":[4,1],"p2":[5,0]},{"p1":[5,0],"p2":[4,-1]},{"p1":[4,-1],"p2":[3,0]}]}`);
		};
		document.getElementById('and-gate-step-2-button')!.onclick =
				function() {
			self.load(`{"_version":3,"balls":[{"x":-1,"y":5,"vx":0,"vy":-1,"color":[68,187,248]},{"x":-4,"y":2,"vx":1,"vy":0,"color":[248,78,94]}],"walls":[{"x":2,"y":3,"p":false}],"texts":[{"x":0,"y":6,"text":"Input 1"},{"x":-3,"y":3,"text":"Input 2"},{"x":5,"y":1,"text":"Output"}],"lines":[{"p1":[-5,2],"p2":[-4,3]},{"p1":[-4,3],"p2":[-3,2]},{"p1":[-3,2],"p2":[-4,1]},{"p1":[-4,1],"p2":[-5,2]},{"p1":[-1,4],"p2":[-2,5]},{"p1":[-2,5],"p2":[-1,6]},{"p1":[-1,6],"p2":[0,5]},{"p1":[0,5],"p2":[-1,4]},{"p1":[3,0],"p2":[4,1]},{"p1":[4,1],"p2":[5,0]},{"p1":[5,0],"p2":[4,-1]},{"p1":[4,-1],"p2":[3,0]}]}`);
		};
		document.getElementById('and-gate-step-3-button')!.onclick =
				function() {
			self.load(`{"_version":3,"balls":[{"x":-1,"y":5,"vx":0,"vy":-1,"color":[68,187,248]},{"x":-4,"y":2,"vx":1,"vy":0,"color":[248,78,94]}],"walls":[{"x":2,"y":3,"p":false},{"x":-3,"y":-2,"p":false}],"texts":[{"x":0,"y":6,"text":"Input 1"},{"x":-3,"y":3,"text":"Input 2"},{"x":5,"y":1,"text":"Output"}],"lines":[{"p1":[-5,2],"p2":[-4,3]},{"p1":[-4,3],"p2":[-3,2]},{"p1":[-3,2],"p2":[-4,1]},{"p1":[-4,1],"p2":[-5,2]},{"p1":[-1,4],"p2":[-2,5]},{"p1":[-2,5],"p2":[-1,6]},{"p1":[-1,6],"p2":[0,5]},{"p1":[0,5],"p2":[-1,4]},{"p1":[3,0],"p2":[4,1]},{"p1":[4,1],"p2":[5,0]},{"p1":[5,0],"p2":[4,-1]},{"p1":[4,-1],"p2":[3,0]}]}`);
		};
		document.getElementById('not-gate-step-2-button')!.onclick =
				function() {
			self.load(`{"_version":3,"balls":[{"x":-4,"y":8,"vx":0,"vy":-1,"color":[68,187,248]},{"x":-7,"y":5,"vx":1,"vy":0,"color":[248,230,110]}],"walls":[{"x":-3,"y":6,"p":false}],"texts":[{"x":3,"y":5,"text":"Output"},{"x":-4,"y":12,"text":"Input"},{"x":-11,"y":5,"text":"Constant"}],"lines":[{"p1":[-5,6],"p2":[-9,6]},{"p1":[-5,6],"p2":[-5,10]},{"p1":[-3,7],"p2":[-3,10]},{"p1":[-2,6],"p2":[1,6]},{"p1":[-9,4],"p2":[-6,4]},{"p1":[-6,4],"p2":[-6,1]},{"p1":[-2,4],"p2":[-2,1]},{"p1":[-2,4],"p2":[1,4]}]}`);
		};
	}

	select(obj: Ball | Wall | Annotation | Line): void {
		this.selection.push(obj);
		obj.selected = true;
		obj.updatePosition(this.time, this.timeStep);
		this.updateEditButtons();
	}

	deselect(): void {
		this.selection.forEach((ball) => {
			ball.selected = false;
			ball.updatePosition(this.time, this.timeStep);
		});

		this.selection = [];
		this.updateEditButtons();
	}

	private updateEditButtons(): void {
		this.rotateLeftButton.setEnabled(this.selection.length > 0);
		this.rotateRightButton.setEnabled(this.selection.length > 0);
		this.colorButton.setEnabled(this.selection.length > 0);
		this.deleteButton.setEnabled(this.selection.length > 0);
	}

	renderFrame(delta: number): void {
		if (this.simulationMode === SimulationMode.RUNNING) {
			this.time += this.timeSpeed * delta;

			if (this.time > this.runUntil) {
				this.time = this.runUntil;
				this.simulationMode = SimulationMode.PAUSED;
				this.runButton.setIcon("play");
				this.runButton.setTooltip("Run simulation");
				this.stepButton.setEnabled(true);
			}
		}

		while (Math.floor(this.time) > this.timeStep) {
			this.timeStep++;
			try {
				this.world.nextStep(this.timeStep);
			} catch (e) {
				window.alert(`Illegal move: ${e}. Resetting the simulation.`);
				this.reset();
			}
		}

		this.world.pixi.x = this.app.renderer.width / 2;
		this.world.pixi.y = this.app.renderer.height / 2;
		
		this.topBar.setPosition(
			this.app.renderer.width / 2 - this.topBar.getWidth() / 2,
			0);
		this.bottomBar.setPosition(
			this.app.renderer.width / 2 - this.bottomBar.getWidth() / 2,
			this.app.renderer.height - this.bottomBar.getHeight() + Math.pow(this.bottomBarOffset, 2));
		this.annotationsBar.setPosition(
			this.app.renderer.width / 2 - this.annotationsBar.getWidth() / 2,
			this.app.renderer.height - 2 * this.annotationsBar.getHeight());

		this.world.balls.forEach((ball) => {
			ball.updatePosition(this.time, this.timeStep);
		});

		if (this.simulationMode === SimulationMode.RESET) {
			this.bottomBarOffset = Math.max(this.bottomBarOffset - 0.5 * delta, 0);
		} else {
			this.bottomBarOffset = Math.min(this.bottomBarOffset + 0.5 * delta, 10);
		}
	}
	
	worldClickHandler(e: PIXI.interaction.InteractionEvent): void {
		if (this.simulationMode !== SimulationMode.RESET) {
			return;
		}

		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;
		this.dropHint.clear();

		if (this.editMode === EditMode.SELECT && !this.isDragging) {
			if (!this.shiftKeyHeld) {
				this.deselect();
			}
			const ball = this.world.getBall(Math.round(x), Math.round(y));
			if (ball) {
				this.select(ball);
			} else {
				const [from, to] = this.getWallCoordinates(Math.floor(x), Math.floor(y));
				const wall = this.world.getWall(from, to);
				if (wall) {
					this.select(wall);
				} else {
					const annotation = this.world.getAnnotation(Math.round(x), Math.round(y));
					if (annotation) {
						this.select(annotation);
					}
				}
			}
		}

		if (this.editMode === EditMode.ADD_BALL) {
			x = Math.round(x);
			y = Math.round(y);

			if ((x + y) % 2 === 0) {
				const ball = this.world.getBall(x, y);
				if (!ball) {
					const newBall = this.world.addBall(x, y, this.lastDirection, this.lastColor);
					this.deselect();
					this.select(newBall);
				}
			}
		}

		if (this.editMode === EditMode.ADD_WALL) {
			x = Math.floor(x);
			y = Math.floor(y);

			const [from, to] = this.getWallCoordinates(x, y);
			if (!this.world.hasWall(from, to)) {
				const newWall = this.world.addWall(from, to);
				this.deselect();
				this.select(newWall);
			}
		}

		if (this.editMode === EditMode.ADD_TEXT) {
			let text = window.prompt('Enter annotation text');
			if (text) {
				const newAnnotation = this.world.addAnnotation(
						[Math.round(x), Math.round(y)], text);
				this.deselect();
				this.select(newAnnotation);
			}
		}

		if (this.editMode === EditMode.ADD_LINE) {
			this.deselect();
			if (!this.lineStart) {
				this.lineStart = [Math.round(x), Math.round(y)];
			} else {
				let newLine = this.world.addLine(this.lineStart, [Math.round(x), Math.round(y)]);
				this.lineStart = null;
				this.select(newLine);
			}
		}

		this.isDragging = false;
	}

	private getWallCoordinates(x: number, y: number):
			[[number, number], [number, number]] {
		if ((x + y) % 2 === 0) {
			return [[x, y], [x + 1, y + 1]];
		} else {
			return [[x + 1, y], [x, y + 1]];
		}
	}

	worldMouseMoveHandler(e: PIXI.interaction.InteractionEvent): void {
		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;

		if (this.mousePressed) {
			this.worldDragHandler(e);

		} else {

			if (this.simulationMode === SimulationMode.RESET) {
				this.dropHint.clear();

				if (this.editMode === EditMode.ADD_BALL) {
					x = Math.round(x);
					y = Math.round(y);

					if ((x + y) % 2 === 0) {
						this.dropHint.x = x * 80;
						this.dropHint.y = -y * 80;
						const [vx, vy] = this.lastDirection.toVector();
						this.dropHint.rotation = -Math.atan2(vy, vx);
						Ball.drawPixi(this.dropHint, this.lastColor);
					}
				}

				if (this.editMode === EditMode.ADD_WALL) {
					x = Math.floor(x);
					y = Math.floor(y);

					const [from, to] = this.getWallCoordinates(x, y);
					if (!this.world.hasWall(from, to)) {
						this.dropHint.x = x * 80;
						this.dropHint.y = -y * 80;

						Wall.drawPixi(this.dropHint, this.world.isWallPositive(from, to));
					}
				}

				if (this.editMode === EditMode.ADD_TEXT || this.editMode === EditMode.ADD_LINE) {
					x = Math.round(x);
					y = Math.round(y);

					this.dropHint.x = 0;
					this.dropHint.y = 0;
					this.dropHint.beginFill(0x2277bb);
					this.dropHint.drawCircle(x * 80, -y * 80, 10);
					this.dropHint.endFill();

					if (this.editMode === EditMode.ADD_LINE && this.lineStart) {
						Line.drawPixi(this.dropHint, this.lineStart, [x, y]);
					}
				}
			}
		}
	}

	worldMouseDownHandler(e: PIXI.interaction.InteractionEvent): void {
		this.mousePressed = true;
		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;

		if (this.editMode === EditMode.SELECT) {
			this.selectionBase = [x, y];
		}
	}

	worldMouseUpHandler(e: PIXI.interaction.InteractionEvent): void {
		this.mousePressed = false;
		const p = e.data.getLocalPosition(this.world.pixi);
		const x = p.x / 80;
		const y = -p.y / 80;

		if (this.editMode === EditMode.SELECT) {
			this.selectionRectangle.clear();

			const p1 = this.selectionBase;
			if (p1 !== null) {
				const p2: [number, number] = [x, y];
				this.deselect();
				for (let ball of this.world.balls) {
					if (this.inSelectionRectangle([ball.p.x, ball.p.y], p1, p2)) {
						this.select(ball);
					}
				}
				for (let wall of this.world.walls) {
					if (this.inSelectionRectangle(wall.getStartPosition(), p1, p2) &&
							this.inSelectionRectangle(wall.getEndPosition(), p1, p2)) {
						this.select(wall);
					}
				}
				for (let annotation of this.world.annotations) {
					if (this.inSelectionRectangle(annotation.p, p1, p2)) {
						this.select(annotation);
					}
				}
				for (let line of this.world.lines) {
					if (this.inSelectionRectangle(line.p1, p1, p2) &&
							this.inSelectionRectangle(line.p2, p1, p2)) {
						this.select(line);
					}
				}
			}
		}
	}

	inSelectionRectangle(p: [number, number], p1: [number, number], p2: [number, number]): boolean {
		return this.inRectangle(
			this.rotate(p),
			this.rotate(p1),
			this.rotate(p2)
		);
	}

	private rotate(p: [number, number]): [number, number] {
		const f = 1/2 * Math.sqrt(2);
		return [
			f * p[0] - f * p[1],
			f * p[0] + f * p[1],
		];
	}

	private inRectangle(p: [number, number], p1: [number, number], p2: [number, number]): boolean {
		return this.inOrder(p1[0], p[0], p2[0]) && this.inOrder(p1[1], p[1], p2[1]);
	}

	private inOrder(x: number, y: number, z: number): boolean {
		return (x <= y && y < z) || (x >= y && y > z);
	}

	worldDragHandler(e: PIXI.interaction.InteractionEvent): void {
		this.isDragging = true;
		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;

		if (this.editMode === EditMode.SELECT) {
			const base = this.selectionBase!;

			// compute the rectangle corners; this is not trivial because
			// the coordinate system is rotated by 45 degrees
			const p1 = [.5 * base[0] + .5 * x + .5 * base[1] - .5 * y,
					.5 * base[0] - .5 * x + .5 * base[1] + .5 * y];
			const p2 = [.5 * base[0] + .5 * x - .5 * base[1] + .5 * y,
					-.5 * base[0] + .5 * x + .5 * base[1] + .5 * y];

			this.selectionRectangle.clear();
			this.selectionRectangle.beginFill(0x000000, 0.06);
			this.selectionRectangle.lineStyle(4, 0x222222);
			this.selectionRectangle.moveTo(base[0] * 80, -base[1] * 80);
			this.selectionRectangle.lineTo(p1[0] * 80, -p1[1] * 80);
			this.selectionRectangle.lineTo(x * 80, -y * 80);
			this.selectionRectangle.lineTo(p2[0] * 80, -p2[1] * 80);
			this.selectionRectangle.closePath();
			this.selectionRectangle.endFill();
		}
	}

	// button handlers

	run(): void {
		this.dropHint.clear();

		if (this.simulationMode === SimulationMode.RUNNING) {
			this.simulationMode = SimulationMode.PAUSED;
			this.runButton.setIcon("play");
			this.runButton.setTooltip("Run simulation");
			this.stepButton.setEnabled(true);
		} else {
			this.runUntil = Infinity;
			this.panMode();
			this.simulationMode = SimulationMode.RUNNING;
			this.runButton.setIcon("pause");
			this.runButton.setTooltip("Pause simulation");
			this.stepButton.setEnabled(false);
		}

		this.deselect();
		this.resetButton.setEnabled(true);
		this.selectButton.setEnabled(false);
		this.moveButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.addWallButton.setEnabled(false);
		this.annotateButton.setEnabled(false);
		this.annotationsBar.setVisible(false);
		this.saveButton.setEnabled(false);
	}

	step(): void {
		this.dropHint.clear();

		this.runUntil = Math.floor(this.time) + 1;
		this.simulationMode = SimulationMode.RUNNING;
		this.runButton.setIcon("pause");
		this.runButton.setTooltip("Pause simulation");

		this.deselect();
		this.stepButton.setEnabled(false);
		this.resetButton.setEnabled(true);
		this.panButton.setEnabled(false);
		this.selectButton.setEnabled(false);
		this.moveButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.addWallButton.setEnabled(false);
		this.annotateButton.setEnabled(false);
		this.annotationsBar.setVisible(false);
		this.saveButton.setEnabled(false);
	}

	reset(): void {
		this.simulationMode = SimulationMode.RESET;
		this.runButton.setIcon("play");
		this.runButton.setTooltip("Run simulation");
		this.stepButton.setEnabled(true);
		this.resetButton.setEnabled(false);

		this.panButton.setEnabled(true);
		this.selectButton.setEnabled(true);
		this.moveButton.setEnabled(true);
		this.addBallButton.setEnabled(true);
		this.addWallButton.setEnabled(true);
		this.annotateButton.setEnabled(true);
		this.saveButton.setEnabled(true);

		this.world.reset();
		this.time = 0;
		this.timeStep = 0;
		this.runUntil = Infinity;
	}
	
	private resetModeButtons(): void {
		this.panButton.setPressed(false);
		this.selectButton.setPressed(false);
		this.moveButton.setPressed(false);
		this.addBallButton.setPressed(false);
		this.addWallButton.setPressed(false);
		this.annotateButton.setPressed(false);
		this.annotationsBar.setVisible(false);
		this.addTextButton.setPressed(false);
		this.addLineButton.setPressed(false);
	}

	panMode(): void {
		this.editMode = EditMode.PAN;
		this.world.viewport.plugins.resume('drag');
		this.resetModeButtons();
		this.panButton.setPressed(true);
		this.dropHint.clear();
	}

	selectMode(): void {
		this.editMode = EditMode.SELECT;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.selectButton.setPressed(true);
		this.dropHint.clear();
	}

	moveMode(): void {
		this.editMode = EditMode.MOVE;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.moveButton.setPressed(true);
		this.dropHint.clear();
	}

	addBallsMode(): void {
		this.editMode = EditMode.ADD_BALL;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.addBallButton.setPressed(true);
		this.dropHint.clear();
	}
	
	addWallsMode(): void {
		this.editMode = EditMode.ADD_WALL;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.addWallButton.setPressed(true);
		this.dropHint.clear();
	}

	addTextMode(): void {
		this.editMode = EditMode.ADD_TEXT;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.annotateButton.setPressed(true);
		this.annotationsBar.setVisible(true);
		this.addTextButton.setPressed(true);
		this.dropHint.clear();
	}

	addLinesMode(): void {
		this.editMode = EditMode.ADD_LINE;
		this.world.viewport.plugins.pause('drag');
		this.resetModeButtons();
		this.annotateButton.setPressed(true);
		this.annotationsBar.setVisible(true);
		this.addLineButton.setPressed(true);
		this.dropHint.clear();
	}

	delete(): void {
		this.selection.forEach((obj) => {
			if (obj instanceof Ball) {
				const [x, y] = [obj.p.x, obj.p.y];
				this.world.removeBall(x, y);
			} else if (obj instanceof Wall) {
				this.world.removeWall(obj);
			} else if (obj instanceof Annotation) {
				this.world.removeAnnotation(obj);
			} else if (obj instanceof Line) {
				this.world.removeLine(obj);
			}
		});
		this.deselect();
	}

	save(): void {
		const file = this.world.serialize();
		const dialogs = document.getElementById('dialogs');
		dialogs!.style.display = 'block';
		const dialog = document.getElementById('save-dialog');
		dialog!.style.display = 'block';
		this.textArea.value = file;
	}

	load(data: string): void {
		this.reset();
		const newWorld = new World(this.app.renderer);
		try {
			newWorld.deserialize(data);
		} catch (e) {
			window.alert('Could not read JSON data: ' + e);
			return;
		}
		this.world = newWorld;
		this.app.stage.removeChildren();
		this.setup();
	}

	help(): void {
		const bbcs = document.getElementById('bbcs')!;
		if (this.helpButton.isPressed()) {
			this.helpButton.setPressed(false);
			document.body.classList.remove('help-pane-open');
			this.app.renderer.resize(bbcs.offsetWidth + 600, bbcs.offsetHeight);
		} else {
			this.helpButton.setPressed(true);
			document.body.classList.add('help-pane-open');
		}
		const self = this;
		setTimeout(function () {
			self.app.renderer.resize(bbcs.offsetWidth, bbcs.offsetHeight);
		}, 600);
	}
}

class Constants {
	static readonly tooltipStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 16,
		fill: "white"
	});
	static readonly tooltipSmallStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 12,
		fill: "white"
	});
	static readonly annotationStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 50,
		fill: "black"
	});
	static readonly annotationSelectionStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 50,
		strokeThickness: 5,
		stroke: 0x2277bb
	});
}

export {BBCS, Constants};

