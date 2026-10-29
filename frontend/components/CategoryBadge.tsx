import { CATEGORY_META, type CategoryKey } from "@/lib/constants";

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const meta = CATEGORY_META[category as CategoryKey] || {
    label: category,
    description: category,
    priority: 99,
  };

  const badgeClass = `badge badge-${category.toLowerCase().replace(/_/g, "-")}`;

  return (
    <span
      className={badgeClass}
      title={meta.description}
      aria-label={`Category: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}
