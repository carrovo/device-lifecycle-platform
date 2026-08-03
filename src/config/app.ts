export const APP_CONFIG = Object.freeze({
  storageKeys: {
    authToken: 'device-lifecycle-auth-token',
    authUser: 'device-lifecycle-auth-user',
  },
  externalLinks: {
    productStatus: import.meta.env.VITE_FEISHU_PRODUCT_STATUS_URL ?? '',
    oqcDaily: import.meta.env.VITE_FEISHU_OQC_DAILY_URL ?? '',
    delivery: import.meta.env.VITE_FEISHU_DELIVERY_URL ?? '',
  },
});
