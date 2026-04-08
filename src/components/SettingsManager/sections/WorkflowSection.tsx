import React from "react";
import { ArchiveRestore, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

export const WorkflowSection: React.FC = () => {
  const userSettings = useAppStore((state) => state.userMetadata.settings);
  const updateUserSettings = useAppStore((state) => state.updateUserSettings);
  const installHooks = useAppStore((state) => state.installHooks);
  const runtime = useAppStore((state) => state.runtime);

  const autoArchiveEnabled = userSettings.autoArchiveExpiringSessions ?? true;
  const autoArchiveThreshold = userSettings.autoArchiveThresholdDays ?? 5;

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ArchiveRestore className="h-4 w-4 text-accent" /> Auto-archive before expiry
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Automatically archive sessions nearing Claude Code cleanup expiry.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoArchiveEnabled}
              onChange={(event) => {
                void updateUserSettings({ autoArchiveExpiringSessions: event.target.checked });
              }}
            />
            <span>Enable auto-archive</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Threshold (days)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={autoArchiveThreshold}
              onChange={(event) => {
                void updateUserSettings({
                  autoArchiveThresholdDays: Number(event.target.value) || 5,
                });
              }}
              className="w-20 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PlugZap className="h-4 w-4 text-accent" /> SessionEnd hook integration
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Install a Claude Code SessionEnd hook that marks sessions completed when they close.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void installHooks();
            }}
            disabled={runtime.isInstallingHooks}
          >
            {runtime.isInstallingHooks ? "Installing…" : "Install hooks"}
          </Button>
          {runtime.hookInstallResult && (
            <span className="text-xs text-muted-foreground">
              Installed at {runtime.hookInstallResult.hookScriptPath}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
