import { createSite, CreateSiteError } from './create.ts'

const usage = '用法：node src/cli.ts --dir <站点目录> --template <模板目录>'

type ParsedCommandLine = { dir: string; templateDir: string } | { problems: string[] }

function parseCommandLine(argv: readonly string[]): ParsedCommandLine {
  const values: Record<string, string> = {}
  const problems: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!
    const equalsAt = arg.indexOf('=')
    const name = equalsAt === -1 ? arg : arg.slice(0, equalsAt)
    let value = equalsAt === -1 ? undefined : arg.slice(equalsAt + 1)
    if (name !== '--dir' && name !== '--template') {
      problems.push(`不认识的参数：${arg}`)
      continue
    }
    if (value === undefined) {
      value = argv[++index]
      if (value === undefined) {
        problems.push(`${name} 后面要跟一个值`)
        continue
      }
    }
    if (values[name] !== undefined) {
      problems.push(`${name} 只能给一次`)
      continue
    }
    values[name] = value
  }
  if (values['--dir'] === undefined) problems.push('缺少 --dir <站点目录>')
  if (values['--template'] === undefined) problems.push('缺少 --template <模板目录>')
  return problems.length > 0 ? { problems } : { dir: values['--dir']!, templateDir: values['--template']! }
}

function main(): number {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage)
    return 0
  }
  const parsed = parseCommandLine(argv)
  if ('problems' in parsed) {
    console.error(usage)
    for (const problem of parsed.problems) console.error(problem)
    return 2
  }
  const result = createSite({ dir: parsed.dir, templateDir: parsed.templateDir })
  console.log(`已创建站点：${parsed.dir}`)
  console.log(`新建文件 ${result.createdFiles.length} 个`)
  if (result.keptFiles.length > 0) {
    console.log(`保留目标里已有的 ${result.keptFiles.length} 个：`)
    for (const kept of result.keptFiles) console.log(`  ${kept}`)
  }
  return 0
}

try {
  process.exitCode = main()
} catch (error) {
  if (error instanceof CreateSiteError) {
    console.error(`create-docsite：${error.message}`)
    for (const detail of error.details) console.error(`  ${detail}`)
    process.exitCode = 1
  } else {
    throw error
  }
}
