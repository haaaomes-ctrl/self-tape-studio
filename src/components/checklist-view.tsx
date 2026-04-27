import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ChecklistResult } from "@/lib/checklist";
import { cn } from "@/lib/utils";

interface RowProps {
  label: string;
  status: "ok" | "warn" | "fail";
  note: string;
}

function StatusIcon({ status }: { status: "ok" | "warn" | "fail" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function Row({ label, status, note }: RowProps) {
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <span className="mt-0.5">
        <StatusIcon status={status} />
      </span>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            status === "fail" ? "text-destructive" : "text-foreground",
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
    </li>
  );
}

export function ChecklistView({
  checklist,
  briefSource,
  readerDeclared,
}: {
  checklist: ChecklistResult;
  briefSource: "full" | "guided" | "none";
  readerDeclared?: "yes" | "no";
}) {
  const briefStatus: "ok" | "warn" | "fail" =
    briefSource === "full" ? "ok" : briefSource === "guided" ? "warn" : "warn";
  const briefNote =
    briefSource === "full"
      ? "Full brief provided — we'll score in brief-driven mode."
      : briefSource === "guided"
        ? "Partial brief from quick prompt — adds context, lower confidence than a full brief."
        : "No brief — we'll apply the professional baseline rubric.";

  return (
    <ul className="rounded-xl border border-border bg-card px-5 py-2">
      <Row
        label="Orientation"
        status={checklist.orientation.status}
        note={checklist.orientation.note}
      />
      <Row label="Lighting" status={checklist.brightness.status} note={checklist.brightness.note} />
      <Row label="Audio level" status={checklist.audio.status} note={checklist.audio.note} />
      <Row label="Length" status={checklist.duration.status} note={checklist.duration.note} />
      <Row label="Resolution" status={checklist.resolution.status} note={checklist.resolution.note} />
      <Row label="Brief" status={briefStatus} note={briefNote} />
      {readerDeclared && (
        <Row
          label="Reader"
          status="ok"
          note={
            readerDeclared === "yes"
              ? "Reader declared present — we'll evaluate listening and timing."
              : "No reader — we'll evaluate camera connection instead."
          }
        />
      )}
    </ul>
  );
}
