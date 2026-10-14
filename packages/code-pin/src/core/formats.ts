import { codeFormat } from "./code-format.ts";
import type { PinFormat } from "./doc-pins.ts";
import { mdxFormat } from "./mdx.ts";

/** 认得的两种格式：mdx 页面、讲解组件源码 */
export const PIN_FORMATS: readonly PinFormat[] = [mdxFormat, codeFormat];
