import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface AgentLog {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
}

export interface Checkpoint {
  schemaVersion: 1;
  timestamp: string;
  intent: string;
  codeDiff: string;
  files: string[];
  notes?: string;
  unresolved: string[];
  agentLogs: AgentLog[];
}

export const checkpointSchema: JSONSchemaType<Checkpoint> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'timestamp', 'intent', 'codeDiff', 'files', 'unresolved', 'agentLogs'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    timestamp: { type: 'string', format: 'date-time' },
    intent: { type: 'string', minLength: 1 },
    codeDiff: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', nullable: true },
    unresolved: { type: 'array', items: { type: 'string' } },
    agentLogs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
          content: { type: 'string' },
          timestamp: { type: 'string', nullable: true }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
export const validateCheckpoint: ValidateFunction<Checkpoint> = ajv.compile(checkpointSchema);

export function assertValidCheckpoint(value: unknown): asserts value is Checkpoint {
  if (!validateCheckpoint(value)) {
    const details = (validateCheckpoint.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`Invalid checkpoint: ${details}`);
  }
}
