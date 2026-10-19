import { describe, expect, it } from "vite-plus/test";
import { formatSource } from "../format/print.ts";
import { parse } from "../parser/parser.ts";
import { compile } from "./compile.ts";

const schedules = `diagram "Employee schedules" {
  database schedules "schedules" {
    profile: couchdb
    partitioned: true
    audience: "schedule readers"

    shift: document "Shift assignment" {
      idPattern: "{employeeId}:{shiftId}"
      partition: employeeId
      fields {
        employeeId: string required partition
        window: object {
          startsAt: datetime required
        }
      }
    }

    byEmployeeDate: index "By employee" {
      on: shift
      scope: partitioned
      keys: [employeeId, startsAt]
    }
  }

  employeeWeek: access "Employee week" {
    on: shift
    scope: partition
    using: byEmployeeDate
  }
}`;

describe("document data models", () => {
  it("compiles nested fields, partition metadata, and the access path", () => {
    const result = compile(parse(schedules));
    const shift = result.graph.nodes.find((node) => node.id === "shift");
    const database = result.graph.groups.find((group) => group.id === "schedules");

    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(shift?.shape).toBe("table");
    expect(shift?.columns?.map((column) => [column.name, column.depth, column.roles?.[0]])).toEqual(
      [
        ["employeeId", 0, "partition"],
        ["window", 0, undefined],
        ["startsAt", 1, undefined],
      ],
    );
    expect(shift?.data).toMatchObject({
      role: "document",
      partition: "employeeId",
      idPattern: "{employeeId}:{shiftId}",
    });
    expect(database?.kind).toBe("database");
    expect(database?.dataStore).toEqual({
      profile: "couchdb",
      partitioned: true,
      audience: "schedule readers",
    });
    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "employeeWeek", to: "shift", label: "partition query" }),
        expect.objectContaining({
          from: "byEmployeeDate",
          to: "shift",
          label: "partitioned index",
        }),
      ]),
    );
    expect(result.diagnostics.map((item) => item.code)).not.toContain("DM203");
    expect(result.diagnostics.map((item) => item.code)).not.toContain("DM206");
  });

  it("warns when a CouchDB partition is missing from the document id", () => {
    const result = compile(
      parse(`diagram {
        database schedules "schedules" {
          profile: couchdb
          partitioned: true
          shift: document "Shift" {
            idPattern: "{shiftId}"
            partition: employeeId
            fields { employeeId: string required partition }
          }
        }
      }`),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DM201",
        message: expect.stringContaining("does not place"),
      }),
    );
  });

  it("warns when an access path has no index and when a query crosses partitions", () => {
    const result = compile(
      parse(`diagram {
        database schedules "schedules" {
          profile: couchdb
          partitioned: true
          shift: document "Shift" {
            idPattern: "{employeeId}:{shiftId}"
            partition: employeeId
            fields { employeeId: string required partition }
          }
          byTeam: index "By team" {
            on: shift
            scope: global
            keys: [teamId]
          }
        }
        missing: access "Missing" { on: shift }
        teamDay: access "Team day" { on: shift scope: global using: byTeam }
      }`),
    );
    const codes = result.diagnostics.map((item) => `${item.code}:${item.message}`);
    expect(codes.some((line) => line.startsWith("DM203:"))).toBe(true);
    expect(codes.some((line) => line.includes("DM206:") && line.includes("teamDay"))).toBe(true);
    expect(codes.some((line) => line.startsWith("DM208:"))).toBe(true);
  });

  it("warns when one CouchDB database mixes read audiences", () => {
    const result = compile(
      parse(`diagram {
        database hr "HR" {
          profile: couchdb
          audience: "hr staff"
          shift: document "Shift" { audience: "schedule readers" fields { id: string } }
        }
      }`),
    );
    expect(result.diagnostics.map((item) => item.code)).toContain("DM205");
  });

  it("warns when a document invariant reads many CouchDB documents", () => {
    const result = compile(
      parse(`diagram {
        database schedules "schedules" {
          profile: couchdb
          shift: document "Shift" { fields { id: string } }
        }
        overlap: invariant "No overlap" { on: shift reads: many enforcement: document }
        coordinated: invariant "Coordinated" { on: shift reads: many enforcement: application }
      }`),
    );
    const warned = result.diagnostics
      .filter((item) => item.code === "DM204")
      .map((item) => item.message);
    expect(warned).toEqual([expect.stringContaining('Invariant "overlap"')]);
  });

  it("keeps a flowchart document node when it has no fields", () => {
    const result = compile(parse(`diagram { form: document "Form" }`));
    const form = result.graph.nodes[0];
    expect(form?.shape).not.toBe("table");
    expect(form?.data).toBeUndefined();
  });

  it("formats nested fields back into braces", () => {
    const formatted = formatSource(schedules);
    expect(formatted).toContain("window: object {");
    expect(formatted).toContain("startsAt: datetime required");
    expect(formatted).toContain("profile: couchdb");
    expect(formatted).not.toContain(">startsAt");
  });
});
