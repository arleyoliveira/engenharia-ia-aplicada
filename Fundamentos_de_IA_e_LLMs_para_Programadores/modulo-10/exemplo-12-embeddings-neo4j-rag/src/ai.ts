import { type Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

type DebugLog = (...args: unknown[]) => void;
type params = {
    debuglog: DebugLog,
    vectorStore: Neo4jVectorStore,
    nlpModel: ChatOpenAI,
    promptConfig: any,
    templateText: string,
    topK: number
}

interface ChainState {
    question: string;
    context?: string;
    topScore?: number;
    error?: string;
    answer?: string;
}

export class AI {
    private params: params;

    constructor(params: params) {
        this.params = params;
    }

    async retrieveVectorSearchResults(input: ChainState): Promise<ChainState> {
        this.params.debuglog("🔎 Realizando busca vetorial no Neo4j...");

        const vectorResults = await this.params.vectorStore.similaritySearchWithScore(input.question, this.params.topK);

        if (!vectorResults || vectorResults.length === 0) {
            this.params.debuglog("⚠️ Nenhum resultado encontrado para a consulta.");
            return {
                ...input,
                error: "Nenhum resultado encontrado para a consulta."
            }
        }

        const topScore = vectorResults[0]![1];
        this.params.debuglog(`✅ Encontrados ${vectorResults.length} resultados. Top score: ${topScore.toFixed(3)}`);

        const contexts = vectorResults
            .filter(([_, score]) => score > 0.5) // Filtra resultados com score acima de um limiar (ex: 0.5)
            .map(([doc]) => (doc.pageContent))
            .join("\n\n---\n\n");
        return {
            ...input,
            context: contexts,
            topScore
        }
    }

    async generateNLPResponse(input: ChainState): Promise<ChainState> {
        if (input.error) return input;

        this.params.debuglog("🤖 Gerando resposta com IA...");
        const responsePrompt = ChatPromptTemplate.fromTemplate(this.params.templateText)

        const responseChain = responsePrompt
            .pipe(this.params.nlpModel)
            .pipe(new StringOutputParser())

        const rawResponse = await responseChain.invoke({
            role: this.params.promptConfig.role,
            task: this.params.promptConfig.task,
            tone: this.params.promptConfig.constraints.tone,
            language: this.params.promptConfig.constraints.language,
            format: this.params.promptConfig.constraints.format,
            instructions: this.params.promptConfig.instructions.map((instruction: string, idx: number) =>
                `${idx + 1}. ${instruction}`
            ).join('\n'),
            question: input.question,
            context: input.context
        })

        return {
            ...input,
            answer: rawResponse
        }
    }

    async answerQuestion(question: string) {
        const chain = RunnableSequence.from([
            this.retrieveVectorSearchResults.bind(this),
            this.generateNLPResponse.bind(this)
        ]);

        const result = await chain.invoke({ question })
        this.params.debuglog("\n🎙️  Pergunta:");
        this.params.debuglog(question, "\n");
        this.params.debuglog("💬 Resposta:");
        this.params.debuglog(result.answer || result.error, "\n");
        return result;
    }
}