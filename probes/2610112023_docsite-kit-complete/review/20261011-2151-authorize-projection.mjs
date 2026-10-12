import { authorizeWrite } from '../../../packages/docsite-identity/src/server/write-access.ts';
const origin = 'http://127.0.0.1:5460';
const request = new Request(origin + '/api/comments', { method: 'POST', headers: { Origin: origin } });
const stored = { id: 'review-person', name: 'Review', codes: ['testcode0123'], extra: 'server-only' };
const agent = { id: 'review-agent', name: 'Agent', agent: true, extra: 'server-only' };
const cases = [
 ['current identity', authorizeWrite(request, { identity: { person: stored }, people: [stored, agent], origin })],
 ['agent identity', authorizeWrite(request, { identity: { person: stored }, people: [stored, agent], as: agent.id, origin })],
];
let failed = false;
for (const [label, value] of cases) {
 const unexpected = Object.keys(value).filter(key => !['id','name','gitea','agent'].includes(key));
 console.log(JSON.stringify({label, unexpectedKeys: unexpected, projected: unexpected.length === 0}));
 if (unexpected.length) failed = true;
}
process.exitCode = failed ? 1 : 0;

