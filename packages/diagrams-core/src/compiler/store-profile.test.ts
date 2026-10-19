import { describe, expect, it } from "vite-plus/test";
import { parse } from "../parser/parser.ts";
import { compile } from "./compile.ts";

function warnings(body: string): Array<{ code: string; message: string; hint?: string }> {
  const result = compile(parse(`diagram {\n${body}\n}`));
  expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  return result.diagnostics.map((item) => ({
    code: item.code ?? "",
    message: item.message,
    hint: item.hint,
  }));
}

function codes(body: string): string[] {
  return warnings(body).map((item) => item.code);
}

describe("database profiles", () => {
  it("lets a MongoDB shard key stay out of _id and share a database across audiences", () => {
    const found = warnings(`
      database accounts "accounts" {
        profile: mongodb
        partitioned: true
        audience: "customers"
        order: document "Order" {
          idPattern: "{orderId}"
          partition: customerId
          audience: "support"
          fields { customerId: string required partition }
        }
        byCustomer: index "By customer" {
          on: order
          scope: partitioned
          keys: [customerId]
        }
      }
      customerOrders: access "Customer orders" {
        on: order
        scope: partition
        using: byCustomer
      }
    `);
    expect(found.map((item) => item.code)).not.toContain("DM201");
    expect(found.map((item) => item.code)).not.toContain("DM205");
    expect(found.map((item) => item.code)).not.toContain("DM206");
  });

  it("warns when a sharded MongoDB document has no shard key and when a query scatters", () => {
    const found = warnings(`
      database accounts "accounts" {
        profile: MongoDB
        partitioned: true
        order: document "Order" { fields { customerId: string } }
        byStatus: index "By status" { on: order scope: global keys: [status] }
      }
      openOrders: access "Open orders" { on: order scope: global using: byStatus }
    `);
    expect(found.map((item) => item.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("has no shard key"),
        expect.stringContaining('key "status"'),
        expect.stringContaining("scatters across shards"),
      ]),
    );
  });

  it("requires the partition role on the named shard key", () => {
    expect(
      codes(`
        database accounts "accounts" {
          profile: mongodb
          partitioned: true
          order: document "Order" {
            partition: customerId
            fields { customerId: string required }
          }
        }
      `),
    ).toContain("DM207");
  });

  it("leaves an unsharded MongoDB query free of a cross-partition warning", () => {
    expect(
      codes(`
        database accounts "accounts" {
          profile: mongodb
          order: document "Order" { fields { status: string } }
          byStatus: index "By status" { on: order scope: global keys: [status] }
        }
        openOrders: access "Open orders" { on: order scope: global using: byStatus }
      `),
    ).not.toContain("DM206");
  });

  it("requires a DynamoDB partition key and a global index for a cross-partition query", () => {
    const bare = warnings(`
      database orders "orders" {
        profile: dynamodb
        order: document "Order" { idPattern: "{orderId}" fields { orderId: string required } }
      }
    `);
    expect(bare.map((item) => item.message).join("\n")).toContain("has no partition key");
    expect(bare.map((item) => item.message).join("\n")).not.toContain("_id");

    const queried = warnings(`
      database orders "orders" {
        profile: dynamodb
        order: document "Order" {
          partition: customerId
          fields { customerId: string required partition }
        }
        byCustomer: index "By customer" { on: order scope: partitioned keys: [customerId] }
        byStatus: index "By status" { on: order scope: global keys: [customerId] }
      }
      mine: access "My orders" { on: order scope: partition using: byCustomer }
      allOpen: access "All open" { on: order scope: global using: byCustomer }
      viaStatus: access "By status" { on: order scope: global using: byStatus }
    `);
    const messages = queried.map((item) => item.message);
    expect(
      messages.some((line) => line.includes("allOpen") && line.includes("without a global")),
    ).toBe(true);
    expect(
      messages.some(
        (line) => line.includes("viaStatus") && line.includes("global secondary index"),
      ),
    ).toBe(true);
    expect(messages.some((line) => line.includes("mine"))).toBe(false);
    expect(queried.map((item) => item.code)).not.toContain("DM205");
  });

  it("rejects an unpartitioned DynamoDB table", () => {
    expect(
      warnings(`
        database orders "orders" {
          profile: dynamodb
          partitioned: false
          order: document "Order" {
            partition: customerId
            fields { customerId: string required partition }
          }
        }
      `).map((item) => item.message),
    ).toContainEqual(expect.stringContaining("marked unpartitioned"));
  });

  it("treats a Cosmos DB cross-partition read as a cost and a transaction as one partition", () => {
    const found = warnings(`
      database orders "orders" {
        profile: cosmosdb
        order: document "Order" {
          idPattern: "{orderId}"
          partition: customerId
          fields { customerId: string required partition }
        }
        byStatus: index "By status" { on: order scope: global keys: [customerId] }
      }
      allOpen: access "All open" { on: order scope: global using: byStatus }
      overlap: invariant "No overlap" { on: order reads: many enforcement: transaction }
      sameCustomer: invariant "Same customer" { on: order reads: many enforcement: partition }
    `);
    const messages = found.map((item) => `${item.code} ${item.message}`);
    expect(messages.some((line) => line.startsWith("DM201"))).toBe(false);
    expect(
      messages.some((line) => line.includes("DM206") && line.includes("crosses Cosmos DB")),
    ).toBe(true);
    expect(found.find((item) => item.code === "DM206")?.hint).toContain("request units");
    expect(messages.some((line) => line.includes("DM204") && line.includes("overlap"))).toBe(true);
    expect(messages.some((line) => line.includes("sameCustomer"))).toBe(false);
  });

  it("models Firestore as collection queries with per-document authorization", () => {
    const found = warnings(`
      database app "app" {
        profile: firestore
        partitioned: true
        audience: "owners"
        shift: document "Shift" {
          partition: employeeId
          audience: "managers"
          fields { employeeId: string required partition }
        }
        byTeam: index "By team" { on: shift keys: [employeeId] }
        byGroup: index "Collection group" { on: shift scope: global keys: [employeeId] }
      }
      team: access "Team" { on: shift using: byTeam }
      everywhere: access "Everywhere" { on: shift scope: global using: byGroup }
      byPartition: access "By partition" { on: shift scope: partition using: byTeam }
      saved: invariant "Saved together" { on: shift reads: many enforcement: transaction }
    `);
    const messages = found.map((item) => `${item.code} ${item.message}`);
    expect(messages.filter((line) => line.startsWith("DM205"))).toEqual([]);
    expect(messages.filter((line) => line.startsWith("DM204"))).toEqual([]);
    expect(messages.some((line) => line.includes("marked partitioned"))).toBe(true);
    expect(messages.some((line) => line.includes('document "shift" sets a partition key'))).toBe(
      true,
    );
    expect(messages.some((line) => line.includes("team") && line.includes("DM206"))).toBe(false);
    expect(
      messages.some(
        (line) => line.includes("collection group query") && line.includes("everywhere"),
      ),
    ).toBe(true);
    expect(
      messages.some(
        (line) => line.includes("byPartition") && line.includes("does not have partition"),
      ),
    ).toBe(true);
  });

  it("warns on an unknown profile and still checks indexes", () => {
    const found = warnings(`
      database orders "orders" {
        profile: mongo
        order: document "Order" { fields { id: string } }
      }
      list: access "List" { on: order }
      rule: invariant "Unique" { on: order reads: many }
    `);
    expect(found.find((item) => item.code === "DM202")?.hint).toContain("mongodb");
    expect(found.map((item) => item.code)).toEqual(
      expect.arrayContaining(["DM202", "DM203", "DM204"]),
    );
    expect(found.map((item) => item.code)).not.toContain("DM205");
    expect(found.find((item) => item.code === "DM204")?.hint).toContain(
      "document, partition, transaction",
    );
  });

  it("accepts a CouchDB transaction only when the application owns it", () => {
    const found = codes(`
      database schedules "schedules" {
        profile: couchdb
        shift: document "Shift" { fields { id: string } }
      }
      overlap: invariant "No overlap" { on: shift reads: many enforcement: transaction }
      coordinated: invariant "Coordinated" { on: shift reads: many enforcement: application }
    `);
    expect(found.filter((code) => code === "DM204")).toHaveLength(1);
  });
});
