import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const tables = {
  production_device: ['id', 'archive_status', 'assembler', 'created_at', 'current_production_node', 'device_type_id', 'electronic_acceptance_url', 'erp_inbound_no', 'failed_node', 'location_id', 'production_complete', 'production_status', 'project_id', 'repair_status', 'robot_no', 'sn', 'status', 'updated_at', 'erp_batch_no', 'erp_inbound_matched_at', 'erp_inbound_record_id', 'erp_inbound_status', 'erp_inbound_time', 'erp_serial_no', 'erp_stock_status', 'exception_note', 'inbound_time', 'pre_assigned_location_id', 'warehouse', 'erp_inbound_verified_at', 'erp_inbound_sync_message'],
  production_device_erp_inbound_link: ['device_id', 'erp_record_id', 'inbound_no', 'batch_no', 'serial_no', 'inbound_time', 'warehouse', 'stock_status', 'product_code', 'product_name', 'quantity', 'verified_at'],
  production_device_feishu_link: ['id', 'device_id', 'sequence_no', 'link_name', 'link_url', 'note'],
  production_device_type: ['id', 'name'],
  production_history: ['id', 'device_id', 'node', 'node_label', 'occurred_at', 'operator', 'record_type', 'result', 'sequence_no', 'summary', 'confirmed', 'ng_reason', 'notes', 'repair_required', 'repair_summary', 'replacement_summary', 'resolved', 'retest_result'],
  production_history_correction: ['id', 'history_id', 'sequence_no', 'note', 'operator_name', 'corrected_at'],
  production_history_revision: ['id', 'history_id', 'sequence_no', 'previous_result', 'previous_summary', 'reason', 'operator_name', 'revised_at'],
  project_center_delivery_batch: ['id', 'delivery_plan_id', 'sequence_no', 'base_name', 'supplement', 'location_id', 'planned_date', 'owner', 'notes', 'created_by', 'created_at', 'updated_at'],
  project_center_delivery_device_relation: ['id', 'delivery_plan_id', 'batch_id', 'device_id', 'target_location_id', 'actual_location_id', 'result', 'actual_date', 'result_summary', 'exception_description', 'document_url', 'recorder', 'record_time', 'erp_delivery_status', 'erp_source_type', 'erp_source_no', 'erp_source_id', 'erp_detail_id', 'erp_batch_no', 'erp_document_date', 'erp_verified_at', 'erp_matched_at', 'erp_sync_message'],
  project_center_delivery_erp_reference: ['id', 'delivery_plan_id', 'batch_id', 'sequence_no', 'reference_type', 'reference_no', 'summary', 'business_id', 'document_date', 'source_status', 'validation_status', 'linked_by', 'linked_at', 'verified_at', 'validation_message'],
  project_center_delivery_exception: ['id', 'batch_id', 'delivery_plan_id', 'project_id', 'record_time', 'recorder', 'source_record_id', 'source_type', 'description', 'source_title'],
  project_center_delivery_exception_device: ['exception_id', 'device_id'],
  project_center_delivery_feishu_link: ['id', 'delivery_plan_id', 'batch_id', 'link_name', 'link_url', 'note', 'sequence_no'],
  project_center_delivery_plan: ['id', 'created_at', 'created_by', 'owner', 'planned_count', 'project_id', 'target_date', 'updated_at', 'demand_description', 'feishu_demand_url', 'next_batch_sequence', 'notes'],
  project_center_delivery_result_revision: ['id', 'relation_id', 'sequence_no', 'previous_result', 'revised_result', 'actual_date', 'actual_location_id', 'result_summary', 'exception_description', 'document_url', 'recorder', 'record_time', 'modification_reason', 'revised_at'],
  project_center_delivery_site_record: ['id', 'delivery_plan_id', 'batch_id', 'content', 'has_exception', 'exception_description', 'document_url', 'recorder', 'record_time'],
  project_center_delivery_site_record_device: ['record_id', 'device_id'],
  project_center_location: ['id', 'address', 'disabled', 'name', 'owner', 'project_id', 'updated_at'],
  project_center_project: ['id', 'client', 'manager', 'name', 'notes', 'project_type', 'updated_at'],
  sys_operation_log: ['id', 'action_type', 'from_status', 'module', 'notes', 'object_id', 'object_type', 'occurred_at', 'operator_name', 'to_status', 'device_id', 'project_id', 'delivery_plan_id', 'batch_id'],
  sys_production_node: ['node_key', 'node_name', 'node_kind', 'sort_order', 'enabled'],
  sys_project_type: ['code', 'name', 'sort_order', 'enabled'],
  sys_role: ['role_name', 'description', 'display_name', 'enabled', 'module_scope', 'route_paths', 'sort_order'],
  // Password hashes, contact details and provider identities are intentionally excluded.
  sys_user: ['id', 'avatar', 'data_scope', 'dept', 'last_login', 'name', 'project_scope', 'role', 'status', 'title', 'username'],
};

const bitColumns = new Set([
  'production_device.production_complete',
  'project_center_location.disabled',
  'sys_production_node.enabled',
  'sys_project_type.enabled',
  'sys_role.enabled',
]);

const mysqlArgs = [
  '--protocol=TCP',
  `--host=${process.env.DB_HOST || '127.0.0.1'}`,
  `--port=${process.env.DB_PORT || '3307'}`,
  `--user=${process.env.DB_USERNAME || 'root'}`,
  `--password=${process.env.DB_PASSWORD || ''}`,
  '--database=ai2rocks_device_lifecyle',
  '--batch', '--raw', '--skip-column-names',
];

function query(sql) {
  return execFileSync('mysql', [...mysqlArgs, '--execute', sql], { encoding: 'utf8' }).trim();
}

const snapshot = { snapshotVersion: 1, exportedAt: new Date().toISOString(), tables: {} };
for (const [table, columns] of Object.entries(tables)) {
  const pairs = columns.flatMap((column) => {
    const value = bitColumns.has(`${table}.${column}`)
      ? `CAST(\`${column}\` AS UNSIGNED)`
      : `\`${column}\``;
    return [`'${column}'`, value];
  }).join(', ');
  const order = columns.slice(0, 2).map((column) => `\`${column}\``).join(', ');
  const output = query(`SELECT JSON_OBJECT(${pairs}) FROM \`${table}\` ORDER BY ${order}`);
  snapshot.tables[table] = output ? output.split('\n').map((line) => JSON.parse(line)) : [];
}

const outputPath = resolve('src/mock/dbSnapshot.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Exported ${Object.values(snapshot.tables).reduce((sum, rows) => sum + rows.length, 0)} rows to ${outputPath}`);
