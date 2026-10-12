import { describe, expect, it } from 'vitest'
import { CollabRepoLeads } from '../../src/collab-repo/leads.js'
import type { RemoteProject } from '../../src/project/project.js'
import { collaborators, fakeGitea } from '../fixtures/local-organization.js'

const bob: RemoteProject = {
  repo: 'D:/projects/hybrid-mmc/collab',
  collabDir: 'D:/projects/hybrid-mmc/collab/collab',
  siteDir: 'D:/projects/hybrid-mmc/collab/site',
  person: 'bob',
  remote: { env: {} },
  gitea: { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' },
}

describe('项目负责人', () => {
  it('读协作仓的协作者；还没读到为 null；一样就不报变化，换了才报；忘掉以后回到 null', async () => {
    const rounds = [collaborators('admin'), collaborators('admin'), collaborators('admin', 'carol')]
    const changed: string[] = []
    const leads = new CollabRepoLeads(fakeGitea({ 'GET /repos/hybrid-mmc/collab/collaborators': () => rounds.shift()! }).http, (repo) => changed.push(repo))
    expect(leads.leadsOf(bob.repo)).toBeNull()
    await leads.refresh(bob)
    await leads.refresh(bob)
    expect(leads.leadsOf(bob.repo)).toEqual(['admin'])
    await leads.refresh(bob)
    expect(leads.leadsOf('d:/PROJECTS/hybrid-mmc/collab')).toEqual(['admin', 'carol'])
    expect(changed).toEqual([bob.repo, bob.repo])
    leads.forget(bob.repo)
    expect(leads.leadsOf(bob.repo)).toBeNull()
  })
})
