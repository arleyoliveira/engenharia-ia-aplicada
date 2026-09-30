// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const opsPilotRoot = fileURLToPath(new URL("../..", import.meta.url));

function gitRoot(start: string): string {
  let dir = start;
  while (path.dirname(dir) !== dir) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("raiz do git não encontrada");
}

function permissionsBlock(yaml: string): string {
  const start = yaml.search(/^permissions:/m);
  const end = yaml.search(/^concurrency:/m);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return yaml.slice(start, end);
}

describe("publicação da war room no Pages", () => {
  it("declara o workflow na raiz do git", () => {
    const workflow = path.join(gitRoot(webDir), ".github", "workflows", "pages.yml");
    const yaml = readFileSync(workflow, "utf8");

    expect(yaml).toContain("name: Publish war room");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("branches: [main]");
    expect(yaml).toContain("contents: read");
    expect(yaml).toContain("pages: write");
    expect(yaml).toContain("id-token: write");
    expect(yaml).toContain("group: pages");
    expect(yaml).toContain("cancel-in-progress: false");
    expect(yaml).toContain("deploy:");
    expect(yaml).toContain("runs-on: ubuntu-latest");
    expect(yaml).toContain("github-pages");
    expect(yaml).toContain("actions/checkout@v4");
    expect(yaml).toContain("actions/setup-node@v4");
    expect(yaml).toContain("node-version: 22");
    expect(yaml).toContain("cache: npm");
    expect(yaml).toContain(
      "Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web/package-lock.json",
    );
    expect(yaml).toContain("actions/configure-pages@v5");
    expect(yaml).toContain("actions/upload-pages-artifact@v3");
    expect(yaml).toContain("path: _site");
    expect(yaml).toContain("id: deployment");
    expect(yaml).toContain("actions/deploy-pages@v4");
    expect(yaml).not.toContain("contents: write");
    expect(yaml).not.toContain("continue-on-error");
    expect(yaml).toContain(
      'working-directory: "Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web"',
    );
    expect(yaml).toContain("npm ci");
    expect(yaml).toContain('npm run build -- --base "/${repo}/opspilot/"');
    expect(yaml).toContain('"$GITHUB_WORKSPACE/_site/opspilot"');

    const permissions = permissionsBlock(yaml);
    const keys = [...permissions.matchAll(/^  ([A-Za-z0-9-]+):/gm)].map((match) => match[1]);
    expect(keys).toEqual(["contents", "pages", "id-token"]);
  });

  it("gera assets sob /opspilot/ sem mudar a base local", { timeout: 30_000 }, () => {
    const config = readFileSync(path.join(webDir, "vite.config.ts"), "utf8");
    expect(config).toContain('base: "/opspilot/"');

    const outDir = mkdtempSync(path.join(tmpdir(), "opspilot-pages-"));
    try {
      const result = spawnSync(
        "npm",
        ["run", "build", "--", "--base", "/exemplo/opspilot/", "--outDir", outDir, "--emptyOutDir"],
        { cwd: webDir, encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      const html = readFileSync(path.join(outDir, "index.html"), "utf8");
      const scripts = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]);
      const links = [...html.matchAll(/<link\b[^>]*\shref="([^"]+)"/g)].map((match) => match[1]);
      expect(scripts.length).toBeGreaterThan(0);
      expect(links.length).toBeGreaterThan(0);
      for (const src of scripts) expect(src).toContain("/opspilot/");
      for (const href of links) expect(href).toContain("/opspilot/");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("explica a sala local e a publicada no README", () => {
    const readme = readFileSync(path.join(opsPilotRoot, "README.md"), "utf8");
    expect(readme).toContain("npm run dev");
    expect(readme).toContain("npm run dev --prefix web");
    expect(readme).toContain("http://localhost:5173/opspilot/");
    expect(readme).toContain("3000");
    expect(readme).toContain("https://<owner>.github.io/<repo>/opspilot/");
    expect(readme).toContain("GitHub Actions");
    expect(readme).toContain(".github/workflows/pages.yml");
    expect(readme).toContain("Configurar URL da API");
    expect(readme).not.toMatch(
      /^\s*.*\b(TOKEN|SECRET|PASSWORD|API_KEY|OPENROUTER)\b\s*[:=]\s*\S+/im,
    );
    expect(readme).not.toContain("-----BEGIN");
  });
});
