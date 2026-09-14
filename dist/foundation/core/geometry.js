import { areaUm2, coordinateUm, lengthUm, } from "./units.js";
export function pointUm(xUm, yUm) {
    return { xUm: coordinateUm(xUm, "x"), yUm: coordinateUm(yUm, "y") };
}
export function rectUm(xUm, yUm, widthUm, depthUm) {
    return {
        xUm: coordinateUm(xUm, "x"),
        yUm: coordinateUm(yUm, "y"),
        widthUm: lengthUm(widthUm, "width"),
        depthUm: lengthUm(depthUm, "depth"),
    };
}
export function rectArea(rectangle) {
    return areaUm2(rectangle.widthUm * rectangle.depthUm);
}
export function rectRight(rectangle) {
    return coordinateUm(rectangle.xUm + rectangle.widthUm);
}
export function rectFront(rectangle) {
    return coordinateUm(rectangle.yUm + rectangle.depthUm);
}
//# sourceMappingURL=geometry.js.map