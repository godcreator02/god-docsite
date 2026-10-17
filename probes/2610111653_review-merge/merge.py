"""Bounded semantic three-way merge. No Word, I/O, or automatic decisions."""
from copy import deepcopy
from hashlib import sha256
import json


def fingerprint(value):
    return sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def walk(value):
    if isinstance(value,dict):
        yield value
        for child in value.values():yield from walk(child)
    elif isinstance(value,list):
        for child in value:yield from walk(child)


def index(content):
    nodes=[n for n in walk(content) if 'id' in n]
    result={n['id']:n for n in nodes}
    if len(result)!=len(nodes):raise ValueError('Duplicate source IDs')
    return result


def candidate(kind,target,**kwargs):
    value=dict(kind=kind,targetId=target,**kwargs)
    return dict(id='change-'+fingerprint(value)[:16],**value)


def apply_review(base,current,base_layout,current_layout,proposal,decisions):
    """All-or-nothing; same-field divergence and missing anchors become conflicts."""
    if proposal['baseContentHash']!=fingerprint(base) or proposal['baseLayoutHash']!=fingerprint(base_layout):
        raise ValueError('Proposal base mismatch')
    if decisions.get('proposalHash')!=fingerprint(proposal):raise ValueError('Stale or unrelated decision set')
    choices=decisions['choices'];change_ids={c['id'] for c in proposal['changes']}
    if set(choices)!=change_ids:raise ValueError('Decision set must cover exactly this proposal')
    if set(choices.values())-{'accept','reject','pending'}:raise ValueError('Unknown review decision')
    content,layout=deepcopy(current),deepcopy(current_layout)
    report=[];conflicts=[];pending=[]
    baseline=index(base)
    for change in proposal['changes']:
        cid=change['id'];choice=choices[cid]
        if choice=='pending':pending.append(cid);continue
        if choice=='reject':report.append(dict(id=cid,status='rejected'));continue
        target=change['targetId'];kind=change['kind'];nodes=index(content)
        reason=None;status='applied'
        if kind=='layout':
            b=base_layout.get(target,{})
            if b!=change['before']:raise ValueError('Untrusted proposal before-value')
            value=layout.get(target,{})
            if value==change['after']:status='already-applied'
            elif value!=b:reason='layout-changed-by-both'
            else:layout[target]=deepcopy(change['after'])
        elif target not in baseline or target not in nodes:
            reason='target-missing'
        elif kind=='replace':
            field=change['field'];b=baseline[target].get(field)
            if b!=change['before']:raise ValueError('Untrusted proposal before-value')
            value=nodes[target].get(field)
            if value==change['after']:status='already-applied'
            elif value!=b:reason='same-field-changed-by-both'
            else:nodes[target][field]=deepcopy(change['after'])
        elif kind=='insert':
            field=change['field'];anchor=change['afterId'];next_id=change['nextId'];new=change['items']
            bseq=baseline[target][field];seq=nodes[target][field]
            bpos=next((i for i,n in enumerate(bseq) if n['id']==anchor),None)
            if bpos is None or (bseq[bpos+1]['id'] if bpos+1<len(bseq) else None)!=next_id:
                raise ValueError('Untrusted insertion context')
            pos=next((i for i,n in enumerate(seq) if n['id']==anchor),None)
            if pos is None:reason='insertion-anchor-missing'
            elif seq[pos+1:pos+1+len(new)]==new:status='already-applied'
            elif any(n['id'] in nodes for n in walk(new) if 'id' in n):reason='inserted-id-collision'
            elif (seq[pos+1]['id'] if pos+1<len(seq) else None)!=next_id:reason='insertion-boundary-changed'
            else:seq[pos+1:pos+1]=deepcopy(new)
        else:raise ValueError('Unsupported change kind')
        if reason:
            conflicts.append(dict(id=cid,targetId=target,reason=reason,
                base=change.get('before'),current=deepcopy(nodes.get(target)),proposed=change.get('after',change.get('items'))))
        else:report.append(dict(id=cid,status=status))
    if conflicts or pending:
        return dict(status='needs-review',conflicts=conflicts,pending=pending,operations=report,content=None,layout=None)
    index(content)
    return dict(status='merged',conflicts=[],pending=[],operations=report,content=content,layout=layout)
