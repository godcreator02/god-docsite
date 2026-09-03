/** 命令行入口：notes add <文字> 记一条，notes list 列出来 */
import { add } from "./add.ts";
import { list } from "./list.ts";

const [command, ...rest] = process.argv.slice(2);
if (command === "add") add(rest.join(" "));
else if (command === "list") list();
else console.log("用法：notes add <文字> | notes list");
