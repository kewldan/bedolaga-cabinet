import { usePermissionStore } from '../../store/permissions';

interface PermissionGateProps {
  children: React.ReactNode;
  /** Single permission to check */
  permission?: string;
  /** Multiple permissions (OR by default, AND if requireAll is true) */
  permissions?: string[];
  /** When true, ALL listed permissions are required instead of ANY */
  requireAll?: boolean;
  /** Content to render when the user lacks the required permissions */
  fallback?: React.ReactNode;
}

export function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const hasAnyPermission = usePermissionStore((state) => state.hasAnyPermission);
  const hasAllPermissions = usePermissionStore((state) => state.hasAllPermissions);

  // Без указанных прав — доступ открыт
  const hasAccess = permission
    ? hasPermission(permission)
    : permissions && permissions.length > 0
      ? requireAll
        ? hasAllPermissions(...permissions)
        : hasAnyPermission(...permissions)
      : true;

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
