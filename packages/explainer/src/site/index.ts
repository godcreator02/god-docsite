/**
 * `@godcreator/explainer/site`：讲解组件，正文里直接 import。只 import react 与本包 core/。
 */

export type { Role, Tone } from "../core/colors.ts";
export { Stepper } from "./stepper.tsx";
export type { StepItem, StepperProps } from "./stepper.tsx";
export { Timeline } from "./timeline.tsx";
export type { Chapter, TimelineFrame, TimelineProps } from "./timeline.tsx";
export { CasePicker } from "./case-picker.tsx";
export type { CaseItem, CasePickerProps } from "./case-picker.tsx";
export { CodeLines, Diff, Dot, Pane, Pill, Terminal } from "./parts.tsx";
export type { CodeLinesProps, PaneProps, PillProps, TerminalLine, TerminalProps } from "./parts.tsx";
export type { PaneIcon } from "./icons.tsx";
export { SeamDiagram, cap } from "./seam-diagram.tsx";
export type { Box, Icon, SeamDiagramProps, SeamLayout } from "./seam-diagram.tsx";
