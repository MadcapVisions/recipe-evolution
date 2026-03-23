export type JsonObjectResponseFormat = { type: "json_object" };

export type JsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
};

export type AIResponseFormat = JsonObjectResponseFormat | JsonSchemaResponseFormat;

export function getDowngradedResponseFormat(format?: AIResponseFormat): JsonObjectResponseFormat | undefined {
  if (!format) {
    return undefined;
  }
  return format.type === "json_schema" ? { type: "json_object" } : format;
}

export function shouldDowngradeStructuredOutputError(error: unknown, format?: AIResponseFormat) {
  if (!format || format.type !== "json_schema") {
    return false;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("response_format") ||
    message.includes("json_schema") ||
    message.includes("structured output") ||
    message.includes("not support") ||
    message.includes("unsupported") ||
    message.includes("invalid schema")
  );
}
