import { workspaceHeader } from "peal-contract";

/** The name of the file an answer's `Content-Disposition` gives, if any. */
export const fileNameOf = (disposition: string | null): string | null =>
  /filename="(?<name>[^"]+)"/u.exec(disposition ?? "")?.groups?.["name"] ??
  null;

/**
 * Saves an export of the workspace's analytics. A link cannot carry the
 * header the API reads the workspace from, so the browser fetches the file,
 * with the session's cookies as it is same-origin, then hands it over
 * under the name the server gives. Resolves whether the server sent it.
 */
export const downloadExport = async (
  workspaceId: string,
  url: string,
  fallbackName: string
): Promise<boolean> => {
  const answer = await fetch(url, {
    credentials: "same-origin",
    headers: { [workspaceHeader]: workspaceId },
  });

  if (!answer.ok) {
    return false;
  }

  const href = URL.createObjectURL(await answer.blob());
  const anchor = document.createElement("a");

  anchor.href = href;
  anchor.download =
    fileNameOf(answer.headers.get("content-disposition")) ?? fallbackName;
  anchor.click();
  // Some browsers start the download after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1000);

  return true;
};
