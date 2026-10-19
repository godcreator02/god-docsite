/**
 * `@godcreator/explainer/site`：讲解组件，正文里直接 import。只 import react 与本包 core/。
 */

export type { Role, Tone } from "../core/colors.ts";
export { Stepper } from "./stepper.tsx";
export type { RichStepItem, StepItem, StepperProps } from "./stepper.tsx";
export { Timeline } from "./timeline.tsx";
export type { Chapter, RichChapter, TimelineFrame, TimelineProps } from "./timeline.tsx";
export { CasePicker } from "./case-picker.tsx";
export type { CaseItem, CasePickerProps, RichCaseItem } from "./case-picker.tsx";
export { CodeLines, Diff, Dot, Pane, Pill, Terminal } from "./parts.tsx";
export type { CodeLinesProps, PaneProps, PillProps, TerminalLine, TerminalProps } from "./parts.tsx";
export type { PaneIcon } from "./icons.tsx";
export { CompareGrid, revealByRow } from "./compare-grid.tsx";
export type { CellState, CompareCell, CompareColumn, CompareGridProps, CompareRow } from "./compare-grid.tsx";
export { clamp01, ease, ramp } from "./progress.ts";
export { SeamDiagram, cap } from "./seam-diagram.tsx";
export type { Box, Icon, SeamDiagramProps, SeamLayout } from "./seam-diagram.tsx";
