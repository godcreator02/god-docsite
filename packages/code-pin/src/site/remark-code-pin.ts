/**
 * 站点的 remark 插件：认出页面里的钉码标记、一次核对完，每处换成一个钉码外框（`codePin` 节点）。
 * 外框转成 HTML 是一个 `<details class="code-pin" data-pin-status="…">`：`<summary>` 一行写位置与状态，
 * 点开才是代码块或文件树。新鲜与未确认默认收起，有变动与缺失默认展开（要人看的才摊开）。
 * 状态点由 pin.css 画；状态写在外框节点的 hast 属性上，里面的代码块 meta 只有 fumadocs 认的标题与行号。
 *
 * 钉在哪个项目里核对由站点传入：通常是 `@godcreator/code-pin/node` 的 `createDiskPinner(站点目录)`。
 */
import type { Paragraph, Root } from "mdast";
import { replacePinMarkers } from "../core/index.ts";
import type { CodePin, PinCheck, Pinner } from "../core/index.ts";
import { displayNodeOf, STATUS_LABEL, whereOf } from "./display.ts";

export interface RemarkCodePinOptions {
  pinner: Pinner;
}

/** remark 插件收到的文件：fumadocs-mdx 编译每一页都带着 path */
interface PageFile {
  path?: string;
}

/** 收起时看得见的那一行：位置（今天的行号）加状态 */
function summaryOf(check: PinCheck): Paragraph {
  return {
    type: "paragraph",
    data: { hName: "summary", hProperties: { className: ["code-pin-summary"] } },
    children: [
      { type: "inlineCode", value: whereOf(check) },
      { type: "text", value: ` · ${STATUS_LABEL[check.status]}` },
    ],
  };
}

const OPEN_BY_DEFAULT = new Set(["changed", "missing"]);

function frame(pin: CodePin): void {
  const { check } = pin;
  pin.children = [summaryOf(check), displayNodeOf(check)];
  pin.data = {
    hName: "details",
    hProperties: {
      className: ["code-pin"],
      dataPinStatus: check.status,
      dataPinKind: check.pin.target.kind,
      ariaLabel: `钉码：${STATUS_LABEL[check.status]}`,
      open: OPEN_BY_DEFAULT.has(check.status),
    },
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
