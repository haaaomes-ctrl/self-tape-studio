import { AlertTriangle, CheckCircle2, Mail, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  buildVideoDurationDecision,
  formatVideoDuration,
  VIDEO_DURATION_SUPPORT_EMAIL,
  type VideoDurationStatus,
} from "@/lib/video-duration-policy";
import { cn } from "@/lib/utils";

interface VideoDurationNoticeProps {
  seconds: number;
  accepted?: boolean;
  onAccept?: () => void;
  onChooseShorter?: () => void;
  onShown?: (status: VideoDurationStatus) => void;
  className?: string;
}

export function VideoDurationNotice({
  seconds,
  accepted = false,
  onAccept,
  onChooseShorter,
  onShown,
  className,
}: VideoDurationNoticeProps) {
  const decision = buildVideoDurationDecision(seconds);
  const shownKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (decision.status === "within_target") return;
    const key = `${decision.status}:${decision.durationSeconds}`;
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;
    onShown?.(decision.status);
  }, [decision.durationSeconds, decision.status, onShown]);

  if (decision.status === "within_target") return null;

  const isHardCap = decision.status === "over_hard_cap";

  return (
    <div
      className={cn(
        "rounded-md border p-4 text-sm",
        isHardCap ? "border-destructive/35 bg-destructive/5" : "border-warning/40 bg-warning/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          {isHardCap ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : accepted ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", isHardCap && "text-destructive")}>
            {isHardCap ? "Video over 10 minutes" : "Video over 5 minutes"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {decision.message} Current length: {formatVideoDuration(decision.durationSeconds)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isHardCap ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={onChooseShorter}>
                  <Upload className="mr-2 h-4 w-4" /> Upload a shorter video
                </Button>
                <Button type="button" size="sm" variant="ghost" asChild>
                  <a href={`mailto:${VIDEO_DURATION_SUPPORT_EMAIL}`}>
                    <Mail className="mr-2 h-4 w-4" /> Contact support
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="sm" onClick={onAccept} disabled={accepted}>
                  {accepted ? "Continuing with this video" : "Continue with this video"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onChooseShorter}>
                  <Upload className="mr-2 h-4 w-4" /> Upload a shorter video
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
