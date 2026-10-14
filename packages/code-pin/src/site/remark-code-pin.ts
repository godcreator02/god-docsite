/**
 * 站点的 remark 插件：认出页面里的钉码标记、一次核对完，每处换成一个钉码外框（`codePin` 节点）。
 * 外框转成 HTML 是一个 `<div class="code-pin" data-pin-status="…">`，状态点由 pin.css 画；
 * 状态写在外框节点的 hast 属性上，里面的代码块 meta 只有 fumadocs 认的标题与行号。
 *
 * 钉在哪个项目里核对由站点传入：通常是 `@godcreator/code-pin/node` 的 `createDiskPinner(站点目录)`。
 */
import type { Root } from "mdast";
import { replacePinMarkers } from "../core/index.ts";
import type { CodePin, Pinner } from "../core/index.ts";
import { displayNodeOf, STATUS_LABEL } from "./display.ts";

export interface RemarkCodePinOptions {
  pinner: Pinner;
}

/** remark 插件收到的文件：fumadocs-mdx 编译每一页都带着 path */
interface PageFile {
  path?: string;
}

function frame(pin: CodePin): void {
  const { check } = pin;
  pin.children = [displayNodeOf(check)];
  pin.data = {
    hName: "div",
    hProperties: { className: ["code-pin"], dataPinStatus: check.status, dataPinKind: check.pin.target.kind, role: "group", ariaLabel: `钉码：${STATUS_LABEL[check.status]}` },
  };
}

export function remarkCodePin({ pinner }: RemarkCodePinOptions): (tree: Root, file: PageFile) => void {
  return (tree, file) => {
    try {
      replacePinMarkers(tree, (pins) => pinner.check(pins)).forEach(frame);
    } catch (err) {
      throw new Error(`${file.path ?? "（没有路径的页面）"} ${(err as Error).message}`, { cause: err });
    }
  };
}
