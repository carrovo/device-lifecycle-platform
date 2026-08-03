export const MOCK_STORAGE_KEY = 'device-lifecycle-mock-state-v1';

const history = (deviceId: string, offset = 0) => [
  { id: `PH-${deviceId}-1`, node: 'assembly1', nodeLabel: '立腿与装配', recordType: 'node', result: '已完成', operator: '李明', time: `2026-07-${String(18 + offset).padStart(2, '0')} 09:20`, summary: '装配完成，关键扭矩检查通过' },
  { id: `PH-${deviceId}-2`, node: 'initial', nodeLabel: '初测', recordType: 'node', result: 'Pass', operator: '王倩', time: `2026-07-${String(20 + offset).padStart(2, '0')} 14:10`, summary: '基础功能与安全项测试通过' },
];

const inboundLink = (index: number, robotNo: string) => ({
  recordId: `ERP-IN-DETAIL-${index}`,
  inboundNo: `CPRK-202607-${String(index).padStart(3, '0')}`,
  batchNo: robotNo,
  productCode: 'ROBOT-ALPHA-2',
  productName: 'AlphaBot 2 智能服务机器人',
  serialNo: `SN-ERP-${String(index).padStart(4, '0')}`,
  warehouse: '深圳成品仓',
  inboundTime: `2026-07-${String(22 + index).padStart(2, '0')} 16:30`,
});

export function createInitialState() {
  const projects = [
    { id: 'PROJ-SH-001', name: '上海智慧展厅机器人项目', projectType: '展厅服务', client: '上海未来科技馆', manager: '赵敏', notes: '一期交付与现场联调', updatedAt: '2026-08-02 15:20' },
    { id: 'PROJ-SZ-002', name: '深圳园区接待升级项目', projectType: '园区接待', client: '南山智造园', manager: '陈晨', notes: '覆盖 A、B 两栋大厅', updatedAt: '2026-08-01 10:45' },
    { id: 'PROJ-HZ-003', name: '杭州医院导诊试点', projectType: '医疗导诊', client: '杭州仁和医院', manager: '周宁', notes: '试点项目', updatedAt: '2026-07-29 17:10' },
  ];
  const locations = [
    { id: 'LOC-SH-LOBBY', projectId: 'PROJ-SH-001', name: '一层迎宾大厅', code: 'SH-L1', address: '上海市浦东新区科创路 88 号', contact: '刘经理', phone: '138****6601', disabled: false, updatedAt: '2026-08-01 10:00' },
    { id: 'LOC-SH-HALL', projectId: 'PROJ-SH-001', name: '未来体验厅', code: 'SH-L2', address: '上海市浦东新区科创路 88 号二层', contact: '许老师', phone: '138****6602', disabled: false, updatedAt: '2026-08-01 10:05' },
    { id: 'LOC-SZ-A', projectId: 'PROJ-SZ-002', name: 'A 栋接待台', code: 'SZ-A1', address: '深圳市南山区智造大道 18 号', contact: '林主管', phone: '138****7711', disabled: false, updatedAt: '2026-07-31 16:20' },
    { id: 'LOC-HZ-OUTPATIENT', projectId: 'PROJ-HZ-003', name: '门诊大厅', code: 'HZ-MZ', address: '杭州市西湖区健康路 6 号', contact: '沈主任', phone: '138****8821', disabled: false, updatedAt: '2026-07-29 17:15' },
  ];
  const devices = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const id = `DEV-MOCK-${String(number).padStart(3, '0')}`;
    const robotNo = `AlphaBot2-${String(160 + number).padStart(4, '0')}`;
    const completed = index < 7;
    const inbound = index < 5;
    const projectId = index < 4 ? 'PROJ-SH-001' : index < 7 ? 'PROJ-SZ-002' : index === 7 ? 'PROJ-HZ-003' : null;
    const locationId = index < 2 ? 'LOC-SH-LOBBY' : index < 4 ? 'LOC-SH-HALL' : index < 7 ? 'LOC-SZ-A' : index === 7 ? 'LOC-HZ-OUTPATIENT' : null;
    const erpInboundLinks = inbound ? [inboundLink(number, robotNo)] : [];
    return {
      id, sn: `DLP-2026-${String(number).padStart(4, '0')}`, robotNo,
      deviceTypeId: index % 3 === 0 ? 'TYPE-PRO' : index % 3 === 1 ? 'TYPE-STANDARD' : 'TYPE-MINI',
      status: completed ? (inbound ? '已入库' : '待产品入库') : index % 2 ? 'OQT终测中' : '中测中',
      productionStatus: completed ? (inbound ? 'inbound' : 'pendingInbound') : index % 2 ? 'final' : 'assembly2',
      currentProductionNode: completed ? 'final' : index % 2 ? 'final' : 'assembly2',
      productionComplete: completed, repairStatus: index === 6 ? 'retested' : null,
      archiveStatus: '有效', assembler: index % 2 ? '李明' : '孙浩',
      createdAt: `2026-07-${String(10 + index).padStart(2, '0')} 09:10`, updatedAt: `2026-08-0${(index % 3) + 1} 1${index}:20`,
      projectId, locationId, erpInboundNo: erpInboundLinks[0]?.inboundNo || '',
      erpInboundStatus: inbound ? '已关联' : '未关联', erpInboundVerifiedAt: inbound ? '2026-08-02 08:30' : '',
      erpInboundLinks, electronicAcceptanceUrl: '', otherFeishuTables: [], deliveryPlanIds: [],
      productionHistory: [...history(id, Math.min(index, 5)), ...(completed ? [
        { id: `PH-${id}-3`, node: 'assembly2', nodeLabel: '中测', recordType: 'node', result: 'Pass', operator: '王倩', time: '2026-07-26 11:00', summary: '整机联调通过' },
        { id: `PH-${id}-4`, node: 'final', nodeLabel: 'OQT 终测', recordType: 'node', result: 'Pass', operator: '何亮', time: '2026-07-28 15:40', summary: '终测通过，准予入库' },
      ] : [])],
    };
  });
  const batchOne = {
    id: 'BAT-DE-SH-001-01', sequence: 1, baseName: '首批进场', supplement: '展厅区域', locationId: 'LOC-SH-LOBBY', plannedDate: '2026-08-08', owner: '陈晨',
    notes: '上午进场，完成网络和地图初始化', createdBy: '赵敏', createdAt: '2026-07-25 10:00', updatedAt: '2026-08-02 14:30',
    deviceRelations: [0, 1, 2].map((index) => ({ id: `DR-SH-${index + 1}`, deviceId: devices[index].id, targetLocationId: index < 2 ? 'LOC-SH-LOBBY' : 'LOC-SH-HALL', actualLocationId: index < 2 ? 'LOC-SH-LOBBY' : null, result: index === 0 ? '通过' : index === 1 ? '未通过' : '未确认', actualDate: index < 2 ? '2026-08-02' : '', resultSummary: index === 0 ? '现场验收通过' : index === 1 ? '导航点位需复核' : '', exceptionDescription: index === 1 ? '玻璃幕墙区域定位漂移' : '', documentUrl: '', recorder: '陈晨', recordTime: index < 2 ? '2026-08-02 14:20' : '', resultHistory: [] })),
    erpReferences: [{ type: '销售出库单', typeKey: 'salesOutbound', no: 'XSCK-202608-001', businessId: 'ERP-SO-001', summary: '上海未来科技馆首批设备' }],
    feishuLinks: [{ id: 'BFS-001', name: '首批交付协同表', url: 'https://example.com/mock-delivery-sheet', note: '演示链接' }],
    siteRecords: [{ id: 'SITE-001', content: '完成设备卸货、通电和基础网络检查', deviceIds: [devices[0].id, devices[1].id], hasException: true, exceptionDescription: '2 号设备导航点位待调整', documentUrl: '', recorder: '陈晨', time: '2026-08-02 13:40' }],
  };
  const batchTwo = {
    id: 'BAT-DE-SZ-002-01', sequence: 1, baseName: 'A 栋首批交付', supplement: '', locationId: 'LOC-SZ-A', plannedDate: '2026-08-15', owner: '周宁', notes: '', createdBy: '陈晨', createdAt: '2026-07-28 11:00', updatedAt: '2026-08-01 09:20',
    deviceRelations: [4, 5, 6].map((index, relationIndex) => ({ id: `DR-SZ-${relationIndex + 1}`, deviceId: devices[index].id, targetLocationId: 'LOC-SZ-A', actualLocationId: relationIndex === 0 ? 'LOC-SZ-A' : null, result: relationIndex === 0 ? '通过' : '未确认', actualDate: relationIndex === 0 ? '2026-08-01' : '', resultSummary: relationIndex === 0 ? '安装调试完成' : '', exceptionDescription: '', documentUrl: '', recorder: relationIndex === 0 ? '周宁' : '', recordTime: relationIndex === 0 ? '2026-08-01 16:00' : '', resultHistory: [] })),
    erpReferences: [{ type: '调拨订单', typeKey: 'transferOrder', no: 'DBSQ-202608-008', businessId: 'ERP-TR-008', summary: '深圳园区 A 栋设备调拨' }], feishuLinks: [], siteRecords: [],
  };
  const deliveryPlans = [
    { id: 'DE-SH-001', projectId: 'PROJ-SH-001', plannedCount: 4, owner: '陈晨', targetDate: '2026-08-12', demandDescription: '完成展厅迎宾与讲解路线配置', feishuDemandUrl: '', notes: '分两批执行', createdBy: '赵敏', createdAt: '2026-07-24 09:30', updatedAt: '2026-08-02 14:30', nextBatchSequence: 2, batches: [batchOne] },
    { id: 'DE-SZ-002', projectId: 'PROJ-SZ-002', plannedCount: 3, owner: '周宁', targetDate: '2026-08-18', demandDescription: '完成 A 栋接待区部署', feishuDemandUrl: '', notes: '', createdBy: '陈晨', createdAt: '2026-07-28 10:30', updatedAt: '2026-08-01 09:20', nextBatchSequence: 2, batches: [batchTwo] },
  ];
  const deliveryExceptions = [{ id: 'DEX-001', projectId: 'PROJ-SH-001', deliveryPlanId: 'DE-SH-001', batchId: 'BAT-DE-SH-001-01', sourceTitle: '导航点位复核', sourceType: '设备结果', affectedDeviceIds: [devices[1].id], description: '玻璃幕墙区域定位漂移，需重新采集地图特征。', recorder: '陈晨', recordTime: '2026-08-02 14:25', status: '处理中' }];
  const users = [
    { id: 'USR-001', username: 'admin', name: '演示管理员', avatar: '演', dept: '质量与交付中心', title: '平台管理员', role: '管理员', status: '启用', lastLogin: '2026-08-03 09:00', employeeNo: 'E001', email: 'admin@example.com' },
    { id: 'USR-002', username: 'zhaomin', name: '赵敏', dept: '项目管理部', title: '项目负责人', role: '项目负责人', status: '启用', lastLogin: '2026-08-02 18:20' },
    { id: 'USR-003', username: 'lichen', name: '李明', dept: '生产制造部', title: '装配工程师', role: '装配工', status: '启用', lastLogin: '2026-08-02 17:30' },
    { id: 'USR-004', username: 'wangqian', name: '王倩', dept: '质量中心', title: '测试工程师', role: '测试员', status: '启用', lastLogin: '2026-08-02 16:50' },
  ];
  const operationLogs = [
    { id: 'LOG-001', timestamp: '2026-08-02 14:30', operator: '陈晨', module: '项目中心', actionType: '录入交付结果', objectType: '交付批次', objectId: batchOne.id, projectId: 'PROJ-SH-001', deliveryPlanId: 'DE-SH-001', batchId: batchOne.id, notes: '更新首批设备交付结果' },
    { id: 'LOG-002', timestamp: '2026-08-02 08:30', operator: '系统任务', module: '设备管理', actionType: '同步 ERP 入库关联', objectType: '设备', objectId: devices[0].id, deviceId: devices[0].id, notes: '匹配产品入库单 CPRK-202607-001' },
    { id: 'LOG-003', timestamp: '2026-08-01 16:00', operator: '周宁', module: '项目中心', actionType: '现场交付', objectType: '交付批次', objectId: batchTwo.id, projectId: 'PROJ-SZ-002', deliveryPlanId: 'DE-SZ-002', batchId: batchTwo.id, notes: 'A 栋首台设备安装调试完成' },
  ];
  return { projects, locations, devices, deliveryPlans, deliveryExceptions, users, operationLogs };
}

export const dictionaries = {
  projectTypes: [{ code: 'EXHIBITION', name: '展厅服务' }, { code: 'PARK', name: '园区接待' }, { code: 'MEDICAL', name: '医疗导诊' }],
  productionNodes: [
    { key: 'assembly1', label: '立腿与装配', kind: 'normal' },
    { key: 'initial', label: '初测', kind: 'test' },
    { key: 'assembly2', label: '中测', kind: 'test' },
    { key: 'final', label: 'OQT 终测', kind: 'test' },
  ],
};

export const deviceTypes = [
  { id: 'TYPE-PRO', name: 'AlphaBot 2 Pro' },
  { id: 'TYPE-STANDARD', name: 'AlphaBot 2 标准版' },
  { id: 'TYPE-MINI', name: 'AlphaBot Mini' },
];

export const roles = [
  { role: '管理员', displayName: '管理员', count: 1, description: '维护平台配置、用户与全量业务数据', modules: '全部模块' },
  { role: '项目负责人', displayName: '项目负责人', count: 1, description: '维护项目、点位和交付执行', modules: '首页、项目中心、设备管理' },
  { role: '装配工', displayName: '装配工', count: 1, description: '录入设备建档与装配节点', modules: '首页、生产中心、设备管理' },
  { role: '测试员', displayName: '测试员', count: 1, description: '录入测试与复测结果', modules: '首页、生产中心、设备管理' },
];
