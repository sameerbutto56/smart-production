// Canonical pause profiles for the profile-level system pause feature.
// Each profile maps to concrete roles (or outlet-name matching for OUTLET users).
// Control roles (admins / software settings) are never paused — they operate the pause itself.

const CONTROL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'SOFTWARE_SETTINGS'];

const PROFILES = [
  { key: 'order_entry', label: 'Order Entry', roles: ['ORDER_ENTRY'] },
  { key: 'verification', label: 'Verification / Inventory View', roles: ['INVENTORY_VIEW'] },
  { key: 'faisal', label: 'Faisal', roles: ['FAISAL'] },
  { key: 'store', label: 'Store', roles: ['STORE', 'STORE_EMPLOYEE'] },
  { key: 'logo_design', label: 'Logo Design', roles: ['LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER'] },
  { key: 'production', label: 'Production', roles: ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'] },
  { key: 'dispatch', label: 'Dispatch', roles: ['DISPATCH', 'MAIN_EMPLOYEE'] },
  { key: 'delivery', label: 'Delivery Boy', roles: ['DELIVERY_BOY'] },
  { key: 'outlet_johar', label: 'Johar Town Outlet', outlets: ['johar'] },
  { key: 'outlet_abbottabad', label: 'Abbottabad Outlet', outlets: ['abbottabad'] },
  { key: 'outlet_jail', label: 'Jail Road Outlet', outlets: ['jail'] },
  { key: 'outlet_other', label: 'Other Outlet Profiles', outletOther: true },
];

const DEFAULT_PROFILE_KEYS = PROFILES.map((p) => p.key);
const VALID_KEYS = new Set(DEFAULT_PROFILE_KEYS);

const profileByRole = new Map();
PROFILES.forEach((p) => (p.roles || []).forEach((r) => profileByRole.set(r, p.key)));

// Resolve a JWT user ({ role, name }) to a pause profile key.
// Returns 'control' for admin/CEO/software-settings roles (never paused),
// a profile key for known operational roles / outlets, or null for unknown roles.
const resolveProfileKey = (user) => {
  const role = user?.role;
  if (!role) return null;
  if (CONTROL_ROLES.includes(role)) return 'control';
  if (role === 'OUTLET') {
    const name = String(user?.name || '').toLowerCase();
    if (name.includes('johar')) return 'outlet_johar';
    if (name.includes('abbottabad')) return 'outlet_abbottabad';
    if (name.includes('jail')) return 'outlet_jail';
    return 'outlet_other';
  }
  return profileByRole.get(role) || null;
};

// Concrete role strings covered by the given profile keys (used for notifications).
const rolesForProfiles = (keys) => {
  const roles = new Set();
  (keys || []).forEach((key) => {
    const p = PROFILES.find((x) => x.key === key);
    (p?.roles || []).forEach((r) => roles.add(r));
  });
  return [...roles];
};

module.exports = { PROFILES, CONTROL_ROLES, DEFAULT_PROFILE_KEYS, VALID_KEYS, resolveProfileKey, rolesForProfiles };
