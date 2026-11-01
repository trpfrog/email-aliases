// app.config.ts の型（各項目の説明は app.config.ts に書く）

type ColorPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface AppConfig {
  name: string;
  mailDomain: string;
  theme: {
    primaryColor: ColorPalette;
    primaryShade: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    browserColor: string;
  };
}

export interface DeployConfig {
  workerName: string;
  publicOrigin: string;
  d1DatabaseId?: string;
  kvNamespaceId?: string;
}

export function defineApp(config: AppConfig): AppConfig {
  return config;
}

export function defineDeploy(config: DeployConfig): DeployConfig {
  return config;
}
