import { Code, Pane, Stepper, SvgTex } from '@godcreator/collab-site/page-components'

const pseudo = 'while t < t_end:\n    outputs(t, x)\n    updates(t, x)\n    x = integrate(x, t, h)'
const steps = [1, 2, 3].map((line) => ({ title: `第 ${line} 步`, text: `高亮第 ${line + 1} 行`, line: line + 1 }))

export function Explainer() {
  return (
    <Stepper steps={steps}>
      {(step) => (
        <Pane title="伪代码" role="blue">
          <Code language="python" highlightLines={[step.line]}>{pseudo}</Code>
        </Pane>
      )}
    </Stepper>
  )
}

export function Diagram() {
  return (
    <svg viewBox="0 0 400 120" className="w-full rounded-lg border border-line">
      <rect x="40" y="40" width="80" height="40" fill="none" stroke="currentColor" />
      <SvgTex x={80} y={60}>{String.raw`L_\sigma`}</SvgTex>
      <SvgTex x={200} y={60} anchor="start" color="var(--collab-info)">{String.raw`i_L(t)=\frac{v_L}{L_\sigma}t`}</SvgTex>
    </svg>
  )
}
