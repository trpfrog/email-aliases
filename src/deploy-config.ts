// deploy.config.ts の型（各項目の説明は deploy.config.ts に書く）
// Worker から読まれる src/app-config.ts とは分ける

export interface DeployConfig {
  workerName: string;
  publicOrigin: string;
  d1DatabaseId?: string;
  kvNamespaceId?: string;
}

export function defineDeploy(config: DeployConfig): DeployConfig {
  return config;
}
