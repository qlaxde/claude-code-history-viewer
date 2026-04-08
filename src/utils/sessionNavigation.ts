import type { ClaudeProject, ClaudeSession } from "@/types";

export function findProjectForSession(
  projects: ClaudeProject[],
  session: ClaudeSession
): ClaudeProject | undefined {
  const normalizedFilePath = session.file_path.replace(/\\/g, "/");

  return projects.find((project) => {
    const projectPath = project.path.replace(/\\/g, "/");
    const actualPath = project.actual_path.replace(/\\/g, "/");
    const sameProvider = (project.provider ?? "claude") === (session.provider ?? "claude");

    return (
      sameProvider && (
        normalizedFilePath.startsWith(`${projectPath}/`) ||
        normalizedFilePath === projectPath ||
        normalizedFilePath.startsWith(`${actualPath}/`) ||
        project.name === session.project_name
      )
    );
  });
}
