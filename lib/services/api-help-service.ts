import { toAbsoluteUrl } from "@/lib/url/base-url";

export function buildApiHelpData(baseUrl: string) {
  const endpoints = [
    {
      path: "/api/register",
      method: "POST",
      bodySchema: { username: "string", email: "email", password: "string" },
      examplePayload: { username: "admin", email: "admin@example.com", password: "StrongPassword123!" },
      exampleResponse: { success: true, data: { id: "uuid", role: "ADMIN" } },
      statusCodes: [201, 400, 403, 409],
    },
    {
      path: "/api/v1/apikeys",
      method: "GET/POST",
      bodySchema: { name: "string" },
      examplePayload: { name: "Codex Production" },
      exampleResponse: { success: true, data: { id: "uuid", token: "ck_xxx" } },
      statusCodes: [200, 201, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/system/presets/autodev",
      method: "GET/PUT",
      bodySchema: { content: "string (required for PUT)" },
      examplePayload: {
        content: "---\nname: autodev\n...\n",
      },
      exampleResponse: {
        success: true,
        data: { key: "autodev", content: "markdown", updatedAt: "2026-03-01T00:00:00.000Z" },
      },
      statusCodes: [200, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/system/integrations/domnex",
      method: "GET/PUT",
      bodySchema: {
        enabled: "boolean",
        baseUrl: "url",
        defaultDomain: "domain (optional, used for automatic PRJ-* FQDN generation)",
        apiToken: "string (optional, write only)",
        clearApiToken: "boolean (optional)",
      },
      examplePayload: {
        enabled: true,
        baseUrl: "https://domnex.example.internal",
        defaultDomain: "example.com",
        apiToken: "dnx_xxx",
      },
      exampleResponse: {
        success: true,
        data: {
          enabled: true,
          baseUrl: "https://domnex.example.internal",
          defaultDomain: "example.com",
          hasApiToken: true,
          tokenHint: "dnx_...7f9a",
        },
      },
      statusCodes: [200, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/system/integrations/domnex/healthcheck",
      method: "POST",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: {
        success: true,
        data: {
          ok: true,
          statusCode: 200,
          message: "DomNex connection healthy",
          checkedAt: "2026-03-02T09:00:00.000Z",
        },
      },
      statusCodes: [200, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/system/integrations/github",
      method: "GET/PUT",
      bodySchema: {
        enabled: "boolean",
        apiToken: "string (optional, write only)",
        clearApiToken: "boolean (optional)",
        username: "string (optional)",
        email: "email (optional)",
      },
      examplePayload: {
        enabled: true,
        apiToken: "ghp_xxx",
        username: "operator-user",
        email: "operator@example.com",
      },
      exampleResponse: {
        success: true,
        data: {
          enabled: true,
          hasApiToken: true,
          tokenHint: "ghp_...9a0e",
          username: "operator-user",
          email: "operator@example.com",
        },
      },
      statusCodes: [200, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/system/integrations/github/healthcheck",
      method: "POST",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: {
        success: true,
        data: {
          ok: true,
          statusCode: 200,
          message: "GitHub connection healthy",
          checkedAt: "2026-03-02T09:00:00.000Z",
        },
      },
      statusCodes: [200, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/projects/bootstrap",
      method: "POST",
      bodySchema: {
        name: "string",
        target: "string",
        autoProvisionDomain: "boolean (optional)",
        lifecycle: {
          title: "string",
          mode: "STEP | BATCH",
          classification: "BIRTH | CHANGE | FIX | ITERATE | TEARDOWN",
          autoStart: "boolean",
          modules: "LifecycleModule[]",
        },
        documentation: "Documentation[]",
      },
      examplePayload: {
        name: "Ops Modernization",
        target: "Standardized project execution model",
        autoProvisionDomain: true,
        lifecycle: {
          title: "Initial Lifecycle Run",
          mode: "STEP",
          classification: "BIRTH",
          autoStart: true,
          modules: [
            {
              moduleOrder: 1,
              moduleType: "TECHSTACK",
              title: "Techstack Foundation",
              description: "Define runtime and scaffold",
              expectedState: "Runtime scaffold is ready",
              riskLevel: "MEDIUM",
            },
          ],
        },
        documentation: [
          {
            name: "Runbook",
            content: "# Runbook",
          },
        ],
      },
      exampleResponse: {
        success: true,
        data: {
          project: { id: "uuid" },
          lifecycleRun: { id: "uuid", status: "RUNNING", moduleCount: 1 },
        },
      },
      statusCodes: [201, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/projects/:id/tasks",
      method: "POST (LEGACY_DISABLED)",
      bodySchema: {
        title: "string",
        executionOrder: "number (optional, 1..9999)",
        istState: "string",
        sollState: "string",
        technicalPlan: "string",
        riskImpact: "string",
        requiresOperatorFeedback: "boolean (optional)",
      },
      examplePayload: {
        title: "Provisioning baseline",
        executionOrder: 10,
        istState: "No baseline",
        sollState: "Baseline in place",
        technicalPlan: "Implement and verify baseline automation",
        riskImpact: "Medium",
      },
      exampleResponse: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
        },
      },
      usageHint: "Legacy task-write endpoint is disabled in vNext replacement mode.",
      statusCodes: [400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/prefabs",
      method: "POST",
      bodySchema: {
        type: "DOMNEX_PROVISION | DOMNEX_TEARDOWN | GITHUB_RELEASE",
        executionOrder: "number (optional, 1..9999)",
        repoUrl: "url (required for GITHUB_RELEASE)",
        fqdn: "string (optional)",
        upstreamUrl: "url (optional)",
      },
      examplePayload: {
        type: "GITHUB_RELEASE",
        executionOrder: 12,
        repoUrl: "https://github.com/org/repo.git",
      },
      exampleResponse: {
        success: true,
        data: {
          taskId: "uuid",
          documentationId: "uuid",
          type: "GITHUB_RELEASE",
        },
      },
      usageHint:
        "Creates project-scoped prefab task. For DOMNEX_TEARDOWN, a full teardown is executed immediately (domain + docs + workspace), tasks remain.",
      statusCodes: [201, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/domnex/provision",
      method: "POST",
      bodySchema: {
        fqdn: "string (optional override)",
        upstreamUrl: "url",
        insecureTls: "boolean (optional)",
        haEnabled: "boolean (optional)",
        force: "boolean (optional, recreate even if existing host is found)",
      },
      examplePayload: {
        upstreamUrl: "http://192.168.1.100:4556",
        insecureTls: false,
        haEnabled: false,
      },
      exampleResponse: {
        success: true,
        data: {
          queued: true,
          projectId: "uuid",
          fqdn: "prj-0001.example.com",
          upstreamUrl: "http://192.168.1.100:4556",
          status: "PENDING",
        },
      },
      usageHint:
        "Operator session endpoint for manual provisioning from web UI. For agent/runtime use token endpoint /api/v1/projects/:id/domnex/provision.",
      statusCodes: [202, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/projects/:id/domnex/provision",
      method: "POST",
      bodySchema: {
        fqdn: "string (optional override)",
        upstreamUrl: "url",
        insecureTls: "boolean (optional)",
        haEnabled: "boolean (optional)",
        force: "boolean (optional, recreate even if existing host is found)",
      },
      examplePayload: {
        upstreamUrl: "http://192.168.1.100:4556",
        insecureTls: false,
        haEnabled: false,
      },
      exampleResponse: {
        success: true,
        data: {
          queued: true,
          projectId: "uuid",
          fqdn: "prj-0001.example.com",
          upstreamUrl: "http://192.168.1.100:4556",
          status: "PENDING",
        },
      },
      usageHint:
        "Token-auth endpoint for Codex/agent provisioning. FQDN resolution priority: explicit payload fqdn > FQDN found in task content > <projectVisualId>.<domnex.defaultDomain>. For domain-agnostic behavior omit fqdn. upstreamUrl must be reachable from DomNex server (no localhost/127.0.0.1) and should point to a persistent autostart service (systemd/equivalent), not a temporary agent process.",
      statusCodes: [202, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/domnex",
      method: "PATCH",
      bodySchema: {
        enabled: "boolean",
      },
      examplePayload: { enabled: true },
      exampleResponse: {
        success: true,
        data: {
          projectId: "uuid",
          autoProvisionDomain: true,
          provisionStatus: "PENDING",
        },
      },
      usageHint: "Enable/disable automatic DomNex provisioning on project level.",
      statusCodes: [200, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/domnex/teardown",
      method: "POST",
      bodySchema: {
        clearFqdn: "boolean (optional)",
        clearDocumentation: "boolean (optional, delete all project documentation)",
        clearWorkspace: "boolean (optional, delete local workspace folder)",
      },
      examplePayload: { clearFqdn: true, clearDocumentation: true, clearWorkspace: true },
      exampleResponse: {
        success: true,
        data: {
          projectId: "uuid",
          deleted: true,
          hostId: "host_123",
          deletedDocumentationCount: 12,
          workspaceCleared: true,
          status: "DISABLED",
        },
      },
      usageHint:
        "Deletes DomNex host (if present), optionally clears project docs/workspace, and disables project provisioning. Tasks are not deleted.",
      statusCodes: [200, 400, 401, 403, 404],
    },
    {
      path: "/api/v1/projects/:id/prompt-token",
      method: "POST",
      bodySchema: {
        password: "string (operator password confirmation)",
      },
      examplePayload: {
        password: "OperatorPassword123!",
      },
      exampleResponse: {
        success: true,
        data: {
          token: "ck_xxx",
          keyId: "uuid",
          keyPrefix: "ck_xxx",
          projectId: "uuid",
          projectVisualId: "PRJ-0001",
        },
      },
      statusCodes: [201, 400, 401, 404],
    },
    {
      path: "/api/v1/admin/tasks/:id",
      method: "PATCH/DELETE (LEGACY_DISABLED)",
      bodySchema: {
        title: "string?",
        executionOrder: "number?",
        status: "ACTIVE | DONE",
        istState: "string?",
        sollState: "string?",
        technicalPlan: "string?",
        riskImpact: "string?",
      },
      examplePayload: { status: "DONE" },
      exampleResponse: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
        },
      },
      usageHint: "Legacy task-write endpoint is disabled in vNext replacement mode.",
      statusCodes: [400, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/documentation/:id",
      method: "DELETE",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: { success: true, data: { id: "uuid" } },
      statusCodes: [200, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id",
      method: "DELETE",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: { success: true, data: { id: "uuid" } },
      statusCodes: [200, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/agent-chat",
      method: "GET/POST",
      bodySchema: {
        questionId: "string (required for POST)",
        answer: "string (required for POST)",
      },
      usageHint:
        "Async operator chat for agent follow-up questions. GET returns thread/open questions, POST submits an operator answer.",
      examplePayload: {
        questionId: "e47df1f7c524",
        answer: "Nutze PostgreSQL 16 und halte API-URLs auf 127.0.0.1:3300.",
      },
      exampleResponse: { success: true, data: { questionId: "e47df1f7c524", documentationId: "uuid" } },
      statusCodes: [200, 201, 400, 401, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/export/md",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: "Markdown attachment download",
      statusCodes: [200, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/projects/:id/export/pdf",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: "PDF attachment download",
      statusCodes: [200, 401, 403, 404],
    },
    {
      path: "/api/v1/admin/agent/runs",
      method: "GET/POST",
      bodySchema: {
        projectId: "string (optional, POST only)",
      },
      examplePayload: { projectId: "uuid" },
      exampleResponse: {
        success: true,
        data: [{ id: "uuid", projectId: "uuid", status: "RUNNING" }],
      },
      statusCodes: [200, 202, 400, 401, 403],
    },
    {
      path: "/api/v1/admin/agent/tick",
      method: "POST",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: { success: true, data: { triggered: true } },
      statusCodes: [202, 401, 403],
    },
    {
      path: "/api/v1/projects/:id/ai-kickstart",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      usageHint:
        "Project UI exposes AI endpoint prompt generators in the Actions panel as 'Click to prompt' buttons.",
      curlExample:
        'curl -H "authorization: Bearer <api_key>" "<base_url>/api/v1/projects/<project_id>/ai-kickstart"',
      exampleResponse: {
        success: true,
        data: {
          version: "ai-kickstart-v1",
          installInstructions: ["..."],
          autodevSkillFull: "...from COPM system preset...",
          startupPrompts: {
            systemPrompt: "...",
            userPrompt: "...",
            oneShotPrompt: "...",
          },
          autodevExcerpt: "...",
          projectPlanAgentsMd: "...",
        },
      },
      statusCodes: [200, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/agents-md",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      usageHint:
        "Project UI exposes AGENTS endpoint prompt generator in the Actions panel as a 'Click to prompt' button.",
      exampleResponse: "AGENTS.md file download",
      statusCodes: [200, 401, 404],
    },
    {
      path: "/api/v1/projects",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: { success: true, data: [] },
      statusCodes: [200, 401],
    },
    {
      path: "/api/v1/projects",
      method: "POST",
      bodySchema: {
        name: "string",
        target: "string",
        autoProvisionDomain: "boolean (optional)",
        provisionUpstreamUrl: "url (optional)",
        provisionInsecureTls: "boolean (optional)",
        provisionHaEnabled: "boolean (optional)",
      },
      examplePayload: {
        name: "Migration",
        target: "Upgrade stack",
        autoProvisionDomain: false,
        provisionUpstreamUrl: "http://192.168.1.100:4556",
        provisionInsecureTls: false,
        provisionHaEnabled: false,
      },
      exampleResponse: { success: true, data: { id: "uuid" } },
      statusCodes: [201, 400, 401],
    },
    {
      path: "/api/v1/projects/:id",
      method: "GET/PATCH/DELETE",
      bodySchema: {
        name: "string?",
        target: "string?",
        autoProvisionDomain: "boolean?",
        provisionUpstreamUrl: "url?",
        provisionInsecureTls: "boolean?",
        provisionHaEnabled: "boolean?",
      },
      examplePayload: {
        name: "Updated Name",
        autoProvisionDomain: true,
        provisionUpstreamUrl: "http://192.168.1.100:4556",
      },
      exampleResponse: { success: true, data: { id: "uuid" } },
      statusCodes: [200, 400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/tasks",
      method: "GET (POST/DELETE LEGACY_DISABLED)",
      bodySchema: {
        title: "string",
        executionOrder: "number (optional, 1..9999)",
        istState: "string",
        sollState: "string",
        technicalPlan: "string",
        riskImpact: "string",
        requiresOperatorFeedback: "boolean (optional)",
      },
      query: {
        status: "ACTIVE | DONE (optional, DELETE only)",
      },
      examplePayload: {
        title: "Container rollout",
        executionOrder: 20,
        istState: "No deployment process",
        sollState: "Standardized CI/CD",
        technicalPlan: "Implement pipeline",
        riskImpact: "Downtime risk reduced",
      },
      exampleResponse: { success: true, data: [] },
      usageHint: "Task list is retained as legacy archive read-only. Use lifecycle endpoints for all new execution changes.",
      statusCodes: [200, 400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/lifecycle/runs",
      method: "GET/POST",
      bodySchema: {
        title: "string",
        mode: "STEP | BATCH",
        classification: "BIRTH | CHANGE | FIX | ITERATE | TEARDOWN",
        autoStart: "boolean (optional)",
        modules: "LifecycleModule[]",
      },
      examplePayload: {
        title: "Birth Pipeline Run",
        mode: "STEP",
        classification: "BIRTH",
        autoStart: true,
        modules: [
          {
            moduleOrder: 1,
            moduleType: "TECHSTACK",
            title: "Techstack Foundation",
            description: "Select runtime and scaffold base structure",
            expectedState: "Project runtime is scaffolded",
          },
          {
            moduleOrder: 2,
            moduleType: "CHECK",
            title: "Quality Gate",
            description: "Lint, build and runtime health verification",
            expectedState: "Quality gate is green",
          },
        ],
      },
      exampleResponse: { success: true, data: { run: { id: "uuid", status: "RUNNING" } } },
      usageHint:
        "Lifecycle engine endpoint. STEP mode blocks after each module; BATCH mode continues automatically unless policy/risk gate blocks.",
      statusCodes: [200, 201, 400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/lifecycle/runs/:runId",
      method: "GET",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: {
        success: true,
        data: {
          run: { id: "uuid", status: "BLOCKED" },
          modules: [{ id: "uuid", moduleOrder: 1, status: "COMPLETED" }],
          transitions: [],
          evidences: [],
        },
      },
      statusCodes: [200, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/lifecycle/runs/:runId/resume",
      method: "POST",
      bodySchema: {
        reason: "string (optional)",
      },
      examplePayload: {
        reason: "Operator approved next module",
      },
      exampleResponse: { success: true, data: { run: { id: "uuid", status: "RUNNING" } } },
      statusCodes: [200, 400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/lifecycle/runs/:runId/start",
      method: "POST",
      bodySchema: null,
      examplePayload: null,
      exampleResponse: { success: true, data: { run: { id: "uuid", status: "RUNNING" } } },
      usageHint:
        "Starts BUILD phase from DRAFT prephase. Prephase review can be repeated before this start action.",
      statusCodes: [200, 400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/lifecycle/runs/:runId/modules/:moduleId",
      method: "PATCH",
      bodySchema: {
        status: "PENDING | RUNNING | COMPLETED | FAILED | BLOCKED | SKIPPED",
        actualState: "string (optional)",
        lastError: "string (optional)",
        evidence: {
          kind: "string",
          summary: "string",
          details: "object (optional)",
        },
      },
      examplePayload: {
        status: "COMPLETED",
        actualState: "Techstack scaffold validated",
        evidence: {
          kind: "RUNTIME_CHECK",
          summary: "Health endpoint returned 200",
        },
      },
      exampleResponse: { success: true, data: { run: { id: "uuid", status: "BLOCKED" } } },
      statusCodes: [200, 400, 401, 404],
    },
    {
      path: "/api/v1/tasks/:id",
      method: "PATCH/DELETE (LEGACY_DISABLED)",
      bodySchema: {
        title: "string?",
        executionOrder: "number?",
        status: "ACTIVE | DONE",
        istState: "string?",
        sollState: "string?",
        technicalPlan: "string?",
        riskImpact: "string?",
        requiresOperatorFeedback: "boolean?",
      },
      examplePayload: { status: "DONE" },
      exampleResponse: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Task writes are disabled in vNext. Use lifecycle runs/modules endpoints instead (/api/v1/projects/:id/lifecycle/runs...).",
        },
      },
      usageHint: "Legacy task-write endpoint is disabled in vNext replacement mode.",
      statusCodes: [400, 401, 404],
    },
    {
      path: "/api/v1/projects/:id/documentation",
      method: "GET/POST/DELETE",
      bodySchema: { name: "string", content: "markdown" },
      query: {
        name: "string (optional, DELETE only)",
      },
      examplePayload: { name: "Setup", content: "# Steps" },
      exampleResponse: { success: true, data: { id: "uuid", version: 1 } },
      statusCodes: [200, 201, 400, 401, 404],
    },
    {
      path: "/api/v1/documentation/:id",
      method: "PATCH/DELETE",
      bodySchema: { content: "markdown" },
      examplePayload: { content: "# Updated" },
      exampleResponse: { success: true, data: { id: "uuid", version: 2 } },
      statusCodes: [200, 400, 401, 404],
    },
  ].map((entry) => ({
    ...entry,
    path: toAbsoluteUrl(baseUrl, entry.path),
  }));

  return {
    apiVersion: "v1",
    authentication: {
      operatorUi: {
        type: "NextAuth Credentials",
        session: "JWT",
      },
      initialSetup: {
        endpoint: `POST ${toAbsoluteUrl(baseUrl, "/api/register")}`,
        body: {
          username: "string",
          email: "email",
          password: "string",
        },
        note: "Only available before first account exists; first account becomes ADMIN",
      },
      codexApi: {
        type: "Bearer Token",
        header: "Authorization: Bearer <generated_api_key>",
        keyManagement: `Admin UI: ${toAbsoluteUrl(baseUrl, "/dashboard/api-keys")}`,
        promptFlow:
          "Project UI supports automatic project-bound token generation via Click to prompt (password confirmation).",
      },
    },
    endpoints,
  };
}
