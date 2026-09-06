import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface AgentLog {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
}

export interface EntireCheckpointReference {
  source: 'entire-cli';
  checkpointId: string;
  capturedAt: string;
  branch?: string;
  sessionId?: string;
  message?: string;
}

export interface Checkpoint {
  schemaVersion: 1 | 2;
  timestamp: string;
  intent: string;
  codeDiff: string;
  files: string[];
  notes?: string;
  unresolved: string[];
  agentLogs: AgentLog[];
  agentSteps?: string[];
  assumptions?: string[];
  failures?: string[];
  entire?: EntireCheckpointReference;
}

export const checkpointSchema: JSONSchemaType<Checkpoint> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'timestamp', 'intent', 'codeDiff', 'files', 'unresolved', 'agentLogs'],
  properties: {
    schemaVersion: { type: 'integer', enum: [1, 2] },
    timestamp: { type: 'string', format: 'date-time' },
    intent: { type: 'string', minLength: 1 },
    codeDiff: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', nullable: true },
    unresolved: { type: 'array', items: { type: 'string' } },
    agentSteps: { type: 'array', items: { type: 'string' }, nullable: true },
    assumptions: { type: 'array', items: { type: 'string' }, nullable: true },
    failures: { type: 'array', items: { type: 'string' }, nullable: true },
    entire: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['source', 'checkpointId', 'capturedAt'],
      properties: {
        source: { type: 'string', const: 'entire-cli' },
        checkpointId: { type: 'string', minLength: 1 },
        capturedAt: { type: 'string', format: 'date-time' },
        branch: { type: 'string', nullable: true },
        sessionId: { type: 'string', nullable: true },
        message: { type: 'string', nullable: true }
      }
    },
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
