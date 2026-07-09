import type { ConnectionStrength, StoryCluster } from "@/lib/types";

type NodeRef = {
  key: string;
  label: string;
  type: "tag" | "entity";
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function nodesForCluster(cluster: StoryCluster) {
  const nodes = new Map<string, NodeRef>();

  for (const tag of cluster.tags) {
    const key = normalize(tag);
    if (key) {
      nodes.set(`tag:${key}`, { key, label: tag, type: "tag" });
    }
  }

  for (const entity of cluster.entities) {
    const key = normalize(entity.normalized || entity.name);
    if (key) {
      nodes.set(`entity:${key}`, { key, label: entity.name, type: "entity" });
    }
  }

  return Array.from(nodes.values());
}

function pairKey(left: NodeRef, right: NodeRef) {
  const pair = [left, right].sort((a, b) => `${a.type}:${a.key}`.localeCompare(`${b.type}:${b.key}`));
  return `${pair[0].type}:${pair[0].key}::${pair[1].type}:${pair[1].key}`;
}

export function computeConnections(clusters: StoryCluster[]): ConnectionStrength[] {
  const edges = new Map<
    string,
    {
      left: NodeRef;
      right: NodeRef;
      weight: number;
      clusterIds: Set<string>;
    }
  >();

  for (const cluster of clusters) {
    const nodes = nodesForCluster(cluster).slice(0, 12);

    for (let index = 0; index < nodes.length; index += 1) {
      for (let nestedIndex = index + 1; nestedIndex < nodes.length; nestedIndex += 1) {
        const left = nodes[index];
        const right = nodes[nestedIndex];
        const key = pairKey(left, right);
        const existing = edges.get(key) ?? {
          left,
          right,
          weight: 0,
          clusterIds: new Set<string>(),
        };
        const typeWeight = left.type === "entity" || right.type === "entity" ? 1.5 : 1;

        existing.weight += typeWeight;
        existing.clusterIds.add(cluster.id);
        edges.set(key, existing);
      }
    }
  }

  return Array.from(edges.entries())
    .map(([id, edge]) => ({
      id,
      source: edge.left.label,
      target: edge.right.label,
      sourceType: edge.left.type,
      targetType: edge.right.type,
      weight: Number(edge.weight.toFixed(1)),
      clusterIds: Array.from(edge.clusterIds),
    }))
    .filter((edge) => edge.weight >= 1.5 || edge.clusterIds.length > 1)
    .sort((left, right) => right.weight - left.weight || right.clusterIds.length - left.clusterIds.length)
    .slice(0, 15);
}
