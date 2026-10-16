export interface Meridian {
  id: string;
  name: string;
  nameEn: string;
  code: string;
  category: string;
  yinyang: string;
  handfoot: string;
  element: string;
  organ: string;
  time: string;
  color: string;
  description: string;
  /** 无独立经穴时的说明（如奇经六脉的交会穴说明） */
  note?: string;
  /** 交会穴代码列表（穴位实体位于其他经络） */
  jiaohui?: string[];
  /** 循行示意线坐标（viewBox 400×800，左半边，由组件镜像） */
  path?: {
    front?: [number, number][];
    back?: [number, number][];
  };
  points: string[];
}

export interface SvgCoords {
  front?: [number, number];
  back?: [number, number];
}

export interface Acupoint {
  code: string;
  name: string;
  nameEn: string;
  meridianId: string;
  location: string;
  finding: string;
  indications: string[];
  method: string;
  warning?: string;
  classics: string;
  svg: SvgCoords;
}
