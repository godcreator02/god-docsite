/** example.data.mjs 的类型：站点的类型检查收 content/，数据文件是 .mjs，类型写在这里 */

export interface BodyBlock {
  kind: 'heading' | 'para';
  text: string;
  /** 段首有一张图片（页面文字里整个算一个字） */
  image?: boolean;
  /** 被批的那段字：画面上铺划字的高亮 */
  quoted?: boolean;
}

/** 页面文字里的一个字；atomic 的（图片这类整体元素）画面上要加注 */
export interface PageChar {
  char: string;
  atomic?: boolean;
}

export declare const people: { id: string; name: string; codes?: string[]; agent?: boolean }[];
export declare const trustedOrigin: string;
export declare const pageKey: string;
export declare const bodyBlocks: BodyBlock[];
export declare const snapshot: string;
export declare const snapshotChars: PageChar[];
export declare const quote: string;
export declare const quoteSpan: [number, number];
export declare const commentBody: string;
export declare const threadId: string;
export declare const createdAt: string;
export declare const anchorFields: { quote: string; start: number; end: number; snapshot: string };
export declare const anchorJson: string;
