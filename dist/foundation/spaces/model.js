export function faceId(value) {
    if (!/^f-[a-f0-9]{16}$/.test(value))
        throw new TypeError(`Invalid derived face ID: ${JSON.stringify(value)}.`);
    return value;
}
//# sourceMappingURL=model.js.map