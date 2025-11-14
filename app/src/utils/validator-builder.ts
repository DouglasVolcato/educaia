export enum ValidatorTypeEnum {
    REQUIRED = "REQUIRED",
    EMAIL = "EMAIL",
    STRING = "STRING",
    NUMBER = "NUMBER",
    FLOAT = "FLOAT",
}

export class ValidatorBuilder {
    private field: string;
    private type: ValidatorTypeEnum[];
    private message: string;

    public constructor() {
        this.field = "";
        this.type = [];
        this.message = "";
    }

    public setField(name: string): ValidatorBuilder {
        this.field = name;
        return this;
    }

    public addType(type: ValidatorTypeEnum): ValidatorBuilder {
        this.type.push(type);
        return this;
    }

    public setMessage(message: string): ValidatorBuilder {
        this.message = message;
        return this;
    }

    public build(): {
        validate(data: any): string | undefined;
    } {
        return {
            validate: (data: any): string | undefined => {
                for (const typeValue of this.type) {
                    switch (typeValue) {
                        case ValidatorTypeEnum.REQUIRED:
                            if (
                                !data[this.field] &&
                                data[this.field] !== "" &&
                                data[this.field] !== 0
                            ) {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.EMAIL:
                            if (
                                data[this.field] &&
                                typeof data[this.field] === "string" &&
                                !data[this.field].match(
                                    /^((?!\.)[\w\-_.]*[^.])(@\w+)(\.\w+(\.\w+)?[^.\W])$/gm
                                )
                            ) {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.STRING:
                            if (data[this.field] && typeof data[this.field] !== "string") {
                                return this.message;
                            }
                            break;
                        case ValidatorTypeEnum.NUMBER:
                            if (
                                data[this.field] !== undefined &&
                                data[this.field] !== null &&
                                (typeof data[this.field] !== "number" &&
                                    typeof data[this.field] !== "string" ||
                                    isNaN(Number(data[this.field])))
                            ) {
                                return this.message;
                            }
                            break;
                    }
                }
            },
        };
    }
}