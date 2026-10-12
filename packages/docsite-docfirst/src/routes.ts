import type { FeatureRoutes } from "@godcreator/docsite-kit/feature";

/** 星轨盘占满整个窗口，放在整站布局外面；卡页在整站布局里 */
const routes: FeatureRoutes = {
  routes: [
    { path: "trajectory", file: "dist/routes/disk.mjs", layout: false },
    { path: "trajectory/*", file: "dist/routes/card.mjs" },
  ],
};
export default routes;
