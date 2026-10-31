import { Span } from "@opentelemetry/sdk-trace";
import { OTelLogger, OTelTracer } from "../OTelContext";

const logger = OTelLogger().createModuleLogger("WebhookNotifier");

const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Delivery of quality gate webhook notifications.
 * Notifications are best-effort: any delivery error is logged and swallowed
 * so that ingest never fails because of the webhook.
 */
export class WebhookNotifier {
  //
  public static async notifyGateFailure(
    context: Span,
    webhookUrl: string,
    payload: unknown,
  ): Promise<void> {
    if (!webhookUrl || !webhookUrl.trim()) {
      return;
    }
    const span = OTelTracer().startSpan(
      "WebhookNotifier_notifyGateFailure",
      context,
    );
    try {
      const response = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn(
          `Webhook delivery returned HTTP ${response.status} for ${webhookUrl}`,
        );
      }
    } catch (err) {
      logger.error(`Webhook delivery failed: ${(err as Error).message}`);
    } finally {
      span.end();
    }
  }
}
