import { NotFoundError, ValidationError } from "@/lib/api/errors";
import type {
  AiKickstartPayload,
  CopmApiResponse,
  LifecycleRunDetailRef,
  LifecycleRunRef,
  ProjectDocumentation,
  ProjectRef,
  ProjectTask,
} from "@/lib/orchestrator/types";

export class CopmApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string,
  ) {}

  private toUrl(pathname: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${pathname}`;
  }

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.toUrl(pathname), {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as CopmApiResponse<T>;

    if (!response.ok || !payload.success || payload.data === undefined) {
      const message = payload.error?.message ?? `COPM request failed (${response.status})`;
      if (response.status === 404) {
        throw new NotFoundError(message);
      }
      throw new ValidationError(message, payload.error?.details);
    }

    return payload.data;
  }

  async listProjects(): Promise<ProjectRef[]> {
    return this.request<ProjectRef[]>("/api/v1/projects", { method: "GET" });
  }

  async getProject(projectId: string): Promise<ProjectRef> {
    return this.request<ProjectRef>(`/api/v1/projects/${projectId}`, { method: "GET" });
  }

  async updateProject(projectId: string, input: { autonomousAgentEnabled?: boolean }): Promise<ProjectRef> {
    return this.request<ProjectRef>(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async getAiKickstart(projectId: string): Promise<AiKickstartPayload> {
    return this.request<AiKickstartPayload>(`/api/v1/projects/${projectId}/ai-kickstart`, {
      method: "GET",
    });
  }

  async listDocumentation(projectId: string): Promise<ProjectDocumentation[]> {
    return this.request<ProjectDocumentation[]>(`/api/v1/projects/${projectId}/documentation`, {
      method: "GET",
    });
  }

  async createDocumentation(projectId: string, input: { name: string; content: string }): Promise<ProjectDocumentation> {
    return this.request<ProjectDocumentation>(`/api/v1/projects/${projectId}/documentation`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async listTasks(projectId: string): Promise<ProjectTask[]> {
    return this.request<ProjectTask[]>(`/api/v1/projects/${projectId}/tasks`, {
      method: "GET",
    });
  }

  async listLifecycleRuns(projectId: string): Promise<LifecycleRunRef[]> {
    return this.request<LifecycleRunRef[]>(`/api/v1/projects/${projectId}/lifecycle/runs`, {
      method: "GET",
    });
  }

  async getLifecycleRun(projectId: string, runId: string): Promise<LifecycleRunDetailRef> {
    return this.request<LifecycleRunDetailRef>(`/api/v1/projects/${projectId}/lifecycle/runs/${runId}`, {
      method: "GET",
    });
  }

  async upsertLifecycleModulePrephaseReview(
    projectId: string,
    runId: string,
    moduleId: string,
    content: string,
  ): Promise<LifecycleRunDetailRef> {
    return this.request<LifecycleRunDetailRef>(
      `/api/v1/projects/${projectId}/lifecycle/runs/${runId}/modules/${moduleId}/prephase`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
  }
}
