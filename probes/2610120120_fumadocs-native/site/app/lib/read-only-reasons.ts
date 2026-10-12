/** 只读原因 → 界面文字。给浏览器组件用，所以不能放在 .server 模块里 */
export type ReadOnlyReason = 'no-identity' | 'identity-unknown';

export const READ_ONLY_REASONS: Record<ReadOnlyReason, string> = {
  'no-identity': '本服务没有身份码，站点只读',
  'identity-unknown': '身份码不在人员列表里，站点只读',
};
