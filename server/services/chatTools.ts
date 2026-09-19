/**
 * Function-calling tools for the direct-Gemini chat path.
 *
 * The ADK agents have had farm tools for a long time, but the direct-Gemini
 * fallback — which runs whenever ADK is unreachable — had none. It could only
 * talk about adding a task, so it would confirm additions that never happened.
 * These declarations give that path the same ability, backed by the same
 * user-scoped data service the app itself uses.
 */
import { llm } from './llm/index.ts';
import type { GenerateOptions } from './llm/types.ts';
import { VALID_TASK_TYPES, createTask, listTasks, listZones } from './farmData.ts';

/** Declarations sent to the model. Kept small — reads the model needs to act, plus the write. */
export const FARM_TOOL_DECLARATIONS = [
  {
    name: 'list_zones',
    description:
      "List this farmer's own zones with their id, name, crop type, planting date and area. " +
      'Call this before creating a task so you use a real zone_id.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_tasks',
    description: "List this farmer's scheduled tasks, newest schedule first.",
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
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
      type: 'OBJECT',
      properties: {
        zone_id: {
          type: 'INTEGER',
          description: "Id of one of this farmer's own zones, from list_zones. Never guess.",
        },
        task_type: {
          type: 'STRING',
          description: `Must be one of: ${VALID_TASK_TYPES.join(', ')}.`,
        },
        scheduled_time: {
          type: 'STRING',
          description: "When to do it, ISO 8601, e.g. '2026-03-14T08:00:00'.",
        },
        duration_minutes: { type: 'INTEGER', description: 'Expected duration in minutes.' },
        reasoning: { type: 'STRING', description: 'Why this task is needed.' },
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
