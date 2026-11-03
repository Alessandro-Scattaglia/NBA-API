import app from "./app.js";
import { scheduled } from "./scheduled.js";

export { scheduled };

export default {
  fetch: app.fetch,
  scheduled
};
