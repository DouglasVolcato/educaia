import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, } from "@langchain/core/messages";
export var MessageSenderEnum;
(function (MessageSenderEnum) {
    MessageSenderEnum["USER"] = "user";
    MessageSenderEnum["ASSISTANT"] = "assistant";
    MessageSenderEnum["SYSTEM"] = "system";
})(MessageSenderEnum || (MessageSenderEnum = {}));
export class LlmAgent {
    constructor() {
        this.tools = [];
        this.messages = [];
        this.llm = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_KEY,
            model: process.env.OPENAI_MODEL
        });
    }
    addTool(input) {
        this.tools.push(tool(input.callback, {
            name: input.name,
            schema: input.schema,
            description: input.description,
        }));
    }
    addMessage(message) {
        if (message.role === MessageSenderEnum.USER) {
            this.messages.push(new HumanMessage(message.content));
        }
        else if (message.role === MessageSenderEnum.SYSTEM) {
            this.messages.push(new SystemMessage(message.content));
        }
        else {
            this.messages.push(new AIMessage(message.content));
        }
    }
    async getResponse() {
        const llmWithTools = this.llm.bindTools(this.tools);
        let response = await llmWithTools.invoke(this.messages);
        this.messages.push(response);
        if (response.tool_calls && response.tool_calls.length > 0) {
            let toolMessage = null;
            for (const call of response.tool_calls) {
                const selected = this.tools.find((t) => t.name === call.name);
                let result = "";
                try {
                    result = await selected.invoke(call.args);
                    toolMessage = this.getToolMessage(result);
                }
                catch (error) {
                    result = JSON.stringify({ error: error.message });
                }
                const content = typeof result === "string" ? result : JSON.stringify(result);
                this.messages.push(new ToolMessage({
                    name: call.name,
                    content,
                    tool_call_id: call.id || "",
                }));
            }
            this.messages.push(new SystemMessage(`Use apenas essas informações para formular sua resposta final ao usuário, sem chamar mais ferramentas.
           **ATENÇÃO**: Sua resposta **nunca** pode ficar em branco.`));
            if (toolMessage) {
                return {
                    response: toolMessage,
                    toolCalls: response.tool_calls.map((c) => ({
                        name: c.name,
                        input: c.args,
                    })),
                };
            }
            response = await llmWithTools.invoke(this.messages);
            this.messages.push(response);
        }
        let text = this.formatLlmResponse(response.text);
        if (!text || text.trim() === "") {
            text =
                "Desculpe, não consegui gerar uma resposta adequada. Você poderia reformular ou dar mais detalhes, por favor?";
        }
        const toolCalls = response.tool_calls?.map((c) => ({ name: c.name, input: c.args })) || [];
        return { response: text, toolCalls };
    }
    getToolMessage(result) {
        try {
            const toolMessage = JSON.parse(result);
            if ("return_message" in toolMessage &&
                typeof toolMessage.return_message === "string" &&
                toolMessage.return_message.length > 0) {
                return toolMessage.return_message;
            }
        }
        catch (error) { }
        return null;
    }
    formatLlmResponse(response) {
        const parts = response.split("</think>");
        return parts.length > 1 ? parts[1].trim() : response.trim();
    }
}
