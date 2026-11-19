"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";

import { SplitView } from "#components/shell/frame-view.tsx";

import { InboxList } from "./inbox-list.tsx";

/**
 * The inbox as a split view (DESIGN.md, "Split view"): its list, and
 * beside it the comment, review or conversation open, the page under the
 * inbox's address (`children`); an item is open once the address goes
 * past the inbox's own.
 */
export const InboxSplit = ({
  children,
  mayChooseChannels,
  mayReadMessages,
  workspaceId,
}: {
  readonly children: ReactNode;
  readonly mayChooseChannels: boolean;
  readonly mayReadMessages: boolean;
  readonly workspaceId: string;
}) => {
  const open = useSelectedLayoutSegments().length > 0;

  return (
    <SplitView
      detail={children}
      list={
        <InboxList
          mayChooseChannels={mayChooseChannels}
          mayReadMessages={mayReadMessages}
          workspaceId={workspaceId}
        />
      }
      open={open}
    />
  );
};
