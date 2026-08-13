// Keep the runtime implementation separate from the generated extension entry.
// This entry is intentionally tiny so future runtime modules can be added without
// changing manifest paths or the packaging workflow.
import "./config.js";
import "../remote-config.js";
import "./content-runtime.js";
