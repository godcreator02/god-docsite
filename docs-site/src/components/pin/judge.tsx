'use client';
/**
 * 「核对一处行段引用的顺序」：五道检查从上往下排，选一种情况，高亮它依次经过的检查、每一道的回答和最后的结论。
 * 讲解文字与数据都在 judge.data.mjs，这里只负责画检查阶梯；情况胶囊与每种情况的说明由 CasePicker 显示。
 * 生成物里的机读文字由 pin.ai.mjs 读同一份数据生成。
 */
import { CasePicker, Pill } from '@godcreator/explainer/site';
import { cases, checks } from './judge.data.mjs';
import { toneOfStatus } from './tone';
import '@godcreator/explainer/styles.css';
import './pin.css';

type Case = (typeof cases)[number];

const outcomes = checks.flatMap((c) => c.outs);

function Ladder({ current }: { current: Case }) {
  const answers = new Map(current.path.map(([id, answer]) => [id, answer]));
  const result = outcomes.find((o) => o.id === current.result)!;
  return (
    <>
      <ol className="pin-ladder">
        {checks.map((c, i) => {
          const answer = answers.get(c.id);
          return (
            <li key={c.id} className="pin-check" data-reached={answer !== undefined}>
              <span className="num">{i + 1}</span>
              <span className="q">
                {c.q}
                {answer !== undefined ? <Pill role="blue">{answer}</Pill> : null}
              </span>
              <span className="d">{c.detail}</span>
              {c.outs.length > 0 ? (
                <span className="pin-outs">
                  {c.outs.map((o) => (
                    <span key={o.id} className="pin-out" data-hit={o.id === current.result}>
                      <Pill tone={toneOfStatus[o.status]} dot>
                        {o.when} → {o.label}
                      </Pill>
                    </span>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {/* 每种情况换 key，结论胶囊重新挂载，弹出动画重放一次 */}
      <Pill key={current.id} tone={toneOfStatus[result.status]} dot>
        结论：{result.label}
      </Pill>
    </>
  );
}

export function PinJudge() {
  return (
    <CasePicker cases={cases} initial={cases[1]!.id} label="选一种情况">
      {(current) => <Ladder current={current} />}
    </CasePicker>
  );
}
