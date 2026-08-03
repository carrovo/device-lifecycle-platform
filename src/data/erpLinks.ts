export function erpReferenceUrl(reference, returnTo = '') {
  const type = reference?.type === '调拨订单' ? 'transferOrder' : 'salesOutbound';
  const params = new URLSearchParams({ tab: 'list', type, doc: reference?.no || '' });
  if (returnTo) params.set('returnTo', returnTo);
  return `/erp-center?${params.toString()}`;
}

export function deliveryRelationErpReference(relation) {
  if (!relation?.erpSourceNo) return null;
  return { type: relation.erpSourceType, no: relation.erpSourceNo };
}
