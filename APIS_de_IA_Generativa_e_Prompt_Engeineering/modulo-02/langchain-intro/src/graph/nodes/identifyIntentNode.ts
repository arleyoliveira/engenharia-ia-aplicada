import { type GraphState } from "../graph.ts";

export function identifyIntent(state: GraphState): GraphState {
    const input = state.messages.at(-1)?.text ?? ""

    const inputLower = input.toLowerCase()

    let command: GraphState['command'] = 'unknow'

    if(inputLower.includes('upper')) {
        command = 'uppercase'
    } else if(inputLower.includes('lower')) {
        command = 'lowercase'
    }

    return {
        ...state,
        command,
        output: input
    }
}