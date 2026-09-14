import {
  areaUm2,
  coordinateUm,
  lengthUm,
  type AreaUm2,
  type CoordinateUm,
  type LengthUm,
} from "./units.js";

export interface PointUm {
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
}

export interface RectUm {
  readonly xUm: CoordinateUm;
  readonly yUm: CoordinateUm;
  readonly widthUm: LengthUm;
  readonly depthUm: LengthUm;
}

export function pointUm(xUm: number, yUm: number): PointUm {
  return { xUm: coordinateUm(xUm, "x"), yUm: coordinateUm(yUm, "y") };
}

export function rectUm(xUm: number, yUm: number, widthUm: number, depthUm: number): RectUm {
  return {
    xUm: coordinateUm(xUm, "x"),
    yUm: coordinateUm(yUm, "y"),
    widthUm: lengthUm(widthUm, "width"),
    depthUm: lengthUm(depthUm, "depth"),
  };
}

export function rectArea(rectangle: RectUm): AreaUm2 {
  return areaUm2(rectangle.widthUm * rectangle.depthUm);
}

export function rectRight(rectangle: RectUm): CoordinateUm {
  return coordinateUm(rectangle.xUm + rectangle.widthUm);
}

export function rectFront(rectangle: RectUm): CoordinateUm {
  return coordinateUm(rectangle.yUm + rectangle.depthUm);
}
