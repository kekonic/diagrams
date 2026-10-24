import { compile, parse } from "@kekonic/diagrams-core";
import { describe, expect, it } from "vite-plus/test";
import { importPlantUml } from "./index.ts";

describe("PlantUML sequence import", () => {
  it("converts a sequence into canonical kdiagram source", () => {
    const result = importPlantUml(`
      @startuml
      title Checkout
      autonumber

      actor Shopper
      participant "API" as API
      database DB

      Shopper -> API : POST
      activate API
      API -> DB : INSERT
      DB --> API : row
      API --> Shopper : 201
      deactivate API

      alt payment accepted
        API -> Shopper : confirm
      else payment declined
        API -x Shopper : 402
      end

      note over API, DB : Persist
      == Payment ==
      @enduml
    `);

    expect(result.fidelity).toEqual({ status: "converted", profile: "plantuml-sequence-v1" });
    expect(result.diagnostics).toEqual([]);
    expect(result.source).toBe(`sequence "Checkout" {
  autonumber

  Shopper: actor "Shopper"
  API: participant "API"
  DB: database "DB"

  Shopper -> API "POST"
  activate API
  API -> DB "INSERT"
  DB --> API "row"
  API --> Shopper "201"
  deactivate API
  alternate "payment accepted" {
    API -> Shopper "confirm"
  } else "payment declined" {
    API -x Shopper "402"
  }
  note over API, DB "Persist"
  divider "Payment"
}
`);
    const parsed = parse(result.source ?? "");
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    const compiled = compile(parsed);
    expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
      [],
    );
    const sequence = compiled.graph.sequence;
    expect(sequence?.autonumber).toBe(true);
    expect(sequence?.participantOrder).toEqual(["Shopper", "API", "DB"]);
    expect(sequence?.messages.map((message) => message.kind)).toEqual([
      "sync",
      "sync",
      "return",
      "return",
      "sync",
      "failure",
    ]);
    expect(sequence?.fragments[0]?.operator).toBe("alternate");
    expect(sequence?.fragments[0]?.operands).toHaveLength(2);
    expect(sequence?.notes).toHaveLength(1);
    expect(sequence?.dividers).toHaveLength(1);
  });

  it("keeps implicit participants, async calls, reverses, and found or lost messages", () => {
    const result = importPlantUml(`
      [-> API : ping
      Bob <- Alice : hello
      Alice ->> Bob : event
      Alice ->] : gone
      Bob x- Alice : fail
    `);

    expect(result.fidelity.status).toBe("converted");
    expect(result.source).toBe(`sequence {
  API: participant "API"
  Bob: participant "Bob"
  Alice: participant "Alice"

  * -> API "ping"
  Alice -> Bob "hello"
  Alice => Bob "event"
  Alice -> * "gone"
  Alice -x Bob "fail"
}
`);
    const compiled = compile(parse(result.source ?? ""));
    expect(compiled.graph.sequence?.messages.map((message) => message.kind)).toEqual([
      "found",
      "sync",
      "async",
      "lost",
      "failure",
    ]);
  });

  it("places created participants at the create statement", () => {
    const result = importPlantUml(`
      actor User
      User -> API : open
      create Session
      User -> Session ++ : start
      return done
      destroy Session
    `);

    expect(result.fidelity.status).toBe("converted");
    expect(result.source).toContain('User: actor "User"');
    expect(result.source).toContain('API: participant "API"');
    expect(result.source).not.toMatch(/^ {2}Session:/m);
    expect(result.source).toContain('create Session: participant "Session"');
    expect(result.source).toContain('User -> Session "start"\n  activate Session');
    expect(result.source).toContain('Session --> User "done"\n  deactivate Session');
    expect(result.source).toContain("destroy Session");
    expect(
      compile(parse(result.source ?? "")).diagnostics.filter((d) => d.severity === "error"),
    ).toEqual([]);
  });

  it("translates groups, loops, and parallel fragments", () => {
    const result = importPlantUml(`
      opt maybe
        A -> B : one
      end
      loop retries
        A -> B : again
      end
      par reserve
        A -> B : stock
      else authorize
        A -> C : pay
      end
      group phase
        A -> B : work
      end
    `);

    expect(result.fidelity.status).toBe("converted");
    expect(result.source).toContain(`optional "maybe" {
    A -> B "one"
  }`);
    expect(result.source).toContain(`loop "retries" {
    A -> B "again"
  }`);
    expect(result.source).toContain(`parallel "reserve" {
    A -> B "stock"
  } and "authorize" {
    A -> C "pay"
  }`);
    expect(result.source).toContain(`section "phase" {
    A -> B "work"
  }`);
    expect(
      compile(parse(result.source ?? "")).graph.sequence?.fragments.map(
        (fragment) => fragment.operator,
      ),
    ).toEqual(["optional", "loop", "parallel", "section"]);
  });

  it("reports presentation loss and still emits source", () => {
    const result = importPlantUml(`
      !theme plain
      skinparam monochrome true
      skinparam sequence {
        ArrowColor red
      }
      actor User #red <<human>>
      User -[#red]> API : **POST** /orders
      |||
    `);

    expect(result.fidelity.status).toBe("presentation-loss");
    expect(result.source).toContain('User -> API "POST /orders"');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "PMUML007",
      "PMUML007",
      "PMUML007",
      "PMUML008",
      "PMUML008",
      "PMUML010",
      "PMUML007",
    ]);
    expect(result.diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
  });

  it("represents boundary lifelines as participants", () => {
    const result = importPlantUml(`
      boundary UI
      queue Jobs
      UI -> Jobs : publish
    `);

    expect(result.fidelity.status).toBe("presentation-loss");
    expect(result.source).toContain('UI: participant "UI"');
    expect(result.source).toContain('Jobs: queue "Jobs"');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["PMUML011"]);
  });

  it("blocks preprocessor directives and omits source", () => {
    const result = importPlantUml(`
      !include shared.puml
      Alice -> Bob : hello
    `);

    expect(result.source).toBeUndefined();
    expect(result.fidelity.status).toBe("blocked");
    expect(result.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "PMUML001",
    });
    expect(result.diagnostics[0]?.hint).toContain("--preproc");
  });

  it("blocks non-sequence diagrams and unsupported sequence constructs", () => {
    expect(importPlantUml("@startgantt\n[Task] lasts 1 day\n@endgantt").fidelity.status).toBe(
      "blocked",
    );
    expect(importPlantUml("@startuml\nclass Order\n@enduml").diagnostics[0]?.code).toBe("PMUML002");
    expect(importPlantUml("ref over Alice, Bob : other\nAlice -> Bob : hi").source).toBeUndefined();
    expect(
      importPlantUml("box Frontend\nparticipant UI\nend box").diagnostics[0]?.message,
    ).toContain("Participant groups");
    expect(
      importPlantUml("@startuml\nAlice -> Bob : one\n@enduml\n@startuml\nA -> B : two\n@enduml")
        .diagnostics[0]?.code,
    ).toBe("PMUML003");
    expect(importPlantUml("Order *--> Customer").diagnostics[0]?.code).toBe("PMUML002");
    expect(importPlantUml("Order o-> Customer : places").diagnostics[0]?.code).toBe("PMUML002");
    expect(importPlantUml("Alice <-> Bob : hi").diagnostics[0]?.message).toContain("Bidirectional");
    expect(importPlantUml("Alice <-> Bob : hi").source).toBeUndefined();
  });

  it("returns from each branch of an alternate", () => {
    const result = importPlantUml(`
      A -> B : call
      alt ok
        return yes
      else no
        return no
      end
    `);

    expect(result.fidelity.status).toBe("converted");
    expect(result.source).toContain(`alternate "ok" {
    B --> A "yes"
    deactivate B
  } else "no" {
    B --> A "no"
    deactivate B
  }`);
    expect(
      compile(parse(result.source ?? "")).diagnostics.filter((d) => d.severity === "error"),
    ).toEqual([]);
  });

  it("warns when only one branch returns", () => {
    const result = importPlantUml(`
      A -> B : call
      alt ok
        return yes
      else no
        B -> A : later
      end
    `);

    expect(result.fidelity.status).toBe("presentation-loss");
    expect(result.source).toContain('B --> A "yes"');
    expect(result.source).toContain('B -> A "later"');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["PMUML006"]);
  });

  it("flattens creole and reports variable macros", () => {
    const creole = importPlantUml(
      "Alice -> Bob : [[http://example.com docs]] //now// <b>bold</b>\n",
    );
    expect(creole.fidelity.status).toBe("presentation-loss");
    expect(creole.source).toContain('Alice -> Bob "docs now bold"');
    expect(creole.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["PMUML010"]);

    const macro = importPlantUml("!$count = 1\nAlice -> Bob : hi\n");
    expect(macro.source).toBeUndefined();
    expect(macro.diagnostics[0]).toMatchObject({ code: "PMUML001" });
    expect(macro.diagnostics[0]?.hint).toContain("--preproc");
  });

  it("keeps messages when layout hints are ignored", () => {
    const result = importPlantUml(`
      left to right direction
      together {
        actor User
      }
      User ->o API : hi
    `);

    expect(result.fidelity.status).toBe("presentation-loss");
    expect(result.diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
    expect(result.source).toContain('User: actor "User"');
    expect(result.source).toContain('User -> API "hi"');
  });

  it("anchors an empty diagram on the start line", () => {
    const result = importPlantUml("@startuml\n@enduml\n");
    expect(result.fidelity.status).toBe("blocked");
    expect(result.diagnostics[0]).toMatchObject({
      code: "PMUML004",
      range: { start: { line: 1, column: 1, offset: 0 } },
    });
  });
});
