import { cardGenerationProcessModel } from "../db/models/card-generation-process.model.ts";
import { DeckCardGeneratorService } from "../ai/deck-card-generator-service.ts";
import { UuidGeneratorAdapter } from "../adapters/uuid-generator-adapter.ts";
import amqplib, { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { flashcardModel } from "../db/models/flashcard.model.ts";

export type DeckGenerationTone = "concise" | "standard" | "deep";

interface DeckGenerationPayload {
  jobId: string;
  processId: string;
  deckId: string;
  deckName: string;
  deckSubject: string;
  userId: string;
  content: string;
  goal?: string;
  tone?: DeckGenerationTone;
  attempts: number;
}

class DeckGenerationQueue {
  private readonly queueName = "deck-generation";
  private readonly connectionString = process.env.RABBITMQ_URL ?? "amqp://rabbitmq:5672";
  private connection?: ChannelModel;
  private channel?: Channel;
  private isConsuming = false;
  private readonly cardGenerator = new DeckCardGeneratorService();

  async init() {
    if (this.channel) {
      return;
    }

    this.connection = await amqplib.connect(this.connectionString);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(this.queueName, { durable: true });
  }

  async enqueue(input: Omit<DeckGenerationPayload, "jobId" | "attempts">) {
    if (!this.channel) {
      await this.init();
    }

    if (!this.channel) {
      throw new Error("RabbitMQ channel is not available");
    }

    const jobId = UuidGeneratorAdapter.generate();
    const payload: DeckGenerationPayload = { ...input, jobId, attempts: 0 };

    this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    if (!this.isConsuming) {
      await this.startConsumer();
    }

    return jobId;
  }

  private async startConsumer() {
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

  private async handleMessage(message: ConsumeMessage) {
    if (!this.channel) {
      return;
    }

    let payload: DeckGenerationPayload | null = null;

    try {
      payload = JSON.parse(message.content.toString()) as DeckGenerationPayload;

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

      if (payload.processId) {
        try {
          await cardGenerationProcessModel.deleteById(payload.processId);
        } catch (cleanupError) {
          console.error("Failed to remove card generation process", cleanupError);
        }
      }

      this.channel.ack(message);
    } catch (error) {
      console.error("Failed to process deck generation job", error);
      const attempts = payload?.attempts ?? 0;

      if (payload && attempts < 2) {
        const retryPayload: DeckGenerationPayload = {
          ...payload,
          attempts: attempts + 1,
        };

        this.channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(retryPayload)), {
          persistent: true,
        });
        this.channel.ack(message);
        return;
      }

      if (payload?.processId) {
        try {
          await cardGenerationProcessModel.deleteById(payload.processId);
        } catch (cleanupError) {
          console.error("Failed to remove card generation process", cleanupError);
        }
      }

      this.channel.ack(message);
    }
  }
}

export const deckGenerationQueue = new DeckGenerationQueue();
