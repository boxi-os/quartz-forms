export type Params = Record<string, string | number | boolean | undefined>;
export type Translate = (code: string, params?: Params) => string;
