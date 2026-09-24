import { readFileSync } from "node:fs";

import { CustomEditor, keyHint, keyText, rawKeyHint, VERSION } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

type EditorFactory = NonNullable<Parameters<ExtensionUIContext["setEditorComponent"]>[0]>;

type Rgb = [number, number, number];

const FALLBACK_COLORS: Rgb[] = [
	[240, 144, 130],
	[77, 154, 191],
	[241, 190, 88],
];

const ICON_GRID: (number | undefined)[][] = [
	[0, 0, 0, undefined],
	[1, undefined, 0, undefined],
	[1, 1, undefined, 2],
	[1, undefined, undefined, 2],
];

function readIconColors(): Rgb[] {
	try {
		const svg = readFileSync(new URL("../assets/pi.svg", import.meta.url), "utf8");
		const fills = [...svg.matchAll(/fill="#([0-9a-f]{6})"/gi)].map((match) => match[1]);
		if (fills.length < 3) return FALLBACK_COLORS;
		return fills.slice(0, 3).map((hex) => [
			parseInt(hex.slice(0, 2), 16),
			parseInt(hex.slice(2, 4), 16),
			parseInt(hex.slice(4, 6), 16),
		]);
	} catch {
		return FALLBACK_COLORS;
	}
}

const ICON_COLORS = readIconColors();

function nearestAnsi256([red, green, blue]: Rgb): number {
	const cube = [0, 95, 135, 175, 215, 255];
	const cubeIndex = (value: number) => cube.reduce((best, candidate, index) => {
		return Math.abs(candidate - value) < Math.abs(cube[best] - value) ? index : best;
	}, 0);
	const redIndex = cubeIndex(red);
	const greenIndex = cubeIndex(green);
	const blueIndex = cubeIndex(blue);
	const cubeColor = [cube[redIndex], cube[greenIndex], cube[blueIndex]];
	const cubeDistance = cubeColor.reduce((sum, value, index) => sum + (value - [red, green, blue][index]) ** 2, 0);
	const gray = Math.round((red + green + blue) / 3);
	const grayIndex = Math.max(0, Math.min(23, Math.round((gray - 8) / 10)));
	const grayValue = 8 + grayIndex * 10;
	const grayDistance = [red, green, blue].reduce((sum, value) => sum + (grayValue - value) ** 2, 0);
	return cubeDistance <= grayDistance ? 16 + 36 * redIndex + 6 * greenIndex + blueIndex : 232 + grayIndex;
}

function colorize(theme: Theme, color: Rgb, text: string): string {
	if (theme.getColorMode() === "truecolor") {
		return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${text}\x1b[39m`;
	}
	return `\x1b[38;5;${nearestAnsi256(color)}m${text}\x1b[39m`;
}

function renderIcon(theme: Theme): string[] {
	return ICON_GRID.map((row) => row.map((colorIndex) => {
		if (colorIndex === undefined) return "  ";
		return colorize(theme, ICON_COLORS[colorIndex], "██");
	}).join(""));
}

function renderInstructions(theme: Theme, thinkingColor: (text: string) => string): string[] {
	const separator = theme.fg("muted", " · ");
	return [
		`${theme.bold(thinkingColor("pi"))}${theme.fg("dim", ` v${VERSION}`)}`,
		[
			keyHint("app.interrupt", "interrupt"),
			rawKeyHint(`${keyText("app.clear")}/${keyText("app.exit")}`, "clear/exit"),
		].join(separator),
		[
			rawKeyHint("/", "commands"),
			rawKeyHint("!", "bash"),
			keyHint("app.tools.expand", "more"),
		].join(separator),
	];
}

function createHeader(getTheme: () => Theme, getThinkingLevel: () => Parameters<Theme["getThinkingBorderColor"]>[0]): Component {
	return {
		render(width: number): string[] {
			if (width < 6) return [];

			const theme = getTheme();
			const thinkingColor = theme.getThinkingBorderColor(getThinkingLevel());
			const iconLines = renderIcon(theme);
			const iconWidth = iconLines.reduce((max, line) => Math.max(max, visibleWidth(line)), 0);
			const gap = 2;
			const textLines = renderInstructions(theme, thinkingColor);
			const textWidth = textLines.reduce((max, line) => Math.max(max, visibleWidth(line)), 0);
			const contentWidth = Math.max(0, Math.min(width - 6, iconWidth + gap + textWidth));
			const textOffset = Math.floor((iconLines.length - textLines.length) / 2);
			const border = thinkingColor;
			const horizontalBorder = "─".repeat(contentWidth + 4);

			const contentLines = iconLines.map((iconLine, index) => {
				const paddedIcon = iconLine + " ".repeat(Math.max(0, iconWidth - visibleWidth(iconLine)));
				const textLine = textLines[index - textOffset] ?? "";
				const content = truncateToWidth(`${paddedIcon}${" ".repeat(gap)}${textLine}`, contentWidth);
				const padding = " ".repeat(Math.max(0, contentWidth - visibleWidth(content)));
				return `${border("│")}  ${content}${padding}  ${border("│")}`;
			});

			const blankLine = `${border("│")}  ${" ".repeat(contentWidth)}  ${border("│")}`;

			return [
				border(`╭${horizontalBorder}╮`),
				blankLine,
				...contentLines,
				blankLine,
				border(`╰${horizontalBorder}╯`),
			];
		},
		invalidate() {},
	};
}

function createDimBorderEditor(getTheme: () => Theme): EditorFactory {
	return (tui, editorTheme, keybindings) => {
		const editor = new CustomEditor(tui, editorTheme, keybindings);
		const dimBorder = (text: string) => getTheme().fg("dim", text);

		Object.defineProperty(editor, "borderColor", {
			configurable: true,
			enumerable: true,
			get: () => dimBorder,
			set: () => {},
		});

		return editor;
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode === "tui") {
			ctx.ui.setHeader(() => createHeader(() => ctx.ui.theme, () => pi.getThinkingLevel()));
			ctx.ui.setEditorComponent(createDimBorderEditor(() => ctx.ui.theme));
		}
	});
}
