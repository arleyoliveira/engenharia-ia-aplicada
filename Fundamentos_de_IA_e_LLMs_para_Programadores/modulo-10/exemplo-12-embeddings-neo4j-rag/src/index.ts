import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { CONFIG } from './config.ts';
import { DocumentProcessor } from './documentProcessor.ts';
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import type { PretrainedModelOptions } from "@huggingface/transformers";
import { displayResults } from './util.ts';
import { ChatOpenAI } from '@langchain/openai';
import { AI } from './ai.ts';
import { writeFile, mkdir } from 'node:fs/promises'

let _neo4jVectorStore = null;

async function clearAll(vectorStore: Neo4jVectorStore, nodeLabel: string) {
    console.log("🗑️  Removendo todos os documentos existentes...");
    await vectorStore.query(`MATCH (n:${nodeLabel}) DETACH DELETE n`);
    console.log("✅ Documentos removidos com sucesso\n");
}

try {
    console.log("🚀 Inicializando sistema de Embeddings com Neo4j...\n");

    const documentProcessor = new DocumentProcessor(
        CONFIG.pdf.path,
        CONFIG.textSplitter
    );

    const documents = await documentProcessor.loadAndSplit();

    const embeddings = new HuggingFaceTransformersEmbeddings({
        model: CONFIG.embedding.modelName,
        pretrainedOptions: CONFIG.embedding.pretrainedOptions as PretrainedModelOptions
    });

    const nlpModel = new ChatOpenAI({
        temperature: CONFIG.openRouter.temperature,
        maxRetries: CONFIG.openRouter.maxRetries,
        modelName: CONFIG.openRouter.nlpModel,
        openAIApiKey: CONFIG.openRouter.apiKey,
        configuration: {
            baseURL: CONFIG.openRouter.url,
            defaultHeaders: CONFIG.openRouter.defaultHeaders
        }
    });

    // Testando a geração de embeddings para uma consulta
    // const response = await embeddings.embedQuery("Javascript")

    // Testando a geração de embeddings para um documento
    // const response = await embeddings.embedDocuments([
    //     "Javascript"
    // ])
    //console.log('response:', response);

    _neo4jVectorStore = await Neo4jVectorStore.fromExistingGraph(
        embeddings,
        CONFIG.neo4j
    )
    await clearAll(_neo4jVectorStore, CONFIG.neo4j.nodeLabel);

    for (const [index, doc] of documents.entries()) {
        console.log(`✅ Processando documento ${index + 1}/${documents.length}...`);
        await _neo4jVectorStore.addDocuments([doc]);
    }
    console.log("\n✅ Todos os documentos processados com sucesso!");

    // =========== STEP 2: Consulta de Similaridade ===========
    const questions = [
        //"o que é hot encoding e quando usar?",
        //"o que significa treinar uma rede neural?"
        "O que são tensores e como são representados em JavaScript?"
        //"Como converter objetos JavaScript em tensores?",
        //"O que é normalização de dados e por que é necessária?",
        //"Como funciona uma rede neural no TensorFlow.js?",
        //"O que significa treinar uma rede neural?",
        //"o que é hot enconding e quando usar?"
    ]

    const ai = new AI({
            nlpModel,
            debuglog: console.log,
            vectorStore: _neo4jVectorStore,
            promptConfig: CONFIG.promptConfig,
            templateText: CONFIG.templateText,
            topK: CONFIG.similarity.topK
        }
    );

    for (const index in questions) {
        const question = questions[index];
        console.log(`\n{'='.repeat(80)}\n`);
        console.log(`❓ Pergunta: ${question}\n`);
        console.log('='.repeat(80));
        const result = await ai.answerQuestion(question!);

        if(result.error) {
            console.error("❌ Erro ao processar a pergunta:", result.error);
        }

        console.log(`\n${result.answer}\n`);
        await mkdir(CONFIG.output.answersFolder, { recursive: true })
        const fileName = `${CONFIG.output.answersFolder}/${CONFIG.output.fileName}-${index}-${Date.now()}.md`
        await writeFile(fileName, result.answer!)

    }
} catch (error) {
    console.error('An error occurred:', error);
} finally {
    _neo4jVectorStore?.close()
}