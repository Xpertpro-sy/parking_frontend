import { VehicleStatus, STATUS_LABELS, STATUS_STYLES } from '@/types/vehicle';

interface StatusBadgeProps {
  status: VehicleStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
