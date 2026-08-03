# 设备全生命周期平台 · 独立 Mock 前端

这是从设备全生命周期平台中单独提取的前端版本，可在没有 Java、MySQL、Redis、用友 ERP 或飞书服务的情况下独立运行，并可直接部署到 Vercel。

## 特性

- React 19 + TypeScript + Vite + Tailwind CSS
- 所有原后端接口均由浏览器内 Mock API 接管
- 覆盖认证、设备、生产、项目、点位、交付、系统管理和 8 类 ERP 单据
- 查询、详情、分页及常用新增/编辑/删除操作可演示
- 初始 Mock 数据来自现有 MySQL 数据库和现有 ERP 接口快照，不包含虚构业务记录
- 修改后的演示数据持久化在浏览器 `localStorage` 中
- 已包含 Vercel SPA 路由重写配置

## 本地运行

```bash
npm install
npm run dev
```

访问终端显示的本地地址。登录页已预填：

- 账号：`admin`
- 密码：`demo123`

Mock 登录也接受任意非空账号和密码。

## 验证与构建

```bash
npm run typecheck
npm run lint
npm run build
```

构建产物位于 `dist/`。

## 部署到 Vercel

1. 在 Vercel 导入本仓库。
2. 选择 `v1` 分支。
3. Framework Preset 选择 Vite（通常会自动识别）。
4. 不需要配置任何后端或 Mock 相关环境变量。
5. 点击 Deploy。

`vercel.json` 已配置所有前端路由回退至 `index.html`，刷新详情页不会出现 404。

## Mock 数据说明

业务初始数据保存在 `src/mock/dbSnapshot.json`，由现有 MySQL 数据库于 **2026-08-03** 导出；`src/mock/data.ts` 只负责把数据库字段转换成前端现有的数据结构。导出时明确排除了密码哈希、邮箱、手机号、员工号、第三方身份标识和应用密钥。

8 类 ERP 单据保存在 `src/mock/erpSnapshot.json`，由现有后端代理真实 ERP 接口于 **2026-08-03** 抓取。每类单据只抓取前 **2 页**，每页请求 10 条；不足两页或重复记录不会使用占位数据补齐。

接口路由与浏览器内读写逻辑位于 `src/mock/server.ts`。演示过程中的写操作只影响当前浏览器的本地存储，不会访问网络、数据库或修改真实业务数据。清除站点的 Local Storage 后即可恢复到上述快照。

如需在有权限的内部环境重新生成快照，可运行：

```bash
# 使用 DB_HOST、DB_PORT、DB_USERNAME、DB_PASSWORD（按需设置）
npm run mock:export

# 需先启动原后端，并设置其 JWT_SECRET
BACKEND_URL=http://127.0.0.1:18088 JWT_SECRET=*** npm run mock:export:erp
```

快照含真实业务数据。部署公开站点前，请由数据负责人确认公开范围。
