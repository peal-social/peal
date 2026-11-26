"use client";

import { ListChecksIcon, MessageSquarePlusIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";

// One of the toolbar's icon buttons, named in its tooltip.
const ToolbarButton = ({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  readonly disabled: boolean;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          focusableWhenDisabled
          onClick={onClick}
        />
      }
    >
      <Icon aria-hidden />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

/**
 * The text's toolbar buttons that add a poll and the parts after the
 * post, while the post has none: their sections show once they are used,
 * and say there which platforms take them. Nothing shows on a post that
 * can no longer be written.
 */
export const AddToPost = ({
  disabled,
  hasParts,
  hasPoll,
  onPart,
  onPoll,
  writable,
}: {
  readonly disabled: boolean;
  readonly hasParts: boolean;
  readonly hasPoll: boolean;
  readonly onPart: () => void;
  readonly onPoll: () => void;
  readonly writable: boolean;
}) => {
  const tPoll = useTranslations("Posts.Poll");
  const tParts = useTranslations("Posts.Parts");

  if (!writable) {
    return null;
  }

  return (
    <>
      {hasPoll ? null : (
        <ToolbarButton
          disabled={disabled}
          icon={ListChecksIcon}
          label={tPoll("add")}
          onClick={onPoll}
        />
      )}
      {hasParts ? null : (
        <ToolbarButton
          disabled={disabled}
          icon={MessageSquarePlusIcon}
          label={tParts("add")}
          onClick={onPart}
        />
      )}
    </>
  );
};
