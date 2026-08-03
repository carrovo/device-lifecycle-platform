# 设备全生命周期平台 · 独立 Mock 前端

这是从设备全生命周期平台中单独提取的前端版本，可在没有 Java、MySQL、Redis、用友 ERP 或飞书服务的情况下独立运行，并可直接部署到 Vercel。

## 特性

- React 19 + TypeScript + Vite + Tailwind CSS
- 所有原后端接口均由浏览器内 Mock API 接管
- 覆盖认证、设备、生产、项目、点位、交付、系统管理和 8 类 ERP 单据
- 查询、详情、分页及常用新增/编辑/删除操作可演示
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

Mock 初始数据定义在 `src/mock/data.ts`，接口路由与读写逻辑位于 `src/mock/server.ts`。演示过程中的写操作只影响当前浏览器的本地存储，不会访问网络或修改真实业务数据。清除站点的 Local Storage 后即可恢复初始数据。
