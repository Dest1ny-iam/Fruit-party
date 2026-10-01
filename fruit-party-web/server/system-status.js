function parseValue(value) {
  if (typeof value === 'object' && value) return value
  try { return JSON.parse(value || '{}') } catch { return {} }
}

export function normalizeMaintenance(value = {}) {
  return {
    enabled: value.enabled === true,
    message: String(value.message || '').trim(),
    estimatedEndAt: value.estimatedEndAt ? new Date(value.estimatedEndAt).toISOString() : null,
  }
}

export async function readMaintenanceStatus(database) {
  const [row] = await database.query('SELECT setting_value AS settingValue, updated_at AS updatedAt FROM system_settings WHERE setting_key = \'maintenance\'')
  const status = normalizeMaintenance(parseValue(row?.settingValue))
  return { ...status, updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null }
}

export async function updateMaintenanceStatus(database, { adminId, enabled, message = '', estimatedEndAt = null }) {
  const status = normalizeMaintenance({ enabled, message, estimatedEndAt })
  return database.transaction(async (transaction) => {
    await transaction.execute(`
      INSERT INTO system_settings (setting_key, setting_value, updated_by)
      VALUES ('maintenance', ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(status), adminId])
    await transaction.execute(`
      INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
      VALUES (?, 'maintenance_change', 'system', 'maintenance', ?)
    `, [adminId, JSON.stringify(status)])
    const [row] = await transaction.query('SELECT updated_at AS updatedAt FROM system_settings WHERE setting_key = \'maintenance\'')
    return { ...status, updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null }
  })
}
