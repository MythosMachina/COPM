import PDFDocument from "pdfkit";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export type ProjectExportBundle = {
  project: {
    id: string;
    name: string;
    target: string;
    createdAt: Date;
    updatedAt: Date;
  };
  tasks: Array<{
    id: string;
    title: string;
    executionOrder: number;
    status: "ACTIVE" | "DONE";
    istState: string;
    sollState: string;
    technicalPlan: string;
    riskImpact: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  documentation: Array<{
    id: string;
    name: string;
    content: string;
    version: number;
    createdAt: Date;
  }>;
};

export async function getProjectExportBundle(projectId: string): Promise<ProjectExportBundle> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        orderBy: [{ status: "asc" }, { executionOrder: "asc" }, { updatedAt: "desc" }],
      },
      documentation: {
        orderBy: [{ name: "asc" }, { version: "desc" }],
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      target: project.target,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      executionOrder: task.executionOrder,
      status: task.status,
      istState: task.istState,
      sollState: task.sollState,
      technicalPlan: task.technicalPlan,
      riskImpact: task.riskImpact,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
    documentation: project.documentation.map((doc) => ({
      id: doc.id,
      name: doc.name,
      content: doc.content,
      version: doc.version,
      createdAt: doc.createdAt,
    })),
  };
}

function writeHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5);
  doc.fontSize(16).fillColor("#0f172a").text(text);
  doc.moveDown(0.2);
}

function writeLabelValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).fillColor("#334155").text(label, { continued: true });
  doc.fillColor("#0f172a").text(` ${value}`);
}

export async function buildProjectPdfDocument(projectId: string): Promise<Buffer> {
  const bundle = await getProjectExportBundle(projectId);

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk as Buffer));

  doc.fontSize(22).fillColor("#0f172a").text(bundle.project.name);
  doc.fontSize(11).fillColor("#475569").text("Project Export Report");
  doc.moveDown(0.5);
  writeLabelValue(doc, "Project ID:", bundle.project.id);
  writeLabelValue(doc, "Generated UTC:", new Date().toISOString());

  writeHeading(doc, "Objective");
  doc.fontSize(11).fillColor("#111827").text(bundle.project.target);

  writeHeading(doc, `Tasks (${bundle.tasks.length})`);
  if (bundle.tasks.length === 0) {
    doc.fontSize(11).fillColor("#475569").text("No tasks defined.");
  } else {
    bundle.tasks.forEach((task) => {
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor("#0f172a").text(`${task.executionOrder}. ${task.title}`);
      writeLabelValue(doc, "Status:", task.status);
      writeLabelValue(doc, "IST:", task.istState);
      writeLabelValue(doc, "SOLL:", task.sollState);
      writeLabelValue(doc, "Technical Plan:", task.technicalPlan);
      writeLabelValue(doc, "Risk Impact:", task.riskImpact);
    });
  }

  writeHeading(doc, `Documentation (${bundle.documentation.length})`);
  if (bundle.documentation.length === 0) {
    doc.fontSize(11).fillColor("#475569").text("No documentation defined.");
  } else {
    bundle.documentation.forEach((entry, index) => {
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor("#0f172a").text(`${index + 1}. ${entry.name} (v${entry.version})`);
      doc.fontSize(10).fillColor("#111827").text(entry.content);
    });
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", (error) => reject(error));
  });

  return Buffer.concat(chunks);
}
