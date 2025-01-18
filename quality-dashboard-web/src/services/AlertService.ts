import type { EventAlert } from "@/types/EventAlert";

let callback: any;

export default class ReportService {
  //
  public static async onEvent(newCallback: any): Promise<any> {
    callback = newCallback;
  }

  public static async send(event: EventAlert): Promise<void> {
    if (callback) {
      callback(event);
    }
  }
}
