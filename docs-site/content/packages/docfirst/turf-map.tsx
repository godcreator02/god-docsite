'use client';
/**
 * TurfMap：同一个站目录里的文件各归谁核对。左边树（缩进加竖线），每个文件右边一个胶囊标归类；
 * 右边一列图例，树下面一行灰字。数据都在 turf-map.data.mjs。
 */
import type { JSX } from 'react';
import { Pane, Pill } from '@godcreator/explainer/site';
import { kinds, note, tree } from './turf-map.data.mjs';
import type { TreeNode } from './turf-map.data.mjs';
import './turf-map.css';

const kindOf = new Map(kinds.map((kind) => [kind.id, kind]));

function TreeLevel({ items, depth }: { items: TreeNode[]; depth: number }): JSX.Element {
  return (
    <>
      {items.map((node) => {
        const kind = node.kind === undefined ? undefined : kindOf.get(node.kind);
        return (
          <div key={`${depth}:${node.name}`} className="tm-item">
            <div className="tm-row">
              <span className="tm-name" data-dir={node.children === undefined ? undefined : true}>{node.name}</span>
              {kind === undefined ? null : <Pill role={kind.role}>{kind.label}</Pill>}
            </div>
            {node.children === undefined ? null : (
              <div className="tm-children">
                <TreeLevel items={node.children} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function TurfMap(): JSX.Element {
  return (
    <div className="dx tm-board not-prose">
      <div className="tm-main">
        <Pane title={tree.name} icon="folder" role="slate">
          <div className="tm-tree">
            <TreeLevel items={tree.children ?? []} depth={0} />
          </div>
        </Pane>
        <div className="tm-legend">
          {kinds.map((kind) => (
            <div key={kind.id} className="tm-legend-item">
              <Pill role={kind.role}>{kind.label}</Pill>
              <span className="tm-legend-note">{kind.note}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="tm-note">{note}</p>
    </div>
  );
}
