import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NativeRenameDialog } from "@/components/NativeRenameDialog";
import { useSessionEditing } from "./hooks/useSessionEditing";
import { SessionHeader } from "./components/SessionHeader";
import { SessionNameEditor } from "./components/SessionNameEditor";
import { SessionMeta } from "./components/SessionMeta";
import { SessionContextMenu } from "./SessionContextMenu";
import type { SessionItemProps } from "./types";
import { useSessionMetadata } from "@/hooks/useSessionMetadata";
import { useAppStore } from "@/store/useAppStore";

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isSelected,
  onSelect,
  onHover,
  formatTimeAgo,
  showProject = false,
  projectLabel,
}) => {
  const editing = useSessionEditing(session);
  const { status, priority, planSlug, setHasClaudeCodeName } = useSessionMetadata(session.session_id);
  const updateSessionMetadata = useAppStore((state) => state.updateSessionMetadata);
  const runningSessions = useAppStore((state) => state.runtime.runningSessions);
  const plans = useAppStore((state) => state.plans.items);
  const killSessionProcess = useAppStore((state) => state.killSessionProcess);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const resolvedPlanSlug = session.slug || planSlug;
  const runningSession = useMemo(
    () =>
      runningSessions.find(
        (item) =>
          item.session_id === session.actual_session_id ||
          item.session_id === session.session_id
      ),
    [runningSessions, session.actual_session_id, session.session_id]
  );
  const planTitle = useMemo(
    () => plans.find((plan) => plan.slug === resolvedPlanSlug)?.title,
    [plans, resolvedPlanSlug]
  );

  const handleClick = useCallback(() => {
    if (!editing.isEditing && !isSelected) {
      onSelect();
    }
  }, [editing.isEditing, isSelected, onSelect]);

  return (
    <>
      <div
        className={cn(
          "group w-full flex flex-col gap-1.5 py-2.5 px-3 rounded-lg",
          "text-left transition-all duration-300",
          "hover:bg-accent/8",
          isSelected
            ? "bg-accent/15 shadow-sm shadow-accent/10 ring-1 ring-accent/20"
            : "bg-transparent"
        )}
        style={{ width: "calc(100% - 8px)" }}
        onClick={handleClick}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
        onMouseEnter={() => {
          if (!editing.isEditing && onHover) {
            onHover();
          }
        }}
      >
      {/* Session Header */}
      <div className="flex items-start gap-2.5">
        <SessionHeader
          isArchivedCodexSession={editing.isArchivedCodexSession}
          isSelected={isSelected}
          runningSession={runningSession}
        />

        {/* Session Name / Edit Mode */}
        <div className="flex-1 min-w-0 flex items-start gap-1">
          <SessionNameEditor
            isEditing={editing.isEditing}
            editValue={editing.editValue}
            displayName={editing.displayName}
            hasCustomName={editing.hasCustomName}
            hasClaudeCodeName={editing.hasClaudeCodeName}
            isNamed={editing.isNamed}
            isSelected={isSelected}
            isContextMenuOpen={editing.isContextMenuOpen}
            providerId={editing.providerId}
            supportsNativeRename={editing.supportsNativeRename}
            inputRef={editing.inputRef}
            ignoreBlurRef={editing.ignoreBlurRef}
            onEditValueChange={editing.setEditValue}
            onKeyDown={editing.handleKeyDown}
            onSave={editing.saveCustomName}
            onCancel={editing.cancelEditing}
            onDoubleClick={editing.handleDoubleClick}
            onRenameClick={editing.handleRenameClick}
            onResetCustomName={editing.resetCustomName}
            onNativeRenameClick={editing.handleNativeRenameClick}
            onCopySessionId={editing.handleCopySessionId}
            onCopyResumeCommand={editing.handleCopyResumeCommand}
            onCopyFilePath={editing.handleCopyFilePath}
            onContextMenuOpenChange={editing.setIsContextMenuOpen}
          />
        </div>
      </div>

      {/* Session Meta */}
      <SessionMeta
        session={session}
        isSelected={isSelected}
        formatTimeAgo={formatTimeAgo}
        status={status}
        priority={priority}
        showProject={showProject}
        projectLabel={projectLabel ?? session.project_name}
        planTitle={planTitle}
      />

      {/* Native Rename Dialog */}
      <NativeRenameDialog
        open={editing.isNativeRenameOpen}
        onOpenChange={editing.setIsNativeRenameOpen}
        filePath={session.file_path}
        currentName={editing.localSummary || ""}
        provider={editing.providerId}
        onSuccess={(newTitle) => {
          void setHasClaudeCodeName(true);
          editing.handleNativeRenameSuccess(newTitle);
        }}
      />
      </div>

      {contextMenu && (
        <SessionContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onSetStatus={(nextStatus) => {
            void updateSessionMetadata(session.session_id, { status: nextStatus });
          }}
          onSetPriority={(nextPriority) => {
            void updateSessionMetadata(session.session_id, { priority: nextPriority });
          }}
          onViewPlan={
            resolvedPlanSlug
              ? () => {
                  const store = useAppStore.getState();
                  store.setAnalyticsCurrentView("plans");
                  void store.loadPlans().then(() => store.selectPlan(resolvedPlanSlug));
                }
              : undefined
          }
          runningSession={runningSession}
          onKillRunningSession={
            runningSession
              ? () => {
                  void killSessionProcess(runningSession.pid);
                }
              : undefined
          }
        />
      )}
    </>
  );
};
