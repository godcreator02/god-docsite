/**
 * AutoMergeRun、AutoMergeCases 在机读版里变成什么：跟画面读同一份数据（auto-merge.data.mjs）。
 * 分步的每一步用讲解组件包的 stepsText 写成一段，后面跟这一步经手的东西；每种情况用 casesText 写出情况名与说明，
 * 后面跟实测那时的三条检查各自过没过、执行器合并了还是留了言。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText, stepsText } from '@godcreator/explainer';
import { cases, commentFrame, measuredCheckNames, runSteps } from './auto-merge.data.mjs';

const checkWord = { ok: '过', bad: '不过', skip: '没查' };

function artifactText(artifact) {
  switch (artifact.kind) {
    case 'term':
      return `${artifact.title}：${artifact.lines.map((line) => (line.kind === 'cmd' ? `$ ${line.text}` : line.text)).join('；')}`;
    case 'code':
      return `${artifact.title}：${artifact.lines.filter((line) => line !== '').join(' ')}`;
    case 'checks':
      return `$ ${artifact.command}：${artifact.checks.map((check) => `${check.text}：${checkWord[check.state]}`).join('；')}。输出：${artifact.output}`;
    case 'merge':
      return `${artifact.request.join(' ')} → ${artifact.result}`;
  }
}

export function AutoMergeRun(_node, { paragraph }) {
  const texts = stepsText(runSteps);
  return runSteps.flatMap((step, i) => [paragraph(texts[i]), paragraph(artifactText(step.artifact))]);
}

export function AutoMergeCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.flatMap((item, i) => {
    const merged = item.checks.every((state) => state === 'ok');
    const checks = measuredCheckNames.map((name, index) => `${name}：${checkWord[item.checks[index]]}`).join('；');
    const pulls = item.pulls.map((pull) => `#${pull.n} ${pull.note}`).join('，');
    const action = merged ? '执行器以 collab-bot 合并，不留言。' : `collab-bot 留言：${commentFrame.head} ${item.output.join(' ')} ${commentFrame.tail}`;
    return [paragraph(texts[i]), paragraph(`（${pulls}）${checks}。${action}`)];
  });
}
