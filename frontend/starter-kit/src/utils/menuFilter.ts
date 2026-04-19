import type { MenuItemWithPermission } from '@/data/navigation/verticalMenuData'
import type { HorizontalMenuItemWithPermission } from '@/data/navigation/horizontalMenuData'

type AnyMenuItem = MenuItemWithPermission | HorizontalMenuItemWithPermission

export function filterMenuByPermission<T extends AnyMenuItem>(
  items: T[],
  hasPermission: (perm: string) => boolean,
  userRole?: string | null
): T[] {
  return items.reduce<T[]>((acc, item) => {
    const roles = (item as { roles?: string[] }).roles
    if (roles?.length) {
      if (!userRole || !roles.includes(userRole)) {
        return acc
      }
    } else if (item.permission && !hasPermission(item.permission)) {
      return acc
    }

    const withChildren = item as T & { children?: T[] }

    if (withChildren.children) {
      const filteredChildren = filterMenuByPermission(withChildren.children, hasPermission, userRole)

      if (filteredChildren.length === 0) return acc

      acc.push({ ...item, children: filteredChildren } as T)
    } else {
      acc.push(item)
    }

    return acc
  }, [])
}
