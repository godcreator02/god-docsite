import { createContext, use, useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { avatarContentType, avatarFileInSite, avatarSize, avatarWriteUrl, type AvatarWriteResult } from '../core/avatar.js'
import type { SiteIdentity } from '../core/identity.js'
import type { PublicPerson } from '../core/public-people.js'
import { avatarWebpOf } from './avatar-image.js'

type SiteIdentityContextValue = {
  identity: SiteIdentity
  people: readonly PublicPerson[]
  /** 这个人的头像地址：本页上传或删过的以那次的结果为准，否则看人员列表里的 avatar；没有头像为 undefined */
  avatarOf: (personId: string) => string | undefined
  /** 本页上传或删掉本机身份的头像之后记下新地址（上传后是刚传那张图的本地地址，删掉是 null），页面上各处的 Avatar 跟着换 */
  avatarChanged: (personId: string, avatar: string | null) => void
}

const SiteIdentityContext = createContext<SiteIdentityContextValue | null>(null)

/**
 * 把本机身份与人员列表交给页面里的组件。people 只收 PublicPerson：站点的 loader 先用 publicPeopleOf 或 publicPeopleWithAvatars 投影再放进 loader 数据。
 * 不变式：交给浏览器的人员不带身份码；类型挡不住 as 断言，渲染时再查一次，带着就报错
 */
export function IdentityProvider({ identity, people, children }: { identity: SiteIdentity; people: readonly PublicPerson[]; children: ReactNode }) {
  const personWithCodes = people.find((person) => 'codes' in person)
  if (personWithCodes) throw new Error(`交给浏览器的人员列表带着身份码（${personWithCodes.id}）：先经 publicPeopleOf 投影`)
  const [avatarChanges, setAvatarChanges] = useState<ReadonlyMap<string, string | null>>(new Map())
  const avatarChanged = useCallback((personId: string, avatar: string | null) => setAvatarChanges((changes) => new Map(changes).set(personId, avatar)), [])
  const value = useMemo<SiteIdentityContextValue>(() => {
    const avatarOf = (personId: string) => {
      const changed = avatarChanges.get(personId)
      if (changed !== undefined) return changed ?? undefined
      return people.find((person) => person.id === personId)?.avatar
    }
    return { identity, people, avatarOf, avatarChanged }
  }, [identity, people, avatarChanges, avatarChanged])
  return <SiteIdentityContext value={value}>{children}</SiteIdentityContext>
}

function useSiteIdentityContext(hookName: string): SiteIdentityContextValue {
  const value = use(SiteIdentityContext)
  if (value === null) throw new Error(`${hookName} 要在 IdentityProvider 里面用`)
  return value
}

/** 本机身份：有人时是公开形状的那个人，只读时带原因 */
export function useSiteIdentity(): SiteIdentity {
  return useSiteIdentityContext('useSiteIdentity').identity
}

/** 站点的人员列表（公开形状）：写 @ 时弹名单、按 id 显示名字用 */
export function useSitePeople(): readonly PublicPerson[] {
  return useSiteIdentityContext('useSitePeople').people
}

function hueOfId(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 360
  return hash
}

/**
 * 头像：按 person.id 在 IdentityProvider 的人员列表里查头像地址，有就画那张图；没有就画名字的第一个字加一个由 id 算出的底色（改名不变色）。
 * 要在 IdentityProvider 里面用。样式在包的 styles.css（.dc-avatar），宿主引入后就有
 */
export function Avatar({ person, size = 24 }: { person: PublicPerson; size?: number }) {
  const avatar = useSiteIdentityContext('Avatar').avatarOf(person.id)
  if (avatar !== undefined) return <img aria-hidden="true" alt="" className="dc-avatar" src={avatar} width={size} height={size} style={{ width: size, height: size }} />
  return (
    <span
      aria-hidden="true"
      className="dc-avatar"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: `hsl(${hueOfId(person.id)} 45% 45%)` }}
    >
      {[...person.name][0]!.toUpperCase()}
    </span>
  )
}

/** 把头像写入路由的回答读出来：成功是 JSON，被拒时是纯文本的原因，原样报出来 */
async function avatarWriteResultOf(response: Response): Promise<AvatarWriteResult> {
  if (!response.ok) throw new Error((await response.text()).trim() || `头像写入失败：HTTP ${response.status}`)
  return (await response.json()) as AvatarWriteResult
}

/** 头像面板：看当前头像、选图片上传（浏览器里裁成正方形、缩到 128×128、转 webp）、改回首字。只给本机身份的那个人用 */
function AvatarPanel({ person, onClose }: { person: PublicPerson; onClose: () => void }) {
  const { avatarOf, avatarChanged } = useSiteIdentityContext('AvatarPanel')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasAvatar = avatarOf(person.id) !== undefined

  /** shownAvatar：写成功后本页显示什么；不给就用服务端回的地址 */
  async function write(label: string, init: RequestInit, shownAvatar?: () => string) {
    setBusy(label)
    setError(null)
    try {
      const { avatar } = await avatarWriteResultOf(await fetch(avatarWriteUrl, init))
      avatarChanged(person.id, shownAvatar ? shownAvatar() : avatar)
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : String(writeError))
    } finally {
      setBusy(null)
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    setBusy('处理图片…')
    setError(null)
    let image: Blob
    try {
      image = await avatarWebpOf(file)
    } catch (imageError) {
      setBusy(null)
      setError(imageError instanceof Error ? imageError.message : String(imageError))
      return
    }
    // 本页先显示刚传的这张（本地地址）：dev 服务认出 public/ 里的新文件要几十毫秒，立刻取服务端地址会拿到 404 并被浏览器缓存住
    await write('上传中…', { method: 'PUT', headers: { 'content-type': avatarContentType }, body: image }, () => URL.createObjectURL(image))
  }

  return (
    <div className="dc-avatar-panel" data-avatar-panel="">
      <div className="dc-avatar-panel-head">
        <span>头像</span>
        <button type="button" className="dc-avatar-panel-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="dc-avatar-panel-current">
        <Avatar person={person} size={72} />
        <span className="dc-identity-name">{person.name}</span>
      </div>
      <p className="dc-avatar-panel-hint">
        选一张图，居中裁成正方形、缩到 {avatarSize}×{avatarSize} 后存成站点里的 <code>{avatarFileInSite(person.id)}</code>；提交以后别人也能看到。
      </p>
      <div className="dc-avatar-panel-actions">
        <label className="dc-avatar-button" aria-disabled={busy !== null}>
          选图片
          <input type="file" accept="image/*" hidden disabled={busy !== null} data-avatar-file="" onChange={(event) => void upload(event)} />
        </label>
        {hasAvatar && (
          <button type="button" className="dc-avatar-button" disabled={busy !== null} data-avatar-remove="" onClick={() => void write('删除中…', { method: 'DELETE' })}>
            改回首字
          </button>
        )}
      </div>
      {busy !== null && <p className="dc-avatar-panel-hint">{busy}</p>}
      {error !== null && (
        <p className="dc-avatar-panel-error" role="alert" data-avatar-error="">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * 侧栏底部显示的当前身份：有身份显示头像与名字，点开是头像面板（换自己的头像）；只读时写「只读」，鼠标停上去看原因，没有面板。
 * 要在 IdentityProvider 里面用。主题切换属于宿主站点，由它放在这个组件旁边。样式在包的 styles.css（.dc-identity），宿主引入后就有
 */
export function IdentityBadge({ identity }: { identity: SiteIdentity }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const { person } = identity
  if (!person) {
    return (
      <span className="dc-identity dc-identity-readonly" title={identity.reason}>
        只读
      </span>
    )
  }
  const close = () => dialogRef.current?.close()
  return (
    <>
      <button
        type="button"
        className="dc-identity dc-identity-button"
        data-identity-badge=""
        title={`评论署名：${person.name}（人员列表里的 ${person.id}，按本机的身份码认出）；点开换头像`}
        onClick={() => {
          setOpen(true)
          dialogRef.current?.showModal()
        }}
      >
        <Avatar person={person} size={22} />
        <span className="dc-identity-name">{person.name}</span>
      </button>
      <dialog ref={dialogRef} className="dc-avatar-dialog" onClose={() => setOpen(false)} onClick={(event) => event.target === event.currentTarget && close()}>
        {open && <AvatarPanel person={person} onClose={close} />}
      </dialog>
    </>
  )
}
