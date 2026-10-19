/**
 * Product facts for a document database. The compiler turns these into diagnostics.
 * Shared checks (index coverage, field names, scope agreement, missing targets)
 * live in the caller and run for every profile, including an unset one.
 */

export const STORE_PROFILE_NAMES = [
  "couchdb",
  "mongodb",
  "dynamodb",
  "cosmosdb",
  "firestore",
] as const;

export type StoreProfileName = (typeof STORE_PROFILE_NAMES)[number];

export type EnforcementClaim = "document" | "partition" | "transaction" | "application";

export type StoreProfile = {
  name: StoreProfileName;
  /** Name used in diagnostic sentences. */
  product: string;
  /**
   * `when-declared` follows the `partitioned` flag.
   * `always` means every container has a partition key.
   * `never` means the product does not take a document partition key.
   */
  partitionMode: "when-declared" | "always" | "never";
  /** Partition key is a prefix of the physical document id. */
  partitionInDocumentId: boolean;
  /** One read grant covers every document in the database. */
  databaseReadAudience: boolean;
  /** A multi-document rule can be committed inside one partition. */
  partitionCommit: boolean;
  /** A bounded multi-document transaction can cross partitions. */
  multiDocumentTransaction: boolean;
  /** How a read that leaves one partition should be reported. */
  crossPartition: "when-partitioned" | "requires-global-index" | "collection-group";
};

const PROFILES: Record<StoreProfileName, StoreProfile> = {
  couchdb: {
    name: "couchdb",
    product: "CouchDB",
    partitionMode: "when-declared",
    partitionInDocumentId: true,
    databaseReadAudience: true,
    partitionCommit: false,
    multiDocumentTransaction: false,
    crossPartition: "when-partitioned",
  },
  mongodb: {
    name: "mongodb",
    product: "MongoDB",
    partitionMode: "when-declared",
    partitionInDocumentId: false,
    databaseReadAudience: false,
    partitionCommit: true,
    multiDocumentTransaction: true,
    crossPartition: "when-partitioned",
  },
  dynamodb: {
    name: "dynamodb",
    product: "DynamoDB",
    partitionMode: "always",
    partitionInDocumentId: false,
    databaseReadAudience: false,
    partitionCommit: true,
    multiDocumentTransaction: true,
    crossPartition: "requires-global-index",
  },
  cosmosdb: {
    name: "cosmosdb",
    product: "Cosmos DB",
    partitionMode: "always",
    partitionInDocumentId: false,
    databaseReadAudience: false,
    partitionCommit: true,
    multiDocumentTransaction: false,
    crossPartition: "when-partitioned",
  },
  firestore: {
    name: "firestore",
    product: "Firestore",
    partitionMode: "never",
    partitionInDocumentId: false,
    databaseReadAudience: false,
    partitionCommit: false,
    multiDocumentTransaction: true,
    crossPartition: "collection-group",
  },
};

export function resolveStoreProfile(raw: string | undefined): StoreProfile | undefined {
  if (!raw) return undefined;
  const name = raw.trim().toLowerCase();
  if (isStoreProfileName(name)) return PROFILES[name];
  return undefined;
}

export function isStoreProfileName(name: string): name is StoreProfileName {
  return (STORE_PROFILE_NAMES as readonly string[]).includes(name);
}

export function storeIsPartitioned(
  profile: StoreProfile | undefined,
  partitioned: boolean | undefined,
): boolean {
  if (profile?.partitionMode === "always") return true;
  if (profile?.partitionMode === "never") return false;
  return partitioned === true;
}

export function enforcementFits(
  profiles: StoreProfile[],
  enforcement: EnforcementClaim | undefined,
  readsMany: boolean,
): boolean {
  if (!readsMany || enforcement === "application") return true;
  if (!enforcement || enforcement === "document") return false;
  if (profiles.length === 0) return false;
  return profiles.every((profile) => claimFits(profile, enforcement));
}

function claimFits(profile: StoreProfile, enforcement: "partition" | "transaction"): boolean {
  if (enforcement === "partition") return profile.partitionCommit;
  return profile.multiDocumentTransaction;
}

export function missingPartitionKeyMessage(profile: StoreProfile, documentId: string): string {
  if (profile.name === "couchdb") {
    return `Partitioned CouchDB document "${documentId}" has no partition field`;
  }
  if (profile.name === "mongodb") {
    return `Sharded MongoDB document "${documentId}" has no shard key`;
  }
  return `${profile.product} document "${documentId}" has no partition key`;
}

export function missingPartitionKeyHint(profile: StoreProfile): string {
  if (profile.name === "couchdb") {
    return "Set partition to the field embedded in the document _id, for example partition: employeeId.";
  }
  if (profile.name === "mongodb") {
    return "Set partition to the shard key field. The shard key stays a document field.";
  }
  if (profile.name === "dynamodb") {
    return "Set partition to the table partition key attribute.";
  }
  return "Set partition to the container partition key.";
}

export function partitionFlagMessage(
  profile: StoreProfile,
  databaseId: string,
): string | undefined {
  if (profile.partitionMode === "always") {
    return `${profile.product} database "${databaseId}" is marked unpartitioned, and every ${containerNoun(profile)} has a partition key`;
  }
  if (profile.partitionMode === "never") {
    return `${profile.product} database "${databaseId}" is marked partitioned, and ${profile.product} does not take a document partition key`;
  }
  return undefined;
}

export function partitionFlagHint(profile: StoreProfile): string {
  if (profile.partitionMode === "never") {
    return "Remove partitioned and scope each access path by collection.";
  }
  return "Remove partitioned: false and set partition on each document.";
}

export function rejectedPartitionMessage(profile: StoreProfile, documentId: string): string {
  return `${profile.product} document "${documentId}" sets a partition key, and ${profile.product} does not take one`;
}

export function crossPartitionMessage(
  profile: StoreProfile,
  accessId: string,
  globalIndexId: string | undefined,
): string {
  if (profile.name === "couchdb") return `Access "${accessId}" crosses CouchDB partitions`;
  if (profile.name === "mongodb") {
    return `Access "${accessId}" misses the MongoDB shard key and scatters across shards`;
  }
  if (profile.name === "dynamodb") {
    return globalIndexId
      ? `Access "${accessId}" uses global secondary index "${globalIndexId}", which has its own partition key`
      : `Access "${accessId}" queries across DynamoDB partitions without a global secondary index`;
  }
  if (profile.name === "firestore") {
    return `Access "${accessId}" is a Firestore collection group query`;
  }
  return `Access "${accessId}" crosses ${profile.product} partitions`;
}

export function crossPartitionHint(profile: StoreProfile, usedGlobalIndex: boolean): string {
  if (profile.name === "couchdb") {
    return "Partition-local queries read one shard range. A global index or a duplicated projection serves cross-partition reads.";
  }
  if (profile.name === "mongodb") {
    return "Include the shard key for a targeted query, or record this scatter-gather read as a tradeoff.";
  }
  if (profile.name === "dynamodb") {
    return usedGlobalIndex
      ? "A global secondary index is eventually consistent by default and has its own throughput."
      : "A Query on the base table needs the partition key. Model a global secondary index or a Scan as its own access path.";
  }
  if (profile.name === "cosmosdb") {
    return "A cross-partition query is allowed and is billed in request units.";
  }
  return "A collection group query needs a collection group index, and security rules apply to each matching document.";
}

export function firestorePartitionScopeMessage(accessId: string): string {
  return `Access "${accessId}" asks for a partition query, and Firestore does not have partition keys`;
}

export function scopeMismatchHint(profile: StoreProfile | undefined): string {
  if (profile?.name === "couchdb") {
    return "A partitioned CouchDB index cannot answer a query across partitions.";
  }
  if (profile?.name === "mongodb") {
    return "A shard-local index does not answer a query across shards.";
  }
  if (profile?.name === "dynamodb") {
    return "A local secondary index stays on the table partition key. Use a global secondary index for a cross-partition read.";
  }
  if (profile?.name === "cosmosdb") {
    return "A partition-scoped index does not serve a cross-partition query.";
  }
  if (profile?.name === "firestore") {
    return "Use one scope for the access path and the index: a collection, or a collection group.";
  }
  return "The access path and the index cover different scopes.";
}

export function atomicBoundaryMessage(
  invariantId: string,
  enforcement: EnforcementClaim | undefined,
  profiles: StoreProfile[],
): string {
  if (enforcement === "partition" || enforcement === "transaction") {
    const unable = profiles.filter((profile) => !claimFits(profile, enforcement));
    const named = (unable.length > 0 ? unable : profiles).map((profile) => profile.product);
    if (named.length === 0) {
      return `Invariant "${invariantId}" claims enforcement "${enforcement}" and no database profile says the store can commit it`;
    }
    return enforcement === "partition"
      ? `Invariant "${invariantId}" is enforced in one partition, and ${joinProducts(named)} cannot commit a partition as one unit`
      : `Invariant "${invariantId}" uses a multi-document transaction, and ${joinProducts(named)} cannot commit one`;
  }
  if (enforcement === "document") {
    return `Invariant "${invariantId}" reads more than one document but enforcement is a single document`;
  }
  return `Invariant "${invariantId}" reads more than one document and does not say where that is enforced`;
}

export function atomicBoundaryHint(
  enforcement: EnforcementClaim | undefined,
  profiles: StoreProfile[],
): string {
  if (profiles.length > 1) {
    return "Name an enforcement every database involved can commit, or set enforcement: application.";
  }
  const profile = profiles[0];
  if (!profile) return "Set enforcement to document, partition, transaction, or application.";
  if (enforcement === "document") {
    return `${boundaryFact(profile)} Keep the rule in one document, or set enforcement: application and name the coordination.`;
  }
  return `${boundaryFact(profile)} ${enforcementAdvice(profile)}`;
}

function boundaryFact(profile: StoreProfile): string {
  if (profile.name === "couchdb") return "CouchDB commits one document at a time.";
  if (profile.name === "mongodb") return "MongoDB can commit a bounded multi-document transaction.";
  if (profile.name === "dynamodb") {
    return "DynamoDB TransactWriteItems commits up to 100 items across partition keys.";
  }
  if (profile.name === "cosmosdb")
    return "Cosmos DB commits atomically inside one logical partition.";
  return "A Firestore transaction reads every document before it writes.";
}

function enforcementAdvice(profile: StoreProfile): string {
  if (profile.name === "couchdb") return "Set enforcement: document or enforcement: application.";
  if (profile.name === "cosmosdb") return "Set enforcement: partition or enforcement: application.";
  return "Set enforcement: transaction or enforcement: application.";
}

function containerNoun(profile: StoreProfile): string {
  if (profile.name === "dynamodb") return "table";
  if (profile.name === "cosmosdb") return "container";
  return "database";
}

function joinProducts(products: string[]): string {
  if (products.length === 1) return products[0]!;
  if (products.length === 2) return `${products[0]} and ${products[1]}`;
  return `${products.slice(0, -1).join(", ")}, and ${products.at(-1)}`;
}
