import { TaskBoard } from '@collab/ui'

export const meta = { title: '任务总览' }

export default function Page() {
  return (
    <div className="space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">任务总览</h1>
      <TaskBoard />
    </div>
  )
}
