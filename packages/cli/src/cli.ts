#!/usr/bin/env node
/** livedoc 可执行入口：只管把参数递给 main、把退出码递回外面。
 * 命令：check / confirm / render / trajectory [--json] / init --dir <仓>。 */
import { main } from "./run.ts";

process.exit(await main(process.argv.slice(2)));
