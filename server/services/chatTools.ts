/**
 * Function-calling tools for the direct-Gemini chat path.
 *
 * The ADK agents have had farm tools for a long time, but the direct-Gemini
 * fallback — which runs whenever ADK is unreachable — had none. It could only
 * talk about adding a task, so it would confirm additions that never happened.
 * These declarations give that path the same ability, backed by the same
 * user-scoped data service the app itself uses.
 */
import { Type, type FunctionDeclaration } from '@google/genai';
import { llm } from './llm/index.ts';
import type { GenerateOptions } from './llm/types.ts';
import { VALID_TASK_TYPES, createTask, listTasks, listZones, validateTask } from './farmData.ts';

/** Declarations sent to the model. Kept small — reads the model needs to act, plus the write. */
export const FARM_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_zones',
    description:
      "List this farmer's own zones with their id, name, crop type, planting date and area. " +
      'Call this before creating a task so you use a real zone_id.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'list_tasks',
    description: "List this farmer's scheduled tasks, newest schedule first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: "Optional filter, e.g. 'Pending' or 'Completed'. Omit for all tasks.",
        },
      },
    },
  },
  {
    name: 'create_task',
    description:
      "Add a task to the farmer's task list. It appears in their app immediately. " +
      'Only tell the farmer the task was added if this returns success: true; if it returns an ' +
      'error, tell them it could not be saved and say why.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        zone_id: {
          type: Type.INTEGER,
          description: "Id of one of this farmer's own zones, from list_zones. Never guess.",
        },
        task_type: {
          type: Type.STRING,
          description: `Must be one of: ${VALID_TASK_TYPES.join(', ')}.`,
        },
        scheduled_time: {
          type: Type.STRING,
          description: "When to do it, ISO 8601, e.g. '2026-03-14T08:00:00'.",
        },
        duration_minutes: { type: Type.INTEGER, description: 'Expected duration in minutes.' },
        reasoning: { type: Type.STRING, description: 'Why this task is needed.' },
      },
      required: ['zone_id', 'task_type', 'scheduled_time'],
    },
  },
];

/** Runs one tool call for a user. Never throws — failures come back as { error }. */
export async function runFarmTool(name: string, args: any, userId: number): Promise<any> {
  try {
    switch (name) {
      case 'list_zones': {
        const zones = await listZones(userId);
        return { zones, count: zones.length };
      }
      case 'list_tasks': {
        const tasks = await listTasks(userId, { status: args?.status });
        return { tasks, count: tasks.length };
      }
      case 'create_task': {
        const task = await createTask(userId, args || {});
        console.log(`[chat-tools] created task ${task.id} (${task.task_type}) for user ${userId}`);
        return {
          success: true,
          task_id: task.id,
          message: `Task '${task.task_type}' saved to the farmer's task list for ${task.zone_name}`,
        };
      }
      default:
        return { success: false, error: `Unknown tool '${name}'` };
    }
  } catch (err: any) {
    console.error(`[chat-tools] ${name} failed:`, err.message);
    return { success: false, error: err.message || 'The tool call failed' };
  }
}

// ─── Voice: propose, read back, then confirm ──────────────────────────────────
// Voice has no screen and no undo, so a mis-heard date would be written before
// the farmer noticed. The voice session therefore gets propose_task /
// confirm_task instead of create_task, and the gate below is enforced here
// rather than by prompt alone: nothing is written until the model has finished
// speaking its read-back AND the farmer has said something in reply.

const PROPOSAL_TTL_MS = 5 * 60 * 1000;

const proposalDecl: FunctionDeclaration[] = [
  {
    name: 'propose_task',
    description:
      'Step 1 of adding a task by voice. Checks the details and returns a spoken summary. ' +
      'Writes NOTHING. Read the returned summary back to the farmer and ask them to confirm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        zone_id: {
          type: Type.INTEGER,
          description: "Id of one of this farmer's own zones, from list_zones. Never guess.",
        },
        task_type: { type: Type.STRING, description: `Must be one of: ${VALID_TASK_TYPES.join(', ')}.` },
        scheduled_time: { type: Type.STRING, description: "When to do it, ISO 8601, e.g. '2026-03-14T08:00:00'." },
        duration_minutes: { type: Type.INTEGER, description: 'Expected duration in minutes.' },
        reasoning: { type: Type.STRING, description: 'Why this task is needed.' },
      },
      required: ['zone_id', 'task_type', 'scheduled_time'],
    },
  },
  {
    name: 'confirm_task',
    description:
      'Step 2. Saves the task you proposed, but ONLY after you have read the summary back ' +
      'and the farmer has agreed out loud. If they corrected any detail, call propose_task ' +
      'again with the correction instead. If they declined, call neither and say so.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

/** Tools for the live voice session — the two-step flow, and no direct create_task. */
export const VOICE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  ...FARM_TOOL_DECLARATIONS.filter((d) => d.name !== 'create_task'),
  ...proposalDecl,
];

export interface VoiceTaskSession {
  /** Call when the model finishes a speaking turn (its read-back has been heard). */
  noteModelTurnComplete(): void;
  /** Call when the farmer's speech is transcribed. */
  noteUserSpeech(): void;
  /** Runs a voice tool call. Never throws. */
  run(name: string, args: any): Promise<{ result: any; tasksChanged: boolean }>;
}

export function createVoiceTaskSession(userId: number): VoiceTaskSession {
  let pending:
    | { input: any; summary: string; readBack: boolean; answered: boolean; stagedAt: number }
    | null = null;

  const expired = () => !pending || Date.now() - pending.stagedAt > PROPOSAL_TTL_MS;

  return {
    noteModelTurnComplete() {
      // The turn in which the proposal was made has now been spoken aloud.
      if (pending) pending.readBack = true;
    },
    noteUserSpeech() {
      // Only counts once the read-back has actually been delivered, so the tail
      // of the farmer's original request cannot be mistaken for their answer.
      if (pending?.readBack) pending.answered = true;
    },
    async run(name: string, args: any) {
      try {
        if (name === 'propose_task') {
          const v = await validateTask(userId, args || {});
          const when = new Date(v.scheduledTime).toLocaleString('en-GB', {
            timeZone: 'Africa/Dar_es_Salaam',
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit', hour12: true,
          });
          const summary =
            `${v.taskType} in ${v.zoneName} on ${when}` +
            (v.duration ? `, for ${v.duration} minutes` : '');
          pending = { input: args, summary, readBack: false, answered: false, stagedAt: Date.now() };
          return {
            result: {
              proposed: true,
              summary,
              say_to_farmer: `Read this back and ask them to confirm: ${summary}`,
              note: 'Nothing has been saved yet. Call confirm_task only after they agree.',
            },
            tasksChanged: false,
          };
        }

        if (name === 'confirm_task') {
          if (expired()) {
            return {
              result: {
                success: false,
                error: 'There is no task waiting to be confirmed. Call propose_task first.',
              },
              tasksChanged: false,
            };
          }
          if (!pending!.readBack || !pending!.answered) {
            return {
              result: {
                success: false,
                error:
                  'The farmer has not answered yet. Read the task back to them and wait for ' +
                  `their reply before confirming: ${pending!.summary}`,
              },
              tasksChanged: false,
            };
          }

          const task = await createTask(userId, pending!.input);
          pending = null;
          console.log(`[voice-tools] confirmed task ${task.id} (${task.task_type}) for user ${userId}`);
          return {
            result: {
              success: true,
              task_id: task.id,
              message: `Saved: ${task.task_type} for ${task.zone_name}.`,
            },
            tasksChanged: true,
          };
        }

        // Reads (list_zones, list_tasks) share the chat implementation.
        return { result: await runFarmTool(name, args, userId), tasksChanged: false };
      } catch (err: any) {
        console.error(`[voice-tools] ${name} failed:`, err.message);
        return {
          result: { success: false, error: err.message || 'The tool call failed' },
          tasksChanged: false,
        };
      }
    },
  };
}

/** True if any call in this turn changed the farmer's task list. */
function mutatesTasks(name: string): boolean {
  return name === 'create_task';
}

export interface ToolLoopResult {
  text: string;
  tasksChanged: boolean;
}

const MAX_TOOL_ROUNDS = 4;

/**
 * Streams a reply, resolving any function calls the model makes along the way.
 *
 * `onChunk` receives prose as it arrives. Tool calls are executed between
 * rounds and their results fed back, so the model's final wording reflects
 * whether the write actually succeeded.
 */
export async function streamWithFarmTools(
  opts: GenerateOptions & { contents: any[] },
  userId: number | undefined,
  onChunk: (piece: string) => void
): Promise<ToolLoopResult> {
  const contents = opts.contents;
  const config = {
    ...(opts.config || {}),
    ...(userId ? { tools: [{ functionDeclarations: FARM_TOOL_DECLARATIONS }] } : {}),
  };

  let text = '';
  let tasksChanged = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls: { name: string; args: any }[] = [];
    // The model's parts are replayed back verbatim on the next round. Gemini
    // attaches a thoughtSignature to function-call parts and rejects the turn
    // if it is missing, so these are never rebuilt from name/args.
    const modelParts: any[] = [];

    await llm.generateStreamRaw(
      { ...opts, contents, config },
      (chunk: any) => {
        const parts = chunk?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          modelParts.push(part);
          if (part?.functionCall?.name) {
            calls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
          } else if (part?.text && !part?.thought) {
            text += part.text;
            onChunk(part.text);
          }
        }
      }
    );

    if (calls.length === 0 || !userId) break;

    contents.push({ role: 'model', parts: modelParts });

    const responseParts: any[] = [];
    for (const call of calls) {
      const response = await runFarmTool(call.name, call.args, userId);
      if (mutatesTasks(call.name) && response?.success) tasksChanged = true;
      responseParts.push({ functionResponse: { name: call.name, response } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text, tasksChanged };
}
