/**
 * 仓的状态一变要交给的下游（通知、QQ 任务组）比报变化的各目录建得晚：装配时先建这个中转交给各目录，
 * 下游建好后 connect。接上之前就有变化是装配顺序错了，直接报错
 */
export class RepoChangeRelay {
  private listener: ((repo: string) => void) | null = null

  connect(listener: (repo: string) => void): void {
    if (this.listener !== null) throw new Error('仓变化的下游已经接上了，不能再接一个')
    this.listener = listener
  }

  readonly changed = (repo: string): void => {
    if (this.listener === null) throw new Error(`${repo} 的状态变了，但通知还没接上：装配时先建好通知与 QQ 任务组再 connect`)
    this.listener(repo)
  }
}
