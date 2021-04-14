import * as PIXI from 'pixi.js';

import {Direction, Ball, Color} from './ball';
import {Wall} from './wall';
import {Annotation} from './annotation';
import {Line} from './line';
import {World} from './world';
import {Button, Separator, Toolbar} from './ui';

enum EditMode {
	PAN, SELECT, ADD_BALL, ADD_WALL, ADD_TEXT, ADD_LINE
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

	lineStart: [number, number] | null = null;

	// selected objects
	private selection: (Ball | Wall | Annotation | Line) [] = [];

	// direction and color of last-edited ball
	// (remembered to insert new balls with the same direction and color)
	private lastDirection = Direction.RIGHT;
	private lastColor = Color.BLUE;

	// main toolbar
	private bottomBar: Toolbar;

	private runButton: Button;
	private stepButton: Button;
	private resetButton: Button;
	
	private panButton: Button;
	private selectButton: Button;
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

		this.world = new World();

		this.bottomBar = new Toolbar();

		this.runButton = new Button("play", "Run simulation", "Space");
		this.runButton.onClick(this.run.bind(this));
		this.bottomBar.addChild(this.runButton);

		this.stepButton = new Button("step", "Run one step");
		this.stepButton.onClick(this.step.bind(this));
		this.bottomBar.addChild(this.stepButton);

		this.resetButton = new Button("reset", "Reset simulation", "R");
		this.resetButton.onClick(this.reset.bind(this));
		this.resetButton.setEnabled(false);
		this.bottomBar.addChild(this.resetButton);

		this.bottomBar.addChild(new Separator());

		this.panButton = new Button(
			"select", "Pan the canvas", "P");
		this.panButton.setPressed(true);
		this.panButton.onClick(this.panMode.bind(this));
		this.bottomBar.addChild(this.panButton);

		this.selectButton = new Button(
			"select", "Select objects", "S");
		this.selectButton.onClick(this.selectMode.bind(this));
		this.bottomBar.addChild(this.selectButton);

		this.addBallButton = new Button(
			"add-ball", "Add balls", "B");
		this.addBallButton.onClick(this.addBallsMode.bind(this));
		this.bottomBar.addChild(this.addBallButton);

		this.addWallButton = new Button(
			"add-wall", "Add walls", "W");
		this.addWallButton.onClick(this.addWallsMode.bind(this));
		this.bottomBar.addChild(this.addWallButton);

		this.annotateButton = new Button(
			"add-annotation", "Add annotations");
		this.annotateButton.onClick(this.addTextMode.bind(this));
		this.bottomBar.addChild(this.annotateButton);

		this.bottomBar.addChild(new Separator());

		this.rotateLeftButton = new Button(
			"rotate-left", "Rotate left");
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
			"rotate-right", "Rotate right");
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
			"color", "Change color");
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
			"delete", "Delete selected", "Delete");
		this.deleteButton.onClick(this.delete.bind(this));
		this.deleteButton.setEnabled(false);
		this.bottomBar.addChild(this.deleteButton);

		this.bottomBar.addChild(new Separator());

		this.saveButton = new Button(
			"save", "Save & load");
		this.saveButton.onClick(this.save.bind(this));
		this.bottomBar.addChild(this.saveButton);

		this.annotationsBar = new Toolbar();

		this.addTextButton = new Button(
			"add-annotation", "Add text", "T");
		this.addTextButton.onClick(this.addTextMode.bind(this));
		this.annotationsBar.addChild(this.addTextButton);

		this.addLineButton = new Button(
			"add-wall", "Add lines", "L");
		this.addLineButton.onClick(this.addLinesMode.bind(this));
		this.annotationsBar.addChild(this.addLineButton);

		// set up event handlers for dialog buttons
		const loadButton = document.getElementById('load-button');
		loadButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
			this.load(this.textArea.value);
		});

		const closeButton = document.getElementById('close-button');
		closeButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
		});


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

		this.world.pixi.x = window.innerWidth / 2;
		this.world.pixi.y = window.innerHeight / 2;
		
		this.bottomBar.setPosition(
			window.innerWidth / 2 - this.bottomBar.getWidth() / 2,
			window.innerHeight - this.bottomBar.getHeight());
		this.annotationsBar.setPosition(
			window.innerWidth / 2 - this.annotationsBar.getWidth() / 2,
			window.innerHeight - 2 * this.annotationsBar.getHeight());

		this.world.balls.forEach((ball) => {
			ball.updatePosition(this.time, this.timeStep);
		});
	}
	
	worldClickHandler(e: PIXI.interaction.InteractionEvent): void {
		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;
		this.dropHint.clear();

		if (this.simulationMode === SimulationMode.RESET) {

			if (this.editMode === EditMode.PAN) {
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
		}
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
			this.simulationMode = SimulationMode.RUNNING;
			this.runButton.setIcon("pause");
			this.runButton.setTooltip("Pause simulation");
			this.stepButton.setEnabled(false);
		}

		this.deselect();
		this.resetButton.setEnabled(true);
		this.selectButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.addWallButton.setEnabled(false);
		this.annotateButton.setPressed(false);
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
		this.selectButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.addWallButton.setEnabled(false);
		this.annotateButton.setPressed(false);
		this.annotationsBar.setVisible(false);
		this.saveButton.setEnabled(false);
	}

	reset(): void {
		this.simulationMode = SimulationMode.RESET;
		this.runButton.setIcon("play");
		this.runButton.setTooltip("Run simulation");
		this.stepButton.setEnabled(true);
		this.resetButton.setEnabled(false);

		this.selectButton.setEnabled(true);
		this.addBallButton.setEnabled(true);
		this.addWallButton.setEnabled(true);
		this.annotateButton.setPressed(false);
		this.annotationsBar.setVisible(false);
		this.saveButton.setEnabled(true);

		this.world.reset();
		this.time = 0;
		this.timeStep = 0;
		this.runUntil = Infinity;
	}
	
	private resetModeButtons(): void {
		this.panButton.setPressed(false);
		this.selectButton.setPressed(false);
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
		this.textArea.value = file;
	}

	load(data: string): void {
		const newWorld = new World();
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

