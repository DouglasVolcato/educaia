export var ValidatorTypeEnum;
(function (ValidatorTypeEnum) {
    ValidatorTypeEnum["REQUIRED"] = "REQUIRED";
    ValidatorTypeEnum["EMAIL"] = "EMAIL";
    ValidatorTypeEnum["STRING"] = "STRING";
    ValidatorTypeEnum["NUMBER"] = "NUMBER";
    ValidatorTypeEnum["FLOAT"] = "FLOAT";
})(ValidatorTypeEnum || (ValidatorTypeEnum = {}));
export class ValidatorBuilder {
    constructor() {
        this.field = "";
        this.type = [];
        this.message = "";
    }
    setField(name) {
        this.field = name;
        return this;
    }
    addType(type) {
        this.type.push(type);
        return this;
    }
    setMessage(message) {
        this.message = message;
        return this;
    }
    build() {
        return {
            validate: (data) => {
                for (const typeValue of this.type) {
                    switch (typeValue) {
                        case ValidatorTypeEnum.REQUIRED:
                            if (!data[this.field] &&
                                data[this.field] !== "" &&
                                data[this.field] !== 0) {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.EMAIL:
                            if (data[this.field] &&
                                typeof data[this.field] === "string" &&
                                !data[this.field].match(/^((?!\.)[\w\-_.]*[^.])(@\w+)(\.\w+(\.\w+)?[^.\W])$/gm)) {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.STRING:
                            if (data[this.field] && typeof data[this.field] !== "string") {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.NUMBER:
                            if (data[this.field] !== undefined &&
                                data[this.field] !== null &&
                                (typeof data[this.field] !== "number" &&
                                    typeof data[this.field] !== "string" ||
                                    isNaN(Number(data[this.field])))) {
                                return this.message;
                            }
                            break;
                    }
                }
            },
        };
    }
}
