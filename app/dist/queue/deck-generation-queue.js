import amqplib from "amqplib";
import { DeckCardGeneratorService } from "../ai/deck-card-generator.service.js";
import { UuidGeneratorAdapter } from "../adapters/uuid-generator-adapter.js";
import { flashcardModel } from "../db/models/flashcard.model.js";
class DeckGenerationQueue {
    constructor() {
        this.queueName = "deck-generation";
        this.connectionString = process.env.RABBITMQ_URL ?? "amqp://rabbitmq:5672";
        this.isConsuming = false;
        this.statuses = new Map();
        this.cardGenerator = new DeckCardGeneratorService();
    }
    async init() {
        if (this.channel) {
            return;
        }
        this.connection = await amqplib.connect(this.connectionString);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(this.queueName, { durable: true });
    }
    async enqueue(input) {
        if (!this.channel) {
            await this.init();
        }
        if (!this.channel) {
            throw new Error("RabbitMQ channel is not available");
        }
        const jobId = UuidGeneratorAdapter.generate();
        const payload = { ...input, jobId };
        this.statuses.set(jobId, {
            state: "queued",
            message: "Conteúdo enviado para a fila de geração.",
        });
        this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
        });
        if (!this.isConsuming) {
            await this.startConsumer();
        }
        return jobId;
    }
    getStatus(jobId) {
        return this.statuses.get(jobId);
    }
    async startConsumer() {
        if (!this.channel) {
            await this.init();
        }
        if (!this.channel || this.isConsuming) {
            return;
        }
        this.isConsuming = true;
        await this.channel.consume(this.queueName, async (message) => {
            if (!message) {
                return;
            }
            await this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        if (!this.channel) {
            return;
        }
        let payload = null;
        try {
            payload = JSON.parse(message.content.toString());
            this.statuses.set(payload.jobId, {
                state: "processing",
                message: "Processando geração na fila RabbitMQ...",
            });
            const cards = await this.cardGenerator.generateCards({
                deckName: payload.deckName,
                deckSubject: payload.deckSubject,
                content: payload.content,
                goal: payload.goal,
                tone: payload.tone,
            });
            for (const suggestion of cards.cards) {
                await flashcardModel.insert({
                    fields: [
                        { key: "id", value: UuidGeneratorAdapter.generate() },
                        { key: "question", value: suggestion.question },
                        { key: "answer", value: suggestion.answer },
                        { key: "user_id", value: payload.userId },
                        { key: "deck_id", value: payload.deckId },
                        { key: "status", value: "new" },
                        { key: "review_count", value: 0 },
                        { key: "last_review_date", value: null },
                        { key: "difficulty", value: suggestion.difficulty ?? "medium" },
                        { key: "tags", value: suggestion.tags ?? [] },
                    ],
                });
            }
            this.statuses.set(payload.jobId, {
                state: "completed",
                message: "Cartas geradas e adicionadas ao baralho.",
                cards: cards.cards.map((card) => ({
                    question: card.question,
                    answer: card.answer,
                })),
            });
            this.channel.ack(message);
        }
        catch (error) {
            console.error("Failed to process deck generation job", error);
            const jobId = payload?.jobId ?? message.properties.messageId ?? "unknown";
            this.statuses.set(jobId, {
                state: "failed",
                message: "Falha ao processar a geração de flashcards.",
            });
            this.channel.nack(message, false, false);
        }
    }
}
export const deckGenerationQueue = new DeckGenerationQueue();
