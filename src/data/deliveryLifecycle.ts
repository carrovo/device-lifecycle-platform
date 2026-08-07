export function subOrdersForDevice(state: any, deviceId: string) {
  return (state.deliverySubOrders || []).filter((order) => order.type === 'deployment' && (order.devices || []).some((record) => record.deviceId === deviceId));
}

export function issuesForDevice(state: any, deviceId: string) {
  return (state.issueRecords || []).filter((issue) => issue.deviceId === deviceId);
}

export function afterSalesForDevice(state: any, deviceId: string) {
  const issueIds = new Set(issuesForDevice(state, deviceId).map((issue) => issue.id));
  return (state.afterSalesOrders || []).filter((order) => order.deviceId === deviceId || issueIds.has(order.issueId));
}

export function deviceExecutionSummary(state: any, deviceId: string) {
  const orders = subOrdersForDevice(state, deviceId);
  const records = orders.flatMap((order) => (order.devices || []).filter((record) => record.deviceId === deviceId));
  const latest = records.slice().sort((a, b) => String(b.id).localeCompare(String(a.id)))[0];
  const issues = issuesForDevice(state, deviceId);
  const afterSales = afterSalesForDevice(state, deviceId);
  return { orders, records, latest, issues, afterSales };
}
