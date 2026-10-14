#!/usr/bin/env node
/** docfirst 可执行文件：项目根是当前目录，只转发参数与退出码 */
import { main } from "./cli.ts";

process.exit(await main(process.argv.slice(2)));
