import { Logger } from '@nestjs/common';
import type { ServiceBusClient, ServiceBusReceiver } from '@azure/service-bus';
import { EventPublisher } from '../../application/ports';

export class ServiceBusPublisher implements EventPublisher {
  constructor(private readonly client: ServiceBusClient) {}

  async publish(queue: string, body: Record<string, unknown>): Promise<void> {
    const sender = this.client.createSender(queue);
    try {
      await sender.sendMessages({ body, contentType: 'application/json' });
    } finally {
      await sender.close();
    }
  }
}

export class LogOnlyPublisher implements EventPublisher {
  readonly sent: { queue: string; body: Record<string, unknown> }[] = [];
  private readonly log = new Logger('Eventos');

  async publish(queue: string, body: Record<string, unknown>): Promise<void> {
    this.sent.push({ queue, body });
    this.log.warn(`SERVICEBUS_CONNECTION ausente; evento não enviado para ${queue}`);
  }
}

/** Assina uma fila e entrega cada mensagem ao handler; erro devolve a mensagem para nova tentativa. */
export function subscribe(
  client: ServiceBusClient,
  queue: string,
  handler: (body: any) => Promise<unknown>,
): ServiceBusReceiver {
  const log = new Logger(`Fila ${queue}`);
  const receiver = client.createReceiver(queue);
  receiver.subscribe({
    processMessage: async (message) => {
      const body = typeof message.body === 'string' ? JSON.parse(message.body) : message.body;
      await handler(body);
    },
    processError: async (args) => {
      log.error(`erro ao consumir: ${args.error.message}`);
    },
  });
  return receiver;
}
