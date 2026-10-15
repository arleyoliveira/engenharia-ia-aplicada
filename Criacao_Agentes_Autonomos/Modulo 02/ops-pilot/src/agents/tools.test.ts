import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { createOpsTools, type OpsToolsDeps } from "./tools.js";

function makeMemoryTools(deps: OpsToolsDeps = {}) {
  const store = new SqliteOpsStore(":memory:");
  const tools = createOpsTools(store, deps);
  const map = new Map<string, any>(tools.map((t) => [t.name, t]));
  return { store, tools, map };
}

describe("OpsTools Suite", () => {
  it("expõe todas as 6 ferramentas operacionais", () => {
    const { tools } = makeMemoryTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "check_provider_status",
      "consultar_runbook",
      "list_alerts",
      "list_incidents",
      "open_incident",
      "resolve_incident",
    ]);
  });

  describe("Descrições e schemas das ferramentas (6 regras)", () => {
    it("todas as ferramentas possuem descrições que cobrem as 6 regras", () => {
      const { tools } = makeMemoryTools();
      for (const t of tools) {
        assert.ok(t.description.length > 30, `Descrição muito curta para ${t.name}`);
        assert.match(t.description, /use|quando/i, `${t.name} deve explicar quando usar`);
        assert.match(t.description, /não use/i, `${t.name} deve explicar quando não usar`);
        assert.match(t.description, /retorna/i, `${t.name} deve explicar o retorno`);
      }
    });

    it("open_incident declara expressamente quando usar e quando não usar", () => {
      const { map } = makeMemoryTools();
      const open = map.get("open_incident")!;
      assert.match(open.description, /quando um alerta estiver disparando|quando houver uma falha/i);
      assert.match(open.description, /não use se o incidente já foi aberto/i);
    });

    it("parâmetros do schema possuem .describe() e enums fechados", () => {
      const { map } = makeMemoryTools();

      const listAlerts = map.get("list_alerts")!;
      const listAlertsShape = (listAlerts.schema as any).shape;
      assert.ok(listAlertsShape.status.description, "list_alerts.status deve ter .describe()");

      const openIncident = map.get("open_incident")!;
      const openShape = (openIncident.schema as any).shape;
      assert.ok(openShape.title.description, "open_incident.title deve ter .describe()");
      assert.ok(openShape.service.description, "open_incident.service deve ter .describe()");
      assert.ok(openShape.severity.description, "open_incident.severity deve ter .describe()");

      const resolveIncident = map.get("resolve_incident")!;
      const resolveShape = (resolveIncident.schema as any).shape;
      assert.ok(resolveShape.id.description, "resolve_incident.id deve ter .describe()");

      const listIncidents = map.get("list_incidents")!;
      const listIncidentsShape = (listIncidents.schema as any).shape;
      assert.ok(listIncidentsShape.status.description, "list_incidents.status deve ter .describe()");

      const consultarRunbook = map.get("consultar_runbook")!;
      const runbookShape = (consultarRunbook.schema as any).shape;
      assert.ok(runbookShape.service.description, "consultar_runbook.service deve ter .describe()");

      const checkProvider = map.get("check_provider_status")!;
      const providerShape = (checkProvider.schema as any).shape;
      assert.ok(
        providerShape.provider.description,
        "check_provider_status.provider deve ter .describe()",
      );
    });

    it("check_provider_status orienta uso para problema externo e enum github|cloudflare", () => {
      const { map } = makeMemoryTools();
      const tool = map.get("check_provider_status")!;
      assert.match(tool.description, /provedor|externo|nosso ou do provedor/i);
      assert.match(tool.description, /não use/i);
      assert.match(tool.description, /alerta|incidente/i);

      const schema = tool.schema as any;
      assert.ok(schema.safeParse({}).success, "default github deve aceitar {}");
      assert.ok(schema.safeParse({ provider: "github" }).success);
      assert.ok(schema.safeParse({ provider: "cloudflare" }).success);
      assert.equal(schema.safeParse({ provider: "aws" }).success, false);
    });
  });

  describe("check_provider_status", () => {
    it("sucesso com fake fetch devolve linha compacta (default github)", async () => {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            status: { indicator: "none", description: "All Systems Operational" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      const { map } = makeMemoryTools({ fetchImpl });
      const tool = map.get("check_provider_status")!;
      const result = await tool.invoke({});
      assert.equal(typeof result, "string");
      assert.equal(result, "github: none — All Systems Operational");
    });

    it("falha com fake fetch devolve string legível sem lançar", async () => {
      let calls = 0;
      const fetchImpl: typeof fetch = async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      };
      const { map } = makeMemoryTools({ fetchImpl });
      const tool = map.get("check_provider_status")!;
      const result = await tool.invoke({ provider: "cloudflare" });
      assert.equal(typeof result, "string");
      assert.match(result, /check_provider_status failed:/);
      assert.equal(calls, 2);
    });

    it("rejeita provider inválido na fronteira Zod sem chamar fetch", async () => {
      let calls = 0;
      const fetchImpl: typeof fetch = async () => {
        calls += 1;
        throw new Error("não deveria chamar rede");
      };
      const { map } = makeMemoryTools({ fetchImpl });
      const tool = map.get("check_provider_status")!;
      await assert.rejects(
        () => tool.invoke({ provider: "aws" }),
        (err: unknown) => {
          assert.ok(err);
          return true;
        },
      );
      assert.equal(calls, 0);
    });
  });

  describe("list_alerts", () => {
    it("lista alertas filtrados ou todos", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const listAlerts = map.get("list_alerts")!;
      const allRaw = await listAlerts.invoke({});
      const all = JSON.parse(allRaw);
      assert.equal(all.alerts.length, 6);

      const firingRaw = await listAlerts.invoke({ status: "firing" });
      const firing = JSON.parse(firingRaw);
      assert.equal(firing.alerts.length, 3);
      assert.ok(firing.alerts.every((a: any) => a.status === "firing"));

      const resolvedRaw = await listAlerts.invoke({ status: "resolved" });
      const resolved = JSON.parse(resolvedRaw);
      assert.equal(resolved.alerts.length, 3);
      assert.ok(resolved.alerts.every((a: any) => a.status === "resolved"));
    });
  });

  describe("open_incident e resolve_incident", () => {
    it("abre incidente e depois resolve", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const openTool = map.get("open_incident")!;
      const resolveTool = map.get("resolve_incident")!;

      const openRaw = await openTool.invoke({
        title: "Queda na latência do checkout",
        service: "checkout",
        severity: "high",
      });
      const openResult = JSON.parse(openRaw);
      assert.ok(openResult.incident.id > 0);
      assert.equal(openResult.incident.status, "open");
      assert.equal(openResult.incident.resolvedAt, null);

      const resolveRaw = await resolveTool.invoke({ id: openResult.incident.id });
      const resolveResult = JSON.parse(resolveRaw);
      assert.equal(resolveResult.incident.status, "resolved");
      assert.ok(resolveResult.incident.resolvedAt !== null);
    });

    it("retorna erro de domínio estruturado ao tentar abrir incidente com serviço inexistente", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const openTool = map.get("open_incident")!;
      const resultRaw = await openTool.invoke({
        title: "Problema no serviço fantasma",
        service: "servico-que-nao-existe",
        severity: "low",
      });
      const parsed = JSON.parse(resultRaw);
      assert.ok(parsed.error);
      assert.equal(parsed.error.code, "NOT_FOUND");
    });
  });

  describe("list_incidents", () => {
    it("retorna somente incidentes abertos por padrão quando status é omitido", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const openTool = map.get("open_incident")!;
      const resolveTool = map.get("resolve_incident")!;
      const listTool = map.get("list_incidents")!;

      const inc1 = JSON.parse(
        await openTool.invoke({ title: "Incidente 1", service: "checkout", severity: "high" }),
      ).incident;
      const inc2 = JSON.parse(
        await openTool.invoke({ title: "Incidente 2", service: "payments", severity: "critical" }),
      ).incident;

      await resolveTool.invoke({ id: inc1.id });

      const defaultList = JSON.parse(await listTool.invoke({}));
      assert.equal(defaultList.incidents.length, 1);
      assert.equal(defaultList.incidents[0].id, inc2.id);
      assert.equal(defaultList.incidents[0].status, "open");
    });

    it("filtra corretamente por open, resolved e all", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const openTool = map.get("open_incident")!;
      const resolveTool = map.get("resolve_incident")!;
      const listTool = map.get("list_incidents")!;

      const inc1 = JSON.parse(
        await openTool.invoke({ title: "Incidente 1", service: "checkout", severity: "high" }),
      ).incident;
      const inc2 = JSON.parse(
        await openTool.invoke({ title: "Incidente 2", service: "payments", severity: "critical" }),
      ).incident;

      await resolveTool.invoke({ id: inc1.id });

      const openList = JSON.parse(await listTool.invoke({ status: "open" }));
      assert.equal(openList.incidents.length, 1);
      assert.equal(openList.incidents[0].id, inc2.id);

      const resolvedList = JSON.parse(await listTool.invoke({ status: "resolved" }));
      assert.equal(resolvedList.incidents.length, 1);
      assert.equal(resolvedList.incidents[0].id, inc1.id);

      const allList = JSON.parse(await listTool.invoke({ status: "all" }));
      assert.equal(allList.incidents.length, 2);
    });
  });

  describe("consultar_runbook", () => {
    it("retorna o runbook para checkout, payments e auth", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const runbookTool = map.get("consultar_runbook")!;

      for (const svc of ["checkout", "payments", "auth"]) {
        const raw = await runbookTool.invoke({ service: svc });
        const parsed = JSON.parse(raw);
        assert.ok(parsed.runbook, `Runbook esperado para ${svc}`);
        assert.equal(parsed.runbook.service, svc);
        assert.ok(parsed.runbook.steps.length > 10);
      }
    });

    it("retorna erro de domínio quando o serviço não possui runbook ou não existe", async () => {
      const { store, map } = makeMemoryTools();
      await store.seedMercado();

      const runbookTool = map.get("consultar_runbook")!;

      const rawMissingService = await runbookTool.invoke({ service: "servico-desconhecido" });
      const parsedMissing = JSON.parse(rawMissingService);
      assert.ok(parsedMissing.error);
      assert.equal(parsedMissing.error.code, "NOT_FOUND");

      const rawNoRunbook = await runbookTool.invoke({ service: "catalog" });
      const parsedNoRunbook = JSON.parse(rawNoRunbook);
      assert.ok(parsedNoRunbook.error);
      assert.equal(parsedNoRunbook.error.code, "NOT_FOUND");
    });
  });
});