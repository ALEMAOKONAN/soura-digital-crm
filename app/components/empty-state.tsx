import { LucideIcon } from 'lucide-react';

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.5} />
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
    </div>
  );
}
