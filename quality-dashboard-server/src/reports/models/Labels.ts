import { v4 as uuidv4 } from "uuid";

export class Label {
  public id: string;
  public name: string;
  public value: string;

  constructor() {
    this.id = uuidv4();
  }
}
