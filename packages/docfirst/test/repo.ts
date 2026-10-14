/**
 * 测试夹具：一份被钉的代码与跑 git 的帮手。
 */
import { execFileSync } from "node:child_process";

export const CODE = [
  "// greet",
  "export function greet(name: string): string {",
  "  return `hello ${name}`;",
  "}",
  "",
  "export const VERSION = 1;",
  "",
].join("\n");

export function run(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
}

/** 身份与换行策略用 `-c` 现传，不写进 `git config`；工作区一律 LF：Windows 上自动换行转换会让工作区和 blob 逐字节不同 */
export const SETTINGS = ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "core.autocrlf=false"];
