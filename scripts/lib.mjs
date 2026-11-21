// Shared checks for the Famulor marketplace. Node 20+, no dependencies:
// contributors run exactly what CI runs, and nothing is installed from npm.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const CONNECTOR_SCHEMA = readJson(join(ROOT, "schemas/connector.schema.json"));
const LISTING_SCHEMA = readJson(join(ROOT, "schemas/automation-listing.schema.json"));

/** Same limits the Famulor app enforces when it creates a tool or imports an automation. */
export const LIMITS = {
    logoBytes: 100 * 1024,
    automationBytes: 512 * 1024,
    automationNodes: 200,
    automationEdges: 400,
    automationNameChars: 200,
    automationDescriptionChars: 2000,
    toolDescriptionChars: 1024,
    timeoutMsMax: 30000,
    enumValues: 50,
    enumValueChars: 100,
};

const FUNCTION_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const PLACEHOLDER = /\{\{(\w+)\}\}/g;
const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|x-api-key|api-key|apikey|x-auth-token|x-access-token|token)$/i;

const MCP_TEMPLATE_KEYS = new Set(["type", "url", "headers", "oauth_mcp_url", "name", "description"]);
const MCP_OAUTH_TEMPLATE_KEYS = new Set(["type", "mcp_url", "name", "description"]);
const API_TEMPLATE_KEYS = new Set([
    "type",
    "name",
    "description",
    "method",
    "url",
    "headers",
    "parameters",
    "static_values",
    "response_mapping",
    "timeout_ms",
    "async",
    "filler_phrase",
    "speak_after",
]);
const API_PARAMETER_KEYS = new Set(["name", "type", "description", "required", "source", "location", "enum"]);

/** Text aimed at the assistant instead of describing the tool. Reviewers look at every hit. */
const INSTRUCTION_PATTERNS = [
    /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|messages|rules)/i,
    /disregard (all |any |the )?(previous|prior|above|earlier|system)/i,
    /\bsystem prompt\b/i,
    /\byou are now\b/i,
    /<\/?(system|assistant|instructions?)>/i,
    /\bdo not (tell|inform) the (user|caller|customer)\b/i,
];

const SECRET_PATTERNS = [
    { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
    { name: "bearer token", re: /\bBearer\s+(?!\{\{)[A-Za-z0-9._~+/-]{20,}/ },
    { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
    { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
    { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}/ },
    { name: "Stripe key", re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/ },
    { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const PRIVATE_WEBHOOK_HOSTS = [/hooks\.zapier\.com/i, /hook\.[a-z0-9]+\.make\.com/i, /\/webhook(-test)?\/[0-9a-f-]{20,}/i];
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

/** Folders that hold one entry each, e.g. connectors/<slug>. */
export function entryDirs(base) {
    const dir = join(ROOT, base);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => join(dir, d.name))
        .sort();
}

export function rel(path) {
    return relative(ROOT, path) || ".";
}

// ── Minimal JSON Schema (draft-07 subset used by schemas/*.json) ────────────

function typeOf(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (Number.isInteger(value)) return "integer";
    return typeof value;
}

function typeMatches(expected, value) {
    const actual = typeOf(value);
    return expected === actual || (expected === "number" && actual === "integer");
}

export function validateSchema(schema, value, at = "") {
    const errors = [];
    const where = at || "(root)";
    if (schema.type) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        if (!types.some((t) => typeMatches(t, value))) {
            return [`${where}: must be ${types.join(" or ")}`];
        }
    }
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${where}: must be one of ${schema.enum.join(", ")}`);
    }
    if (typeof value === "string") {
        if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${where}: must have at least ${schema.minLength} characters`);
        if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${where}: must have at most ${schema.maxLength} characters`);
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: must match ${schema.pattern}`);
    }
    if (typeof value === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${where}: must be at least ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${where}: must be at most ${schema.maximum}`);
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where}: must have at least ${schema.minItems} items`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${where}: must have at most ${schema.maxItems} items`);
        if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(`${where}: items must be unique`);
        if (schema.items) value.forEach((item, i) => errors.push(...validateSchema(schema.items, item, `${at}[${i}]`)));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const key of schema.required ?? []) {
            if (!(key in value)) errors.push(`${at ? `${at}.` : ""}${key}: is required`);
        }
        for (const [key, child] of Object.entries(value)) {
            const childSchema = schema.properties?.[key];
            if (childSchema) errors.push(...validateSchema(childSchema, child, at ? `${at}.${key}` : key));
            else if (schema.additionalProperties === false) errors.push(`${at ? `${at}.` : ""}${key}: is not a known field`);
        }
    }
    return errors;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function placeholdersIn(value) {
    const keys = new Set();
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    for (const match of text.matchAll(PLACEHOLDER)) keys.add(match[1]);
    return keys;
}

function hostAllowed(url, network) {
    let host;
    try {
        // A placeholder in the host (https://{{subdomain}}.example.com) must match a wildcard entry.
        host = new URL(url.replace(PLACEHOLDER, "placeholder")).hostname.toLowerCase();
    } catch {
        return { ok: false, reason: "is not a valid URL" };
    }
    const ok = network.some((entry) => {
        if (entry.startsWith("*.")) return host.endsWith(entry.slice(1)) && host !== entry.slice(2);
        return host === entry;
    });
    return ok ? { ok: true } : { ok: false, reason: `calls ${host}, which is missing from network` };
}

function checkHttpsUrl(errors, field, url, network) {
    if (typeof url !== "string" || !url.trim()) {
        errors.push(`${field}: is required`);
        return;
    }
    if (!url.startsWith("https://")) {
        errors.push(`${field}: must start with https://`);
        return;
    }
    const host = hostAllowed(url, network);
    if (!host.ok) errors.push(`${field}: ${host.reason}`);
}

function checkInstructionText(errors, field, text) {
    if (typeof text !== "string") return;
    for (const pattern of INSTRUCTION_PATTERNS) {
        if (pattern.test(text)) {
            errors.push(`${field}: reads like an instruction to the assistant (${pattern}). Describe what the tool does instead.`);
            return;
        }
    }
}

function checkSecrets(errors, field, text) {
    for (const { name, re } of SECRET_PATTERNS) {
        if (re.test(text)) errors.push(`${field}: contains what looks like a ${name}. Never commit credentials; use a config_schema field.`);
    }
}

function checkReadme(errors, dir, headings) {
    const path = join(dir, "README.md");
    if (!existsSync(path)) {
        errors.push("README.md: is required");
        return;
    }
    const text = readFileSync(path, "utf8");
    for (const heading of headings) {
        if (!new RegExp(`^## ${heading}\\s*$`, "m").test(text)) errors.push(`README.md: needs a "## ${heading}" section`);
    }
    checkInstructionText(errors, "README.md", text);
    checkSecrets(errors, "README.md", text);
}

function checkLogo(errors, dir, logo) {
    if (typeof logo !== "string") return;
    const path = join(dir, logo);
    if (!existsSync(path)) {
        errors.push(`logo: ${logo} is missing from the folder`);
        return;
    }
    const size = statSync(path).size;
    if (size > LIMITS.logoBytes) errors.push(`logo: ${logo} is ${Math.ceil(size / 1024)} KB; the limit is 100 KB`);
    const bytes = readFileSync(path);
    if (logo.endsWith(".png")) {
        const signature = bytes.subarray(0, 8).toString("hex");
        if (signature !== "89504e470d0a1a0a") errors.push(`logo: ${logo} is not a PNG file`);
        else if (bytes.length >= 24) {
            const width = bytes.readUInt32BE(16);
            const height = bytes.readUInt32BE(20);
            if (width !== height) errors.push(`logo: ${logo} is ${width}×${height}; use a square image`);
            if (width < 128) errors.push(`logo: ${logo} is ${width} px wide; use at least 128 px`);
        }
        return;
    }
    const svg = bytes.toString("utf8");
    if (!/<svg[\s>]/i.test(svg)) errors.push(`logo: ${logo} is not an SVG file`);
    if (/<script/i.test(svg)) errors.push(`logo: ${logo} must not contain <script>`);
    if (/\son[a-z]+\s*=/i.test(svg)) errors.push(`logo: ${logo} must not contain event handlers such as onload=`);
    if (/<foreignObject/i.test(svg)) errors.push(`logo: ${logo} must not contain <foreignObject>`);
    if (/(xlink:)?href\s*=\s*["']\s*(https?:|data:text|javascript:)/i.test(svg)) errors.push(`logo: ${logo} must not load external files or scripts`);
}

// ── Connector ───────────────────────────────────────────────────────────────

function checkConfigSchema(errors, fields) {
    const keys = new Map();
    for (const [i, field] of fields.entries()) {
        if (keys.has(field.key)) errors.push(`config_schema[${i}].key: "${field.key}" is used twice`);
        keys.set(field.key, field);
        if (field.type === "select" && !field.options) errors.push(`config_schema[${i}]: a select field needs options`);
        if (field.type !== "select" && field.options) errors.push(`config_schema[${i}].options: only select fields have options`);
        if (field.default_value !== undefined && field.options && !field.options.includes(String(field.default_value))) {
            errors.push(`config_schema[${i}].default_value: must be one of the options`);
        }
        if (field.type === "password" && field.default_value !== undefined) {
            errors.push(`config_schema[${i}].default_value: a password field cannot have a default`);
        }
    }
    return keys;
}

function checkPlaceholders(errors, template, fields) {
    const used = placeholdersIn(template);
    for (const key of used) {
        const field = fields.get(key);
        if (!field) {
            errors.push(`template: {{${key}}} has no config_schema field with key "${key}"`);
        } else if (!field.required && field.default_value === undefined) {
            errors.push(`template: {{${key}}} uses an optional field without default_value; an empty value would stay as the literal placeholder`);
        }
    }
    for (const [key, field] of fields) {
        if (!used.has(key)) errors.push(`config_schema: field "${key}" is never used in template`);
        if (field.type === "password") {
            for (const urlField of ["url", "mcp_url", "oauth_mcp_url"]) {
                if (placeholdersIn(template[urlField]).has(key)) {
                    errors.push(`template.${urlField}: puts the secret field "${key}" into the URL; send it in a header instead`);
                }
            }
        }
    }
}

function checkHeaders(errors, field, headers) {
    if (headers === undefined) return [];
    if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        errors.push(`${field}: must be an object of header names and values`);
        return [];
    }
    const entries = Object.entries(headers).filter(([, value]) => !(typeof value === "string" && value.trim() === ""));
    for (const [name, value] of entries) {
        if (typeof value !== "string") errors.push(`${field}.${name}: must be text`);
        else if (SENSITIVE_HEADER.test(name) && placeholdersIn(value).size === 0) {
            errors.push(`${field}.${name}: must take its value from a config_schema field ({{key}}); never commit a key`);
        }
    }
    return entries;
}

function checkMcpTemplate(errors, template, network, fields) {
    if (template.type === "mcp_oauth") {
        for (const key of Object.keys(template)) if (!MCP_OAUTH_TEMPLATE_KEYS.has(key)) errors.push(`template.${key}: is not a known field for type mcp_oauth`);
        checkHttpsUrl(errors, "template.mcp_url", template.mcp_url, network);
        if (fields.size > 0) errors.push("config_schema: must be empty for type mcp_oauth; users sign in instead of filling a form");
    } else if (template.type === "mcp") {
        for (const key of Object.keys(template)) if (!MCP_TEMPLATE_KEYS.has(key)) errors.push(`template.${key}: is not a known field for type mcp`);
        checkHttpsUrl(errors, "template.url", template.url, network);
        if (template.oauth_mcp_url !== undefined) checkHttpsUrl(errors, "template.oauth_mcp_url", template.oauth_mcp_url, network);
        const headers = checkHeaders(errors, "template.headers", template.headers);
        if (headers.length > 1) errors.push("template.headers: an MCP connector can send one header; Famulor stores a single auth header");
    } else {
        errors.push('template.type: must be "mcp" or "mcp_oauth" for kind mcp');
    }
    if (template.name !== undefined && (typeof template.name !== "string" || !FUNCTION_NAME.test(template.name))) {
        errors.push(`template.name: must match ${FUNCTION_NAME}`);
    }
    if (template.description !== undefined) {
        if (typeof template.description !== "string" || template.description.length > LIMITS.toolDescriptionChars) {
            errors.push(`template.description: must be text of at most ${LIMITS.toolDescriptionChars} characters`);
        }
        checkInstructionText(errors, "template.description", template.description);
    }
}

function checkApiTemplate(errors, template, network) {
    if (template.type !== "api") errors.push('template.type: must be "api" for kind api_tool');
    for (const key of Object.keys(template)) if (!API_TEMPLATE_KEYS.has(key)) errors.push(`template.${key}: is not a known field for type api`);
    if (typeof template.name !== "string" || !FUNCTION_NAME.test(template.name)) {
        errors.push(`template.name: is required and must match ${FUNCTION_NAME}; it becomes the function name the assistant calls`);
    }
    if (typeof template.description !== "string" || template.description.trim().length < 20 || template.description.length > LIMITS.toolDescriptionChars) {
        errors.push(`template.description: is required, 20 to ${LIMITS.toolDescriptionChars} characters, and tells the assistant when to call the tool`);
    } else {
        checkInstructionText(errors, "template.description", template.description);
    }
    const method = template.method ?? "POST";
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) errors.push("template.method: must be GET, POST, PUT, PATCH or DELETE");
    checkHttpsUrl(errors, "template.url", template.url, network);
    checkHeaders(errors, "template.headers", template.headers);

    const parameters = template.parameters ?? [];
    if (!Array.isArray(parameters)) {
        errors.push("template.parameters: must be a list");
    } else {
        const names = new Set();
        for (const [i, parameter] of parameters.entries()) {
            const at = `template.parameters[${i}]`;
            if (!parameter || typeof parameter !== "object") {
                errors.push(`${at}: must be an object`);
                continue;
            }
            for (const key of Object.keys(parameter)) if (!API_PARAMETER_KEYS.has(key)) errors.push(`${at}.${key}: is not a known field`);
            if (typeof parameter.name !== "string" || !FUNCTION_NAME.test(parameter.name)) errors.push(`${at}.name: must match ${FUNCTION_NAME}`);
            else if (names.has(parameter.name)) errors.push(`${at}.name: "${parameter.name}" is used twice`);
            else names.add(parameter.name);
            const type = parameter.type ?? "string";
            if (!["string", "number", "boolean"].includes(type)) errors.push(`${at}.type: must be string, number or boolean`);
            const source = parameter.source ?? "llm";
            if (!["llm", "static"].includes(source)) errors.push(`${at}.source: must be llm or static`);
            if (parameter.location !== undefined && !["query", "body"].includes(parameter.location)) errors.push(`${at}.location: must be query or body`);
            if (parameter.required !== undefined && typeof parameter.required !== "boolean") errors.push(`${at}.required: must be true or false`);
            if (source === "llm") {
                if (typeof parameter.description !== "string" || parameter.description.trim().length < 3) {
                    errors.push(`${at}.description: tells the assistant what to fill in; it is required for source llm`);
                } else {
                    checkInstructionText(errors, `${at}.description`, parameter.description);
                }
            } else if (!template.static_values || !(parameter.name in template.static_values)) {
                errors.push(`${at}: a static parameter needs a value in template.static_values`);
            }
            if (parameter.enum !== undefined) {
                if (type !== "string") errors.push(`${at}.enum: only string parameters can have choices`);
                else if (
                    !Array.isArray(parameter.enum) ||
                    parameter.enum.length === 0 ||
                    parameter.enum.length > LIMITS.enumValues ||
                    parameter.enum.some((v) => typeof v !== "string" || !v || v.length > LIMITS.enumValueChars)
                ) {
                    errors.push(`${at}.enum: must list 1 to ${LIMITS.enumValues} texts of at most ${LIMITS.enumValueChars} characters`);
                }
            }
        }
    }
    if (template.timeout_ms !== undefined && (!Number.isInteger(template.timeout_ms) || template.timeout_ms < 1000 || template.timeout_ms > LIMITS.timeoutMsMax)) {
        errors.push(`template.timeout_ms: must be a whole number from 1000 to ${LIMITS.timeoutMsMax}`);
    }
    for (const flag of ["async", "speak_after"]) {
        if (template[flag] !== undefined && typeof template[flag] !== "boolean") errors.push(`template.${flag}: must be true or false`);
    }
    if (template.filler_phrase !== undefined && (typeof template.filler_phrase !== "string" || template.filler_phrase.length > 200)) {
        errors.push("template.filler_phrase: must be text of at most 200 characters");
    }
    for (const mapField of ["static_values", "response_mapping"]) {
        const value = template[mapField];
        if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) errors.push(`template.${mapField}: must be an object`);
    }
}

/** Returns { entry, errors } for connectors/<slug> or examples/connectors/<slug>. */
export function checkConnector(dir) {
    const errors = [];
    const path = join(dir, "connector.json");
    if (!existsSync(path)) return { entry: null, errors: ["connector.json: is required"] };
    let entry;
    try {
        entry = readJson(path);
    } catch (error) {
        return { entry: null, errors: [`connector.json: is not valid JSON (${error.message})`] };
    }
    errors.push(...validateSchema(CONNECTOR_SCHEMA, entry).map((e) => `connector.json ${e}`));
    if (entry.slug !== basename(dir)) errors.push(`connector.json slug: "${entry.slug}" must equal the folder name "${basename(dir)}"`);

    const raw = readFileSync(path, "utf8");
    checkSecrets(errors, "connector.json", raw);
    if (/http:\/\//i.test(JSON.stringify(entry.template ?? {}))) errors.push("template: must not use http://; use https://");
    for (const field of ["description", "setup_instructions"]) checkInstructionText(errors, field, entry[field]);

    const network = Array.isArray(entry.network) ? entry.network : [];
    const fields = Array.isArray(entry.config_schema) ? checkConfigSchema(errors, entry.config_schema) : new Map();
    const template = entry.template && typeof entry.template === "object" && !Array.isArray(entry.template) ? entry.template : null;
    if (template) {
        if (entry.kind === "mcp") checkMcpTemplate(errors, template, network, fields);
        if (entry.kind === "api_tool") checkApiTemplate(errors, template, network);
        checkPlaceholders(errors, template, fields);
    }
    checkLogo(errors, dir, entry.logo);
    checkReadme(errors, dir, ["What it does", "Setup", "Data and privacy"]);
    return { entry, errors };
}

// ── Automation template ─────────────────────────────────────────────────────

export const AUTOMATION_FILE = "automation.famulor-automation.json";

function checkPortableAutomation(errors, path) {
    const raw = readFileSync(path, "utf8");
    if (Buffer.byteLength(raw) > LIMITS.automationBytes) errors.push(`${AUTOMATION_FILE}: is larger than 512 KB`);
    let file;
    try {
        file = JSON.parse(raw);
    } catch (error) {
        errors.push(`${AUTOMATION_FILE}: is not valid JSON (${error.message})`);
        return null;
    }
    if (file.format !== "famulor.automation") errors.push(`${AUTOMATION_FILE} format: must be "famulor.automation". Export the automation from the app.`);
    if (file.version !== 1) errors.push(`${AUTOMATION_FILE} version: must be 1`);
    if (typeof file.name !== "string" || !file.name.trim() || file.name.length > LIMITS.automationNameChars) {
        errors.push(`${AUTOMATION_FILE} name: is required, at most ${LIMITS.automationNameChars} characters`);
    }
    if (file.description !== null && file.description !== undefined && (typeof file.description !== "string" || file.description.length > LIMITS.automationDescriptionChars)) {
        errors.push(`${AUTOMATION_FILE} description: must be text of at most ${LIMITS.automationDescriptionChars} characters`);
    }
    if (file.tags !== undefined && (!Array.isArray(file.tags) || file.tags.some((t) => typeof t !== "string"))) errors.push(`${AUTOMATION_FILE} tags: must be a list of texts`);
    if (!file.trigger || typeof file.trigger.type !== "string") errors.push(`${AUTOMATION_FILE} trigger.type: is required`);

    const nodes = Array.isArray(file.graph?.nodes) ? file.graph.nodes : null;
    const edges = Array.isArray(file.graph?.edges) ? file.graph.edges : null;
    if (!nodes || !edges) {
        errors.push(`${AUTOMATION_FILE} graph: needs nodes and edges lists`);
        return file;
    }
    if (nodes.length > LIMITS.automationNodes) errors.push(`${AUTOMATION_FILE} graph.nodes: at most ${LIMITS.automationNodes} steps`);
    if (edges.length > LIMITS.automationEdges) errors.push(`${AUTOMATION_FILE} graph.edges: at most ${LIMITS.automationEdges} connections`);
    const ids = new Set();
    let triggers = 0;
    for (const [i, node] of nodes.entries()) {
        const at = `${AUTOMATION_FILE} graph.nodes[${i}]`;
        if (!node || typeof node.id !== "string" || !node.id) {
            errors.push(`${at}.id: is required`);
            continue;
        }
        if (ids.has(node.id)) errors.push(`${at}.id: "${node.id}" is used twice`);
        ids.add(node.id);
        if (!["trigger", "action", "condition", "loop"].includes(node.type)) errors.push(`${at}.type: must be trigger, action, condition or loop`);
        if (node.type === "trigger") triggers += 1;
        if (node.type === "action" && typeof node.data?.action !== "string") errors.push(`${at}.data.action: is required for an action step`);
        if (node.data?.action === "milian.run_mission") errors.push(`${at}: Milian missions cannot be shared in a template`);
    }
    if (triggers !== 1) errors.push(`${AUTOMATION_FILE} graph: needs exactly one trigger step (found ${triggers})`);
    for (const [i, edge] of edges.entries()) {
        if (!ids.has(edge?.source) || !ids.has(edge?.target)) errors.push(`${AUTOMATION_FILE} graph.edges[${i}]: connects a step that does not exist`);
    }

    checkSecrets(errors, AUTOMATION_FILE, raw);
    for (const host of PRIVATE_WEBHOOK_HOSTS) {
        if (host.test(raw)) errors.push(`${AUTOMATION_FILE}: contains a private webhook URL; use https://YOUR_WEBHOOK_URL`);
    }
    if (UUID.test(raw)) errors.push(`${AUTOMATION_FILE}: contains an id from your workspace; use YOUR_ID or leave the field empty`);
    return file;
}

/** Returns { entry, errors } for automations/<slug> or examples/automations/<slug>. */
export function checkAutomation(dir, knownConnectors = new Set()) {
    const errors = [];
    const listingPath = join(dir, "listing.json");
    let listing = null;
    if (!existsSync(listingPath)) errors.push("listing.json: is required");
    else {
        try {
            listing = readJson(listingPath);
            errors.push(...validateSchema(LISTING_SCHEMA, listing).map((e) => `listing.json ${e}`));
            if (listing.slug !== basename(dir)) errors.push(`listing.json slug: "${listing.slug}" must equal the folder name "${basename(dir)}"`);
            for (const field of ["about", "setup_hint"]) checkInstructionText(errors, `listing.json ${field}`, listing[field]);
            for (const slug of listing.connectors ?? []) {
                if (!knownConnectors.has(slug)) errors.push(`listing.json connectors: "${slug}" is not a connector in this repository`);
            }
        } catch (error) {
            errors.push(`listing.json: is not valid JSON (${error.message})`);
        }
    }
    const filePath = join(dir, AUTOMATION_FILE);
    let file = null;
    if (!existsSync(filePath)) errors.push(`${AUTOMATION_FILE}: is required. Export the automation from the app and rename the file.`);
    else file = checkPortableAutomation(errors, filePath);
    checkReadme(errors, dir, ["What it does", "Setup"]);
    return { entry: listing && file ? { listing, file } : null, errors };
}

// ── Catalog ─────────────────────────────────────────────────────────────────

/** The generated index of listed entries. Examples are not listed. */
export function buildCatalog() {
    const connectors = entryDirs("connectors")
        .map((dir) => ({ dir, entry: readJsonSafe(join(dir, "connector.json")) }))
        .filter(({ entry }) => entry)
        .map(({ dir, entry }) => ({
            slug: entry.slug,
            name: entry.name,
            version: entry.version,
            kind: entry.kind,
            category: entry.category,
            publisher: entry.publisher?.name,
            path: rel(dir),
        }));
    const automations = entryDirs("automations")
        .map((dir) => ({ dir, listing: readJsonSafe(join(dir, "listing.json")), file: readJsonSafe(join(dir, AUTOMATION_FILE)) }))
        .filter(({ listing, file }) => listing && file)
        .map(({ dir, listing, file }) => ({
            slug: listing.slug,
            name: file.name,
            version: listing.version,
            category: listing.category,
            trigger: file.trigger?.type ?? null,
            connectors: listing.connectors ?? [],
            path: rel(dir),
        }));
    return { version: 1, connectors, automations };
}

function readJsonSafe(path) {
    try {
        return readJson(path);
    } catch {
        return null;
    }
}

export function catalogText() {
    return `${JSON.stringify(buildCatalog(), null, 2)}\n`;
}
