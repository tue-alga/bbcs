import * as PIXI from 'pixi.js';

import {Direction, Ball, Color} from './ball';
import {Wall} from './wall';
import {Annotation} from './annotation';
import {World} from './world';
import {Button, Separator, Toolbar} from './ui';

enum EditMode {
	SELECT, ADD_BALL, ADD_WALL, ADD_ANNOTATION
}

enum SimulationMode {
	RUNNING, PAUSED, RESET
}

class BBCS {
	private app: PIXI.Application;

	editMode: EditMode = EditMode.SELECT;
	time: number = 0.0;
	timeStep: number = 0;
	runUntil: number = Infinity;

	simulationMode: SimulationMode = SimulationMode.RESET;
	timeSpeed: number = 0.05;

	world: World;

	// the "shadow" appearing below the cursor when in an addition mode
	dropHint = new PIXI.Graphics();

	// selected objects
	private selection: (Ball | Wall | Annotation) [] = [];

	// direction and color of last-edited ball
	// (remembered to insert new balls with the same direction and color)
	private lastDirection = Direction.RIGHT;
	private lastColor = Color.BLUE;

	// GUI elements
	private bottomBar: Toolbar;

	private runButton: Button;
	private stepButton: Button;
	private resetButton: Button;
	
	private selectButton: Button;
	private addBallButton: Button;
	private addWallButton: Button;
	private addAnnotationButton: Button;

	private rotateLeftButton: Button;
	private rotateRightButton: Button;
	private colorButton: Button;
	private deleteButton: Button;

	private saveButton: Button;

	private textArea = document.getElementById('save-textarea') as HTMLTextAreaElement;

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

		this.selectButton = new Button(
			"select", "Select objects", "S");
		this.selectButton.setPressed(true);
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

		this.addAnnotationButton = new Button(
			"add-annotation", "Add annotation", "A");
		this.addAnnotationButton.onClick(this.addAnnotationsMode.bind(this));
		this.bottomBar.addChild(this.addAnnotationButton);

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

		this.bottomBar.rebuildPixi();
		this.app.stage.addChild(this.bottomBar.getPixi());

		this.world.balls.forEach((ball) => {
			ball.placeDots(0);
		});

		// click handler
		this.world.pixi.interactive = true;
		this.world.pixi.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);  // TODO should be infinite ...
		this.world.pixi.on('click', this.worldClickHandler.bind(this));
		this.world.pixi.on('tap', this.worldClickHandler.bind(this));
		this.world.pixi.on('mousemove', this.worldMouseMoveHandler.bind(this));

		// key handlers
		window.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key === " ") {
				this.run();
			} else if (event.key === "r") {
				this.reset();
			} else if (event.key === "s") {
				this.selectMode();
			} else if (event.key === "b") {
				this.addBallsMode();
			} else if (event.key === "w") {
				this.addWallsMode();
			} else if (event.key === "a") {
				this.addAnnotationsMode();
			} else if (event.key === "Delete") {
				this.delete();
			}
		});

		this.update();
	}

	update(): void {
	}

	select(obj: Ball | Wall | Annotation): void {
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

			if (this.editMode === EditMode.SELECT) {
				this.deselect();
				const ball = this.world.getBall(Math.round(x), Math.round(y));
				if (ball) {
					this.deselect();
					this.select(ball);
				} else {
					const [from, to] = this.getWallCoordinates(Math.floor(x), Math.floor(y));
					const wall = this.world.getWall(from, to);
					if (wall) {
						this.deselect();
						this.select(wall);
					} else {
						const annotation = this.world.getAnnotation(Math.round(x), Math.round(y));
						if (annotation) {
							this.deselect();
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

			if (this.editMode === EditMode.ADD_ANNOTATION) {
				let text = window.prompt('Enter annotation text');
				if (text) {
					const newAnnotation = this.world.addAnnotation(
							[Math.round(x), Math.round(y)], text);
					this.deselect();
					this.select(newAnnotation);
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

			if (this.editMode === EditMode.ADD_ANNOTATION) {
				x = Math.round(x);
				y = Math.round(y);

				this.dropHint.x = x * 80;
				this.dropHint.y = -y * 80;
				this.dropHint.beginFill(0x2277bb);
				this.dropHint.drawCircle(0, 0, 10);
				this.dropHint.endFill();
			}
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
		this.addAnnotationButton.setEnabled(false);
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
		this.addAnnotationButton.setEnabled(false);
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
		this.addAnnotationButton.setEnabled(true);
		this.saveButton.setEnabled(true);

		this.world.reset();
		this.time = 0;
		this.timeStep = 0;
		this.runUntil = Infinity;
	}

	selectMode(): void {
		this.editMode = EditMode.SELECT;
		this.selectButton.setPressed(true);
		this.addBallButton.setPressed(false);
		this.addWallButton.setPressed(false);
		this.addAnnotationButton.setPressed(false);
		this.dropHint.clear();
	}

	addBallsMode(): void {
		this.editMode = EditMode.ADD_BALL;
		this.selectButton.setPressed(false);
		this.addBallButton.setPressed(true);
		this.addWallButton.setPressed(false);
		this.addAnnotationButton.setPressed(false);
		this.dropHint.clear();
	}
	
	addWallsMode(): void {
		this.editMode = EditMode.ADD_WALL;
		this.selectButton.setPressed(false);
		this.addBallButton.setPressed(false);
		this.addWallButton.setPressed(true);
		this.addAnnotationButton.setPressed(false);
		this.dropHint.clear();
	}

	addAnnotationsMode(): void {
		this.editMode = EditMode.ADD_ANNOTATION;
		this.selectButton.setPressed(false);
		this.addBallButton.setPressed(false);
		this.addWallButton.setPressed(false);
		this.addAnnotationButton.setPressed(true);
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
			}
			this.deselect();
		});
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

