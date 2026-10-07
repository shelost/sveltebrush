import { type Input, type InkPoint, createInput, encodePoints, newSeed } from '@sveltebrush/core';
import { StateNode, type TLPointerEventInfo, type TLShapeId, type TLStateNodeConstructor, createShapeId } from 'tldraw';
import { INK_SHAPE_TYPE, type InkShape, type InkShapeUtil, getInkSize } from './InkShapeUtil.js';

export const INK_TOOL_ID = 'ink';

class InkIdle extends StateNode {
	static override id = 'idle';

	override onEnter() {
		this.editor.setCursor({ type: 'cross', rotation: 0 });
	}

	override onPointerDown(info: TLPointerEventInfo) {
		this.parent.transition('drawing', info);
	}

	override onCancel() {
		this.editor.setCurrentTool('select');
	}
}

class InkDrawing extends StateNode {
	static override id = 'drawing';

	info = {} as TLPointerEventInfo;
	shapeId: TLShapeId | null = null;
	input: Input | null = null;
	points: InkPoint[] = [];
	markId = '';

	override onEnter(info: TLPointerEventInfo) {
		this.info = info;
		const { editor } = this;
		const { inputs } = editor;
		const origin = inputs.getOriginPagePoint();
		const z = info.point.z ?? 0.5;
		// Like tldraw's draw tool: a pen reporting zero pressure is probably broken, and a mouse
		// reporting fractional pressure is probably a stylus.
		const isPen = (inputs.getIsPen() && z !== 0) || (z > 0 && z < 0.5) || (z > 0.5 && z < 1);
		const util = editor.getShapeUtil<InkShapeUtil>(INK_SHAPE_TYPE);

		this.markId = editor.markHistoryStoppingPoint('ink start');
		this.input = createInput({ pen: isPen, streamline: util.options.streamline });
		this.points = [];
		const first = this.input.push(0, 0, { pressure: z, velocity: 0 });
		if (first) this.points.push(first);

		const id = createShapeId();
		editor.createShape<InkShape>({
			id,
			type: INK_SHAPE_TYPE,
			x: origin.x,
			y: origin.y,
			props: {
				points: encodePoints(this.points),
				isPen,
				seed: newSeed(),
				scale: editor.getResizeScaleFactor()
			}
		});
		this.shapeId = editor.getShape(id) ? id : null;
		if (!this.shapeId) this.cancel();
	}

	override onPointerMove() {
		const shape = this.getShape();
		if (!shape || !this.input) return;
		const { editor } = this;
		const page = editor.inputs.getCurrentPagePoint();
		const local = editor.getPointInShapeSpace(shape, page);
		const point = this.input.push(local.x, local.y, {
			pressure: page.z ?? 0.5,
			velocity: editor.inputs.getPointerVelocity().len()
		});
		if (!point) return;
		this.points.push(point);
		editor.updateShapes<InkShape>([{ id: shape.id, type: INK_SHAPE_TYPE, props: { points: encodePoints(this.points) } }]);
		if (this.points.length >= editor.getShapeUtil<InkShapeUtil>(INK_SHAPE_TYPE).options.maxPoints) this.complete();
	}

	override onPointerUp() {
		this.complete();
	}

	override onComplete() {
		this.complete();
	}

	override onCancel() {
		this.cancel();
	}

	override onInterrupt() {
		if (this.editor.inputs.getIsDragging()) return;
		if (this.markId) this.editor.bailToMark(this.markId);
		this.cancel();
	}

	override onExit() {
		this.input = null;
		this.shapeId = null;
	}

	getShape() {
		return this.shapeId ? this.editor.getShape<InkShape>(this.shapeId) : undefined;
	}

	/** Lift the brush: catch up with the pointer, flick if it was moving fast, and mark the stroke finished. */
	complete() {
		const shape = this.getShape();
		if (shape && this.input) {
			this.points.push(...this.input.end(getInkSize(shape)));
			this.editor.updateShapes<InkShape>([
				{ id: shape.id, type: INK_SHAPE_TYPE, props: { points: encodePoints(this.points), isComplete: true } }
			]);
		}
		this.parent.transition('idle');
	}

	cancel() {
		this.parent.transition('idle', this.info);
	}
}

/** @public */
export class InkShapeTool extends StateNode {
	static override id = INK_TOOL_ID;
	static override initial = 'idle';
	static override isLockable = false;
	static override useCoalescedEvents = true;
	static override children(): TLStateNodeConstructor[] {
		return [InkIdle, InkDrawing];
	}

	override shapeType = INK_SHAPE_TYPE;
}
