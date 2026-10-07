import { type InkPoint, type InkStroke, StrokeRenderer, clamp, decodePoints, renderStroke } from '@sveltebrush/core';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
	Box,
	Circle2d,
	DefaultColorStyle,
	DefaultSizeStyle,
	type Editor,
	HTMLContainer,
	Polyline2d,
	type RecordProps,
	ShapeUtil,
	type SvgExportContext,
	T,
	type TLDefaultColorStyle,
	type TLDefaultSizeStyle,
	type TLResizeInfo,
	type TLShape,
	Vec,
	type VecLike,
	createShapePropsMigrationSequence,
	getColorValue,
	useEditor,
	useValue
} from 'tldraw';
import { INK_LEVELS, INK_SIZES, InkBrushStyle, InkLoadStyle, type TLInkBrushStyle, type TLInkLoadStyle } from './styles.js';

export const INK_SHAPE_TYPE = 'sveltebrush-ink';

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		[INK_SHAPE_TYPE]: {
			/** Brush input in shape space, packed with `encodePoints` (x, y, pressure). */
			points: string;
			isPen: boolean;
			isComplete: boolean;
			/** Texture seed: the same points and seed always paint the same pixels. */
			seed: number;
			brush: TLInkBrushStyle;
			ink: TLInkLoadStyle;
			color: TLDefaultColorStyle;
			size: TLDefaultSizeStyle;
			scale: number;
			scaleX: number;
			scaleY: number;
		};
	}
}

/** @public */
export type InkShape = TLShape<typeof INK_SHAPE_TYPE>;

/** @public */
export interface InkShapeOptions {
	/** How much pointer input is smoothed, 0 (raw) – 1. */
	readonly streamline: number;
	/** A stroke ends by itself after this many points. */
	readonly maxPoints: number;
}

const decoded = new Map<string, InkPoint[]>();

/** Decoding is cached, because geometry, indicator and rendering all read the same points. */
function decode(text: string) {
	let points = decoded.get(text);
	if (!points) {
		points = decodePoints(text);
		if (decoded.size > 500) decoded.delete(decoded.keys().next().value as string);
		decoded.set(text, points);
	}
	return points;
}

/** The stroke's points in shape space, with any resize applied. */
export function getInkPoints(shape: InkShape): InkPoint[] {
	const { scaleX, scaleY } = shape.props;
	const points = decode(shape.props.points);
	return scaleX === 1 && scaleY === 1 ? points : points.map(([x, y, p]) => [x * scaleX, y * scaleY, p]);
}

/** Brush size in page units. */
export function getInkSize(shape: InkShape) {
	const { size, scale, scaleX, scaleY } = shape.props;
	return INK_SIZES[size] * scale * Math.sqrt(Math.abs(scaleX * scaleY));
}

/** The shape as Sveltebrush stroke data, ready for `renderStroke`. */
export function getInkStroke(shape: InkShape, color: string): InkStroke {
	return {
		points: getInkPoints(shape),
		brush: shape.props.brush,
		size: getInkSize(shape),
		color,
		ink: INK_LEVELS[shape.props.ink],
		seed: shape.props.seed
	};
}

/** The ink colour for a tldraw colour style in a colour mode. */
export function getInkColor(editor: Editor, color: TLDefaultColorStyle, mode = editor.getColorMode()) {
	return getColorValue(editor.getCurrentTheme().colors[mode], color, 'solid');
}

/** Half the width of the stroke at full pressure. */
const inkRadius = (shape: InkShape) => getInkSize(shape) * 0.5;

/**
 * A centreline as thick as the stroke, so clicking, brushing and erasing hit the
 * ink rather than a hairline. The bounds are padded in proportion to the shape's
 * scale, so they stretch exactly as tldraw expects when the shape is resized.
 */
class InkGeometry extends Polyline2d {
	constructor(
		points: Vec[],
		private readonly radius: number,
		private readonly pad: VecLike
	) {
		super({ points });
	}

	override getBounds() {
		const { x, y, w, h } = super.getBounds();
		return new Box(x - this.pad.x, y - this.pad.y, w + this.pad.x * 2, h + this.pad.y * 2);
	}

	override distanceToPoint(point: VecLike, hitInside = false) {
		return Math.max(0, super.distanceToPoint(point, hitInside) - this.radius);
	}

	override hitTestLineSegment(A: VecLike, B: VecLike, distance = 0) {
		return super.hitTestLineSegment(A, B, distance + this.radius);
	}
}

/** Bitmap resolution steps half an octave apart, so zooming re-renders only now and then. */
const resolutionFor = (pixels: number) => 2 ** (Math.ceil(Math.log2(clamp(pixels, 0.25, 8)) * 2) / 2);

const isDot = (shape: InkShape) => {
	const points = getInkPoints(shape);
	if (points.length < 2) return true;
	const box = Box.FromPoints(points.map(([x, y]) => ({ x, y })));
	return box.width < inkRadius(shape) && box.height < inkRadius(shape);
};

/** @public */
export class InkShapeUtil extends ShapeUtil<InkShape> {
	static override type = INK_SHAPE_TYPE;
	static override props: RecordProps<InkShape> = {
		points: T.string,
		isPen: T.boolean,
		isComplete: T.boolean,
		seed: T.number,
		brush: InkBrushStyle,
		ink: InkLoadStyle,
		color: DefaultColorStyle,
		size: DefaultSizeStyle,
		scale: T.nonZeroNumber,
		scaleX: T.nonZeroFiniteNumber,
		scaleY: T.nonZeroFiniteNumber
	};
	static override migrations = createShapePropsMigrationSequence({ sequence: [] });

	override options: InkShapeOptions = { streamline: 0.35, maxPoints: 4000 };

	override getDefaultProps(): InkShape['props'] {
		return {
			points: '',
			isPen: false,
			isComplete: false,
			seed: 0,
			brush: 'center',
			ink: 'loaded',
			color: 'black',
			size: 'm',
			scale: 1,
			scaleX: 1,
			scaleY: 1
		};
	}

	override hideResizeHandles(shape: InkShape) {
		return isDot(shape);
	}

	override hideRotateHandle(shape: InkShape) {
		return isDot(shape);
	}

	override getGeometry(shape: InkShape) {
		const points = getInkPoints(shape);
		const radius = inkRadius(shape);
		if (isDot(shape)) {
			const [x = 0, y = 0] = points[0] ?? [];
			return new Circle2d({ x: x - radius, y: y - radius, radius, isFilled: true });
		}
		const { size, scale, scaleX, scaleY } = shape.props;
		const unscaled = INK_SIZES[size] * scale * 0.5;
		return new InkGeometry(
			points.map(([x, y]) => new Vec(x, y)),
			radius,
			{ x: unscaled * Math.abs(scaleX), y: unscaled * Math.abs(scaleY) }
		);
	}

	override component(shape: InkShape) {
		return (
			<HTMLContainer style={{ overflow: 'visible', pointerEvents: 'none' }}>
				<InkStrokeView shape={shape} />
			</HTMLContainer>
		);
	}

	override getIndicatorPath(shape: InkShape) {
		const points = getInkPoints(shape);
		const path = new Path2D();
		if (isDot(shape)) {
			const [x = 0, y = 0] = points[0] ?? [];
			path.arc(x, y, inkRadius(shape), 0, Math.PI * 2);
			return path;
		}
		path.moveTo(points[0][0], points[0][1]);
		for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
		return path;
	}

	override toSvg(shape: InkShape, ctx: SvgExportContext) {
		const color = getInkColor(this.editor, shape.props.color, ctx.colorMode);
		const dpr = clamp(ctx.scale * (ctx.pixelRatio ?? 2), 1, 4);
		const { canvas, bounds } = renderStroke(getInkStroke(shape, color), { dpr });
		if (!bounds.width || !bounds.height) return null;
		return (
			<image
				href={(canvas as HTMLCanvasElement).toDataURL('image/png')}
				x={bounds.x}
				y={bounds.y}
				width={bounds.width}
				height={bounds.height}
			/>
		);
	}

	override onResize(shape: InkShape, info: TLResizeInfo<InkShape>) {
		const scaleX = info.scaleX * shape.props.scaleX;
		const scaleY = info.scaleY * shape.props.scaleY;
		if (scaleX === 0 || scaleY === 0) return;
		return { props: { scaleX, scaleY } };
	}
}

/** Paints one ink shape into its own canvas, adding only new points while it is being drawn. */
function InkStrokeView({ shape }: { shape: InkShape }) {
	const editor = useEditor();
	const ref = useRef<HTMLCanvasElement>(null);
	const renderer = useMemo(() => new StrokeRenderer(), []);
	useEffect(() => () => renderer.destroy(), [renderer]);

	const style = shape.props.color;
	const color = useValue('ink color', () => getInkColor(editor, style), [editor, style]);
	const culled = useValue('ink culled', () => editor.getCulledShapes().has(shape.id), [editor, shape.id]);
	const resolution = useValue(
		'ink resolution',
		() => resolutionFor(editor.getEfficientZoomLevel() * editor.getInstanceState().devicePixelRatio),
		[editor]
	);

	useLayoutEffect(() => {
		const canvas = ref.current;
		if (!canvas || (culled && renderer.count > 0)) return;
		const complete = shape.props.isComplete;
		if (!renderer.update(getInkStroke(shape, color), { complete, dpr: resolution })) return;
		renderer.paint(canvas);
		const { x, y, width, height } = renderer.bounds;
		Object.assign(canvas.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
		if (complete) renderer.release();
	});

	return <canvas ref={ref} className="sveltebrush-ink" style={{ position: 'absolute' }} />;
}
