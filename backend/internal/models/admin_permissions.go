package models

// Permission is a granular admin capability, finer-grained than AdminRole.
// Role membership is still checked at the route-group level via
// RequireAdminRoles; permissions are checked inside services for
// per-resource read/write decisions (e.g. "can this role write a
// COMMERCE-category feature flag").
type Permission string

const (
	PermissionFeatureFlagRead   Permission = "FEATURE_FLAG_READ"
	PermissionFeatureFlagWrite  Permission = "FEATURE_FLAG_WRITE"
	PermissionGlobalConfigRead  Permission = "GLOBAL_CONFIG_READ"
	PermissionGlobalConfigWrite Permission = "GLOBAL_CONFIG_WRITE"
)

// ConfigCategory scopes a feature flag or global config row to the admin
// domain that owns it.
const (
	ConfigCategoryCommerce  = "COMMERCE"
	ConfigCategoryFinance   = "FINANCE"
	ConfigCategoryTechnical = "TECHNICAL"
	ConfigCategoryGeneral   = "GENERAL"
)

// rolePermissions lists the permissions each role holds unconditionally.
// SUPER_ADMIN is not listed here: HasPermission grants it everything.
var rolePermissions = map[AdminRole][]Permission{
	AdminRoleDirectionAdmin: {
		PermissionFeatureFlagRead,
		PermissionGlobalConfigRead,
		PermissionFeatureFlagWrite,  // GENERAL category only, enforced by category check
		PermissionGlobalConfigWrite, // GENERAL category only, enforced by category check
	},
	AdminRoleCommerceAdmin: {
		PermissionFeatureFlagRead,
		PermissionGlobalConfigRead,
		PermissionFeatureFlagWrite,
		PermissionGlobalConfigWrite,
	},
	AdminRoleFinanceSupportAdmin: {
		PermissionFeatureFlagRead,
		PermissionGlobalConfigRead,
		PermissionFeatureFlagWrite,
		PermissionGlobalConfigWrite,
	},
	AdminRoleTechnicalAdmin: {
		PermissionFeatureFlagRead,
		PermissionGlobalConfigRead,
		PermissionFeatureFlagWrite,
		PermissionGlobalConfigWrite,
	},
}

// categoryOwner maps a config/flag category to the one non-super role
// allowed to write it outright. DIRECTION_ADMIN may only write GENERAL.
var categoryOwner = map[string]AdminRole{
	ConfigCategoryCommerce:  AdminRoleCommerceAdmin,
	ConfigCategoryFinance:   AdminRoleFinanceSupportAdmin,
	ConfigCategoryTechnical: AdminRoleTechnicalAdmin,
}

// HasPermission reports whether role may exercise perm against a resource
// in the given category. Read permissions are granted to any role that
// holds the permission at all (any admin in the /admin/platform group may
// read every flag/config for visibility); write permissions additionally
// require the role to own the resource's category, except DIRECTION_ADMIN
// (GENERAL only) and SUPER_ADMIN (always allowed).
func HasPermission(role AdminRole, category string, perm Permission) bool {
	if role == AdminRoleSuperAdmin {
		return true
	}

	perms, ok := rolePermissions[role]
	if !ok {
		return false
	}
	held := false
	for _, p := range perms {
		if p == perm {
			held = true
			break
		}
	}
	if !held {
		return false
	}

	// Read access: holding the permission is enough, no category restriction.
	if perm == PermissionFeatureFlagRead || perm == PermissionGlobalConfigRead {
		return true
	}

	// Write access: must own the category.
	if role == AdminRoleDirectionAdmin {
		return category == ConfigCategoryGeneral
	}
	owner, ok := categoryOwner[category]
	return ok && owner == role
}

// CanWriteHighRisk reports whether role may mutate a resource marked
// is_high_risk at all. DIRECTION_ADMIN is restricted to GENERAL low-risk
// configuration only and may never touch a high-risk flag, even one in the
// GENERAL category it otherwise owns. Every other role that owns the
// resource's category (checked separately via HasPermission) may write a
// high-risk resource, subject to the mandatory confirm+reason flow.
func CanWriteHighRisk(role AdminRole) bool {
	return role != AdminRoleDirectionAdmin
}
