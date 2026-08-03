/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEISHU_PRODUCT_STATUS_URL?: string;
  readonly VITE_FEISHU_OQC_DAILY_URL?: string;
  readonly VITE_FEISHU_DELIVERY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
