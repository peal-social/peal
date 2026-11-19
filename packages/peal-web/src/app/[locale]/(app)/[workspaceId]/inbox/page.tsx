import { InboxIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";

// The inbox with nothing open: the list beside it (the layout's) says
// what there is, and this pane what to do.
const InboxPage = async () => {
  const t = await getTranslations("InboxList");

  return (
    <EmptyState>
      <EmptyStateIcon icon={<InboxIcon />} />
      <EmptyStateTitle>{t("nothingOpen")}</EmptyStateTitle>
      <EmptyStateDescription>{t("nothingOpenHint")}</EmptyStateDescription>
    </EmptyState>
  );
};

export default InboxPage;
