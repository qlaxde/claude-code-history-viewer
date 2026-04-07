/**
 * @deprecated Import from '@/types' or '@/types/core/project' instead.
 *
 * Backward-compatible re-exports for legacy imports.
 */

export type {
  SessionMetadata,
  SessionStatus,
  SessionPriority,
  ProjectMetadata,
  GroupingMode,
  SessionSortOrder,
  UserSettings,
  UserMetadata,
  CustomClaudePath,
  WslDistro,
  WslSettings,
} from "./core/project";

export {
  METADATA_SCHEMA_VERSION,
  DEFAULT_USER_METADATA,
  isSessionMetadataEmpty,
  isProjectMetadataEmpty,
  getSessionDisplayName,
  isProjectHidden,
} from "./core/project";
