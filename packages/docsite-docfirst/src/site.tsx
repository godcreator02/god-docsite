import { File, Files, Folder } from "@fumadocs/base-ui/components/files";
import { Orbit } from "lucide-react";
import type { FeatureSite } from "@godcreator/docsite-kit/feature";
import { Term } from "./term.tsx";
import { trajectoryHrefBase } from "./trajectory-href.ts";

/** 术语标注插入的 Term、目录树引用投影成的 Files / Folder / File，页面里不用 import */
const site: FeatureSite = {
  routeLinks: [{ text: "轨迹", url: trajectoryHrefBase, icon: <Orbit /> }],
  mdxComponents: { Term, Files, Folder, File },
};
export default site;
